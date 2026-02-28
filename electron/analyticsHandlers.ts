import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { getAnalyticsManager, DownloadRecord } from './analytics'
import { QueueManager } from './queueManager'
import { logger } from './logger'

const downloadMetadata = new Map<string, { startTime: number; title: string; url: string; format: string; audioOnly: boolean; channel?: string }>()

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function setupAnalyticsHandlers(queueManager: QueueManager): void {
  // Analytics IPC handlers
  ipcMain.handle('analytics:get', () => {
    const analytics = getAnalyticsManager()
    return analytics.getData()
  })

  ipcMain.handle('analytics:getRange', (_event, range: 'all' | 'today' | 'week' | 'month') => {
    const analytics = getAnalyticsManager()
    return analytics.getComparisonData(range)
  })

  ipcMain.handle('analytics:reset', async () => {
    const analytics = getAnalyticsManager()
    analytics.reset()
    logger.info('Analytics reset by user')
  })

  // Track download start time for each item to accurately measure duration
  const downloadStartTime = new Map<string, number>()

  // Hook into queue manager's processNext to track actual download start time
  const originalProcessNext = queueManager.processNext.bind(queueManager)
  queueManager.processNext = async function() {
    const status = this.getStatus()
    if (status.currentItemId) {
      downloadStartTime.set(status.currentItemId, Date.now())
      logger.info('Analytics: tracking download start', `Item ${status.currentItemId} at ${downloadStartTime.get(status.currentItemId)}`)
    }
    return originalProcessNext()
  }

  // Hook into queue itemComplete event for analytics
  queueManager.on('itemComplete', (item: {
    id: string
    title: string
    url: string
    thumbnail?: string
    channel?: string
    filePath?: string
    audioOnly: boolean
  }) => {
    const analytics = getAnalyticsManager()
    const metadata = downloadMetadata.get(item.id)

    // Calculate duration: prefer actual download time (from when download started)
    // Fall back to queue add time (from metadata) if no download start time tracked
    let duration = 0
    const actualDownloadStart = downloadStartTime.get(item.id)
    const queueAddTime = metadata?.startTime

    if (actualDownloadStart) {
      // Use actual download duration (from processNext to complete)
      duration = (Date.now() - actualDownloadStart) / 1000
      logger.info('Analytics: actual download duration', `${item.title}: ${duration.toFixed(2)}s`)
    } else if (queueAddTime) {
      // Fall back to queue time (from add to complete)
      duration = (Date.now() - queueAddTime) / 1000
      logger.info('Analytics: queue-to-complete duration', `${item.title}: ${duration.toFixed(2)}s (no download start time)`)
    } else {
      logger.warn('Analytics: no duration tracking', `${item.title} - no start time available`)
    }

    // Get file size - filePath should be the actual file, but handle directory fallback
    let fileSize = 0
    if (item.filePath) {
      try {
        const stats = fs.statSync(item.filePath)

        // Check if it's a file (not a directory)
        if (stats.isFile()) {
          fileSize = stats.size
          logger.info('Analytics file size', `${item.title}: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB) from ${item.filePath}`)
        } else if (stats.isDirectory()) {
          // It's a directory - try to find the largest media file inside
          logger.info('Analytics: scanning directory for media files', item.filePath)

          const mediaExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.mp3', '.m4a', '.opus', '.wav', '.flac', '.ogg', '.aac']
          let largestFile: { path: string; size: number } | null = null

          try {
            const files = fs.readdirSync(item.filePath)
            logger.info('Analytics: directory contents', `${files.length} files in ${item.filePath}`)

            for (const file of files) {
              const ext = path.extname(file).toLowerCase()
              // Skip partial/temp files
              if (file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.temp')) continue
              // Only check media files
              if (!mediaExtensions.includes(ext)) continue

              const fullPath = path.join(item.filePath, file)
              try {
                const fileStats = fs.statSync(fullPath)
                if (fileStats.isFile() && fileStats.size > 0 && (!largestFile || fileStats.size > largestFile.size)) {
                  largestFile = { path: fullPath, size: fileStats.size }
                }
              } catch {
                // Skip files we can't stat
                continue
              }
            }

            if (largestFile && largestFile.size > 0) {
              fileSize = largestFile.size
              logger.info('Analytics: found file in directory', `${item.title}: ${(fileSize / 1024 / 1024).toFixed(2)} MB from ${path.basename(largestFile.path)}`)
            } else {
              logger.warn('Analytics: no media file found in directory', `${item.filePath} - files: ${files.join(', ')}`)
            }
          } catch (dirErr) {
            logger.error('Failed to scan directory for files', dirErr instanceof Error ? dirErr.message : String(dirErr))
          }
        } else {
          logger.warn('Analytics: path is neither file nor directory', item.filePath)
        }
      } catch (err) {
        logger.error('Failed to get file size', `${item.filePath}: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      logger.warn('Analytics: no filePath provided', item.title)
    }

    // Log final file size for debugging
    if (fileSize > 0) {
      logger.info('Analytics: final file size', `${item.title}: ${formatBytes(fileSize)} (${fileSize} bytes)`)
    } else {
      logger.warn('Analytics: file size is 0', item.title)
    }

    // Use channel from metadata (passed during queue add) or from item
    // The item.channel now comes from the download result which extracts it from video metadata
    const channel = metadata?.channel || item.channel

    if (channel) {
      logger.info('Analytics channel found', `${item.title}: channel="${channel}" (metadata: ${metadata?.channel || 'none'}, item: ${item.channel || 'none'})`)
    } else {
      logger.warn('Analytics no channel info', `${item.title} - metadata: ${metadata?.channel || 'none'}, item: ${item.channel || 'none'}`)
    }

    const record: DownloadRecord = {
      id: item.id,
      title: item.title,
      url: item.url,
      channel,
      format: metadata?.format || (item.audioOnly ? 'mp3' : 'mp4'),
      bytes: fileSize,
      duration,
      success: true,
      timestamp: Date.now(),
    }

    analytics.recordDownload(record)
    downloadMetadata.delete(item.id)
    downloadStartTime.delete(item.id)
  })

  // Intercept queue add to track start time and channel
  const originalAddItem = queueManager.addItem
  queueManager.addItem = function(item: Omit<any, 'id' | 'status' | 'addedAt'>) {
    const result = originalAddItem.call(this, item)

    // Store metadata including channel for analytics
    downloadMetadata.set(result.id, {
      startTime: Date.now(),
      title: item.title,
      url: item.url,
      format: item.format,
      audioOnly: item.audioOnly,
      channel: item.channel,
    })

    logger.info('Analytics metadata stored', `${item.title}: channel="${item.channel || 'none'}"`)

    return result
  }
}
