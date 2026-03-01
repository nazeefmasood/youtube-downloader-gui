import { EventEmitter } from 'events'
import { QueueManager } from './queueManager'
import { logger } from './logger'
import * as https from 'https'
import * as http from 'http'

export interface CloudSyncConfig {
  apiUrl: string      // e.g. "https://grab-app.vercel.app"
  apiKey: string      // DESKTOP_API_KEY
  userId: string      // Grab cloud user ID
  pollInterval: number // ms between polls (default 15000)
}

interface CloudQueueItem {
  id: string
  url: string
  title: string | null
  thumbnail: string | null
  platform: string | null
  status: string
}

export class CloudSync extends EventEmitter {
  private config: CloudSyncConfig | null = null
  private queueManager: QueueManager
  private pollTimer: NodeJS.Timeout | null = null
  private isPolling = false
  private enabled = false
  // Track cloud item ID -> local queue ID mapping
  private cloudToLocalMap = new Map<string, string>()

  constructor(queueManager: QueueManager) {
    super()
    this.queueManager = queueManager
    this.setupQueueListeners()
  }

  private setupQueueListeners(): void {
    // When a local queue item completes, report back to cloud
    this.queueManager.on('itemComplete', (item: {
      id: string
      title: string
      url: string
      thumbnail?: string
      filePath?: string
    }) => {
      const cloudId = this.findCloudId(item.id)
      if (cloudId) {
        this.reportStatus(cloudId, {
          status: 'COMPLETED',
          progress: 100,
          title: item.title,
          thumbnail: item.thumbnail,
          filePath: item.filePath,
        })
        this.cloudToLocalMap.delete(cloudId)
      }
    })

    // Listen for queue updates to report progress
    this.queueManager.on('update', (status: { items: Array<{ id: string; status: string; progress?: { percent: number }; title: string; thumbnail?: string; error?: string }> }) => {
      for (const item of status.items) {
        const cloudId = this.findCloudId(item.id)
        if (!cloudId) continue

        if (item.status === 'downloading' && item.progress) {
          this.reportStatus(cloudId, {
            status: 'DOWNLOADING',
            progress: item.progress.percent,
            title: item.title,
            thumbnail: item.thumbnail,
          })
        } else if (item.status === 'failed') {
          this.reportStatus(cloudId, {
            status: 'FAILED',
            errorMessage: item.error || 'Download failed',
            title: item.title,
          })
          this.cloudToLocalMap.delete(cloudId)
        }
      }
    })
  }

  private findCloudId(localId: string): string | null {
    for (const [cloudId, lid] of this.cloudToLocalMap) {
      if (lid === localId) return cloudId
    }
    return null
  }

  configure(config: CloudSyncConfig): void {
    this.config = config
    logger.info('Cloud sync configured', `${config.apiUrl} (user: ${config.userId})`)
  }

  start(): void {
    if (!this.config) {
      logger.error('Cloud sync not configured')
      return
    }
    if (this.enabled) return

    this.enabled = true
    logger.info('Cloud sync started', `polling every ${this.config.pollInterval / 1000}s`)
    this.emit('status', { enabled: true, polling: false, lastPoll: null })

    // Poll immediately, then on interval
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), this.config.pollInterval)
  }

  stop(): void {
    this.enabled = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    logger.info('Cloud sync stopped')
    this.emit('status', { enabled: false, polling: false, lastPoll: null })
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getConfig(): CloudSyncConfig | null {
    return this.config
  }

  private async poll(): Promise<void> {
    if (!this.config || this.isPolling) return
    this.isPolling = true

    try {
      const items = await this.fetchPendingItems()
      if (items.length > 0) {
        logger.info('Cloud sync', `Found ${items.length} pending cloud items`)
        for (const item of items) {
          await this.addCloudItemToQueue(item)
        }
      }
      this.emit('status', { enabled: true, polling: false, lastPoll: new Date().toISOString(), itemsFound: items.length })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('Cloud sync poll failed', msg)
      this.emit('status', { enabled: true, polling: false, error: msg })
    } finally {
      this.isPolling = false
    }
  }

  private fetchPendingItems(): Promise<CloudQueueItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.config) return reject(new Error('Not configured'))

      const makeRequest = (urlStr: string, redirects: number = 0): void => {
        if (redirects > 5) {
          reject(new Error('Too many redirects'))
          return
        }

        const url = new URL(urlStr)
        const mod = url.protocol === 'https:' ? https : http

        const req = mod.get(url.toString(), {
          headers: { 'Authorization': `Bearer ${this.config!.apiKey}` },
          timeout: 10000,
        }, (res) => {
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const location = res.headers.location
            if (location) {
              logger.info('Cloud sync', `Following redirect to ${location}`)
              makeRequest(location, redirects + 1)
              return
            }
          }

          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try {
              if (res.statusCode !== 200) {
                reject(new Error(`API returned ${res.statusCode}: ${data}`))
                return
              }
              const parsed = JSON.parse(data)
              resolve(parsed.items || [])
            } catch (e) {
              reject(e)
            }
          })
        })

        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
      }

      // Ensure URL doesn't have trailing slash issues
      const baseUrl = this.config.apiUrl.replace(/\/$/, '')
      makeRequest(`${baseUrl}/api/queue/pending?userId=${this.config.userId}`)
    })
  }

  private async addCloudItemToQueue(cloudItem: CloudQueueItem): Promise<void> {
    // Skip if already mapped (already in local queue)
    if (this.cloudToLocalMap.has(cloudItem.id)) return

    // Mark as DOWNLOADING on cloud immediately
    await this.reportStatus(cloudItem.id, { status: 'DOWNLOADING', progress: 0 })

    // Add to local queue
    const result = this.queueManager.addItem({
      url: cloudItem.url,
      title: cloudItem.title || cloudItem.url,
      thumbnail: cloudItem.thumbnail || undefined,
      format: 'best',
      audioOnly: false,
      source: 'extension', // Treat as external source
      sourceType: 'single',
    })

    this.cloudToLocalMap.set(cloudItem.id, result.id)
    logger.info('Cloud item added to local queue', `${cloudItem.title || cloudItem.url} (cloud:${cloudItem.id} -> local:${result.id})`)
  }

  private reportStatus(cloudItemId: string, update: {
    status?: string
    progress?: number
    title?: string
    thumbnail?: string
    filePath?: string
    fileSize?: number
    errorMessage?: string
  }): Promise<void> {
    return new Promise((resolve) => {
      if (!this.config) { resolve(); return }

      const url = new URL(`/api/queue/${cloudItemId}/status`, this.config.apiUrl)
      // Include userId in the body for API key verification
      const body = JSON.stringify({ ...update, userId: this.config.userId })
      const mod = url.protocol === 'https:' ? https : http

      const req = mod.request(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      }, () => { resolve() })

      req.on('error', () => { resolve() }) // Non-fatal
      req.on('timeout', () => { req.destroy(); resolve() })
      req.write(body)
      req.end()
    })
  }
}
