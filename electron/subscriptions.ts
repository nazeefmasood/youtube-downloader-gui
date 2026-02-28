import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import { spawn } from 'child_process'
import { binaryManager } from './binaryManager'
import { logger } from './logger'

export interface Subscription {
  id: string
  url: string
  type: 'channel' | 'playlist'
  name: string
  thumbnail?: string
  lastChecked: string
  lastVideoId?: string
}

export interface NewVideo {
  id: string
  title: string
  thumbnail?: string
  duration?: number
  url: string
  subscriptionId: string
  subscriptionName: string
}

class SubscriptionManager {
  private subscriptionsPath: string
  private subscriptions: Subscription[] = []

  constructor() {
    const userDataPath = app.getPath('userData')
    this.subscriptionsPath = path.join(userDataPath, 'subscriptions.json')
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.subscriptionsPath)) {
        const content = fs.readFileSync(this.subscriptionsPath, 'utf-8')
        this.subscriptions = JSON.parse(content)
        logger.info('Subscriptions loaded', `${this.subscriptions.length} subscriptions`)
      }
    } catch (err) {
      logger.error('Failed to load subscriptions', err instanceof Error ? err.message : String(err))
      this.subscriptions = []
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.subscriptionsPath, JSON.stringify(this.subscriptions, null, 2))
      logger.info('Subscriptions saved', `${this.subscriptions.length} subscriptions`)
    } catch (err) {
      logger.error('Failed to save subscriptions', err instanceof Error ? err.message : String(err))
    }
  }

  getSubscriptions(): Subscription[] {
    return [...this.subscriptions]
  }

  addSubscription(url: string, name: string, type: 'channel' | 'playlist', thumbnail?: string): Subscription {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const subscription: Subscription = {
      id,
      url,
      type,
      name,
      thumbnail,
      lastChecked: new Date().toISOString(),
    }
    this.subscriptions.push(subscription)
    this.save()
    logger.info('Subscription added', `${name} (${type})`)
    return subscription
  }

  removeSubscription(id: string): boolean {
    const index = this.subscriptions.findIndex(s => s.id === id)
    if (index !== -1) {
      const removed = this.subscriptions.splice(index, 1)[0]
      this.save()
      logger.info('Subscription removed', removed.name)
      return true
    }
    return false
  }

  updateLastVideoId(subscriptionId: string, videoId: string): void {
    const sub = this.subscriptions.find(s => s.id === subscriptionId)
    if (sub) {
      sub.lastVideoId = videoId
      sub.lastChecked = new Date().toISOString()
      this.save()
    }
  }

  async detectSubscriptionInfo(url: string): Promise<{ name: string; type: 'channel' | 'playlist'; thumbnail?: string } | null> {
    return new Promise((resolve) => {
      const ytdlpPath = binaryManager.getBinaryPath()
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--playlist-items', '1',
        url,
      ]

      let stdout = ''
      let stderr = ''

      const process = spawn(ytdlpPath, args)

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const lines = stdout.trim().split('\n').filter(Boolean)
            if (lines.length > 0) {
              const info = JSON.parse(lines[0])
              const isChannel = url.includes('/channel/') || url.includes('/@') || url.includes('/c/')
              resolve({
                name: info.playlist_title || info.uploader || info.channel || 'Unknown',
                type: isChannel ? 'channel' : 'playlist',
                thumbnail: info.playlist_thumbnail || info.thumbnail || info.thumbnails?.[0]?.url,
              })
              return
            }
          } catch (err) {
            logger.error('Failed to parse subscription info', err instanceof Error ? err.message : String(err))
          }
        }
        resolve(null)
      })

      process.on('error', (err) => {
        logger.error('Failed to detect subscription info', err.message)
        resolve(null)
      })
    })
  }

  async checkForNewVideos(): Promise<NewVideo[]> {
    if (this.subscriptions.length === 0) {
      return []
    }

    logger.info('Checking subscriptions for new videos', `${this.subscriptions.length} subscriptions`)
    const allNewVideos: NewVideo[] = []

    for (const subscription of this.subscriptions) {
      try {
        const videos = await this.checkSubscription(subscription)
        if (videos.length > 0) {
          allNewVideos.push(...videos)
          // Update the last video ID to the newest one
          this.updateLastVideoId(subscription.id, videos[0].id)
        }
      } catch (err) {
        logger.error('Failed to check subscription', `${subscription.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    logger.info('Subscription check complete', `${allNewVideos.length} new videos found`)
    return allNewVideos
  }

  private async checkSubscription(subscription: Subscription): Promise<NewVideo[]> {
    return new Promise((resolve, reject) => {
      const ytdlpPath = binaryManager.getBinaryPath()
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--playlist-items', '1:10', // Check first 10 videos
        subscription.url,
      ]

      let stdout = ''
      let stderr = ''

      const process = spawn(ytdlpPath, args)
      const timeout = setTimeout(() => {
        process.kill()
        reject(new Error('Subscription check timeout'))
      }, 30000) // 30 second timeout per subscription

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0 && stdout.trim()) {
          try {
            const lines = stdout.trim().split('\n').filter(Boolean)
            const newVideos: NewVideo[] = []

            for (const line of lines) {
              try {
                const entry = JSON.parse(line)
                const videoId = entry.id || entry.url

                // If this is the first video and it matches our last known video, stop
                if (videoId === subscription.lastVideoId) {
                  break
                }

                // Build the video URL
                const videoUrl = entry.url || `https://www.youtube.com/watch?v=${videoId}`

                newVideos.push({
                  id: videoId,
                  title: entry.title || 'Unknown Title',
                  thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url,
                  duration: entry.duration,
                  url: videoUrl,
                  subscriptionId: subscription.id,
                  subscriptionName: subscription.name,
                })
              } catch {
                // Skip malformed entries
              }
            }

            resolve(newVideos)
          } catch (err) {
            reject(err)
          }
        } else {
          reject(new Error(stderr || `yt-dlp exited with code ${code}`))
        }
      })

      process.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }
}

export const subscriptionManager = new SubscriptionManager()
