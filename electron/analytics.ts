import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { logger } from './logger'

export interface DailyStats {
  date: string // YYYY-MM-DD
  downloads: number
  bytes: number
  successCount: number
  failCount: number
  bandwidthBytes: number
}

export interface AnalyticsData {
  totalDownloads: number
  totalBytes: number
  totalBandwidth: number
  timeSavedSeconds: number
  successCount: number
  failCount: number
  avgSpeed: number // bytes per second (actual download speed)
  totalDownloadDuration: number // total seconds spent downloading (for speed calculation)
  formatBreakdown: Record<string, number> // { "mp4": 50, "mp3": 20 }
  platformBreakdown: Record<string, number> // { "youtube": 50, "tiktok": 20 }
  sourceBreakdown: { cloud: number; local: number } // Downloads from cloud sync vs local app
  topChannels: Array<{ name: string; count: number }>
  dailyStats: DailyStats[]
  firstDownloadDate: string | null
  lastUpdated: string
}

export interface DownloadRecord {
  id: string
  title: string
  url: string
  channel?: string
  format: string
  bytes: number
  duration?: number // in seconds
  success: boolean
  timestamp: number
  bandwidthBytes?: number // Optional: actual bandwidth used (may differ from bytes for streaming)
  platform?: string // 'youtube' | 'tiktok' | 'instagram' | etc.
  source?: 'app' | 'extension' | 'cloud' // Where the download originated
}

const ANALYTICS_FILE = 'analytics.json'
const MAX_DAILY_STATS = 365 // Keep up to a year of daily stats
const MAX_TOP_CHANNELS = 20
const AVG_VIDEO_SECONDS = 300 // 5 minutes average video length

class AnalyticsManager {
  private data: AnalyticsData
  private filePath: string
  private saveTimeout: NodeJS.Timeout | null = null
  private readonly SAVE_DEBOUNCE_MS = 2000

  constructor() {
    this.filePath = path.join(app.getPath('userData'), ANALYTICS_FILE)
    this.data = this.load()
  }

  private load(): AnalyticsData {
    const defaultData: AnalyticsData = {
      totalDownloads: 0,
      totalBytes: 0,
      totalBandwidth: 0,
      timeSavedSeconds: 0,
      successCount: 0,
      failCount: 0,
      avgSpeed: 0,
      totalDownloadDuration: 0,
      formatBreakdown: {},
      platformBreakdown: {},
      sourceBreakdown: { cloud: 0, local: 0 },
      topChannels: [],
      dailyStats: [],
      firstDownloadDate: null,
      lastUpdated: new Date().toISOString(),
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        const loaded = JSON.parse(content) as Partial<AnalyticsData>

        return {
          ...defaultData,
          ...loaded,
          formatBreakdown: loaded.formatBreakdown || {},
          platformBreakdown: loaded.platformBreakdown || {},
          sourceBreakdown: loaded.sourceBreakdown || { cloud: 0, local: 0 },
          topChannels: loaded.topChannels || [],
          dailyStats: loaded.dailyStats || [],
        }
      }
    } catch (err) {
      logger.error('Failed to load analytics', err instanceof Error ? err.message : String(err))
    }

    return defaultData
  }

  private save(): void {
    try {
      this.data.lastUpdated = new Date().toISOString()
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Failed to save analytics', err instanceof Error ? err : String(err))
    }
  }

  private debouncedSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => {
      this.save()
      this.saveTimeout = null
    }, this.SAVE_DEBOUNCE_MS)
  }

  getData(): AnalyticsData {
    return { ...this.data }
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0]
  }

  private updateDailyStats(
    date: string,
    downloads: number,
    bytes: number,
    success: boolean,
    bandwidthBytes: number
  ): void {
    const existingIndex = this.data.dailyStats.findIndex((s) => s.date === date)

    if (existingIndex >= 0) {
      const stats = this.data.dailyStats[existingIndex]
      stats.downloads += downloads
      stats.bytes += bytes
      stats.bandwidthBytes += bandwidthBytes
      if (success) {
        stats.successCount++
      } else {
        stats.failCount++
      }
    } else {
      this.data.dailyStats.unshift({
        date,
        downloads,
        bytes,
        successCount: success ? 1 : 0,
        failCount: success ? 0 : 1,
        bandwidthBytes,
      })

      // Trim to max size
      if (this.data.dailyStats.length > MAX_DAILY_STATS) {
        this.data.dailyStats = this.data.dailyStats.slice(0, MAX_DAILY_STATS)
      }
    }
  }

  private updateTopChannels(channel: string | undefined): void {
    if (!channel) return

    const existing = this.data.topChannels.find((c) => c.name === channel)
    if (existing) {
      existing.count++
    } else {
      this.data.topChannels.push({ name: channel, count: 1 })
    }

    // Sort by count descending and keep top N
    this.data.topChannels.sort((a, b) => b.count - a.count)
    if (this.data.topChannels.length > MAX_TOP_CHANNELS) {
      this.data.topChannels = this.data.topChannels.slice(0, MAX_TOP_CHANNELS)
    }
  }

  private updateFormatBreakdown(format: string): void {
    const normalizedFormat = format.toLowerCase()
    this.data.formatBreakdown[normalizedFormat] = (this.data.formatBreakdown[normalizedFormat] || 0) + 1
  }

  private updatePlatformBreakdown(platform: string | undefined): void {
    if (!platform) {
      this.data.platformBreakdown['other'] = (this.data.platformBreakdown['other'] || 0) + 1
      return
    }
    this.data.platformBreakdown[platform] = (this.data.platformBreakdown[platform] || 0) + 1
  }

  private updateSourceBreakdown(source: 'app' | 'extension' | 'cloud' | undefined): void {
    if (source === 'cloud' || source === 'extension') {
      this.data.sourceBreakdown.cloud++
    } else {
      this.data.sourceBreakdown.local++
    }
  }

  recordDownload(record: DownloadRecord): void {
    const today = this.getTodayDate()

    // Update totals
    this.data.totalDownloads++
    this.data.totalBytes += record.bytes
    this.data.totalBandwidth += record.bandwidthBytes || record.bytes

    if (record.success) {
      this.data.successCount++
      // Track actual download duration for speed calculation
      // duration is in seconds (time from queue add to completion)
      if (record.duration && record.duration > 0) {
        this.data.totalDownloadDuration += record.duration
      }
      // Estimate time saved (assuming 5 min average video length)
      this.data.timeSavedSeconds += AVG_VIDEO_SECONDS
    } else {
      this.data.failCount++
    }

    // Update daily stats
    this.updateDailyStats(
      today,
      1,
      record.bytes,
      record.success,
      record.bandwidthBytes || record.bytes
    )

    // Update format breakdown
    this.updateFormatBreakdown(record.format)

    // Update platform breakdown
    this.updatePlatformBreakdown(record.platform)

    // Update source breakdown
    this.updateSourceBreakdown(record.source)

    // Update top channels
    this.updateTopChannels(record.channel)

    // Set first download date if not set
    if (!this.data.firstDownloadDate) {
      this.data.firstDownloadDate = today
    }

    // Recalculate average speed: total bytes / total download duration
    // This gives actual bytes per second average
    if (this.data.totalDownloadDuration > 0) {
      this.data.avgSpeed = this.data.totalBytes / this.data.totalDownloadDuration
    } else {
      this.data.avgSpeed = 0
    }

    logger.info('Analytics recorded', `${record.title}: ${record.bytes} bytes, duration: ${record.duration}s`)
    this.debouncedSave()
  }

  getDataForRange(range: 'all' | 'today' | 'week' | 'month'): AnalyticsData {
    const now = new Date()
    const today = this.getTodayDate()

    if (range === 'all') {
      return this.getData()
    }

    let startDate: Date
    if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (range === 'week') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
    } else { // month
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 1)
    }

    const filteredStats = this.data.dailyStats.filter((s) => {
      const statDate = new Date(s.date)
      return statDate >= startDate && statDate <= now
    })

    // Calculate aggregated data for the range
    const rangeData: AnalyticsData = {
      totalDownloads: filteredStats.reduce((sum, s) => sum + s.downloads, 0),
      totalBytes: filteredStats.reduce((sum, s) => sum + s.bytes, 0),
      totalBandwidth: filteredStats.reduce((sum, s) => sum + s.bandwidthBytes, 0),
      timeSavedSeconds: filteredStats.reduce((sum, s) => sum + s.downloads * AVG_VIDEO_SECONDS, 0),
      successCount: filteredStats.reduce((sum, s) => sum + s.successCount, 0),
      failCount: filteredStats.reduce((sum, s) => sum + s.failCount, 0),
      avgSpeed: 0,
      totalDownloadDuration: 0, // We don't have per-day duration, so estimate from success count
      formatBreakdown: {},
      platformBreakdown: { ...this.data.platformBreakdown },
      sourceBreakdown: { ...this.data.sourceBreakdown },
      topChannels: this.data.topChannels, // Keep top channels from all time
      dailyStats: filteredStats,
      firstDownloadDate: this.data.firstDownloadDate,
      lastUpdated: this.data.lastUpdated,
    }

    // For range data, estimate speed based on overall average speed
    // (since we don't track per-day duration)
    if (this.data.totalDownloadDuration > 0 && this.data.successCount > 0) {
      const avgDurationPerDownload = this.data.totalDownloadDuration / this.data.successCount
      rangeData.totalDownloadDuration = rangeData.successCount * avgDurationPerDownload
      if (rangeData.totalDownloadDuration > 0) {
        rangeData.avgSpeed = rangeData.totalBytes / rangeData.totalDownloadDuration
      }
    }

    return rangeData
  }

  getComparisonData(currentRange: 'all' | 'today' | 'week' | 'month'): {
    current: AnalyticsData
    previous: AnalyticsData
  } {
    const current = this.getDataForRange(currentRange)

    // Calculate previous period for comparison
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date
    let previousStart: Date
    let previousEnd: Date

    if (currentRange === 'today') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      periodEnd = now
      previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (currentRange === 'week') {
      periodStart = new Date(now)
      periodStart.setDate(now.getDate() - 7)
      periodEnd = now
      previousStart = new Date(now)
      previousStart.setDate(now.getDate() - 14)
      previousEnd = new Date(now)
      previousEnd.setDate(now.getDate() - 7)
    } else if (currentRange === 'month') {
      periodStart = new Date(now)
      periodStart.setMonth(now.getMonth() - 1)
      periodEnd = now
      previousStart = new Date(now)
      previousStart.setMonth(now.getMonth() - 2)
      previousEnd = new Date(now)
      previousEnd.setMonth(now.getMonth() - 1)
    } else {
      // All time - no previous comparison
      return {
        current,
        previous: { ...current, totalDownloads: 0, totalBytes: 0 },
      }
    }

    const filteredStats = this.data.dailyStats.filter((s) => {
      const statDate = new Date(s.date)
      return statDate >= previousStart && statDate < previousEnd
    })

    const previous: AnalyticsData = {
      totalDownloads: filteredStats.reduce((sum, s) => sum + s.downloads, 0),
      totalBytes: filteredStats.reduce((sum, s) => sum + s.bytes, 0),
      totalBandwidth: filteredStats.reduce((sum, s) => sum + s.bandwidthBytes, 0),
      timeSavedSeconds: filteredStats.reduce((sum, s) => sum + s.downloads * AVG_VIDEO_SECONDS, 0),
      successCount: filteredStats.reduce((sum, s) => sum + s.successCount, 0),
      failCount: filteredStats.reduce((sum, s) => sum + s.failCount, 0),
      avgSpeed: 0,
      totalDownloadDuration: 0,
      formatBreakdown: {},
      platformBreakdown: {},
      sourceBreakdown: { cloud: 0, local: 0 },
      topChannels: [],
      dailyStats: filteredStats,
      firstDownloadDate: this.data.firstDownloadDate,
      lastUpdated: this.data.lastUpdated,
    }

    // Estimate speed for previous period
    if (this.data.totalDownloadDuration > 0 && this.data.successCount > 0) {
      const avgDurationPerDownload = this.data.totalDownloadDuration / this.data.successCount
      previous.totalDownloadDuration = previous.successCount * avgDurationPerDownload
      if (previous.totalDownloadDuration > 0) {
        previous.avgSpeed = previous.totalBytes / previous.totalDownloadDuration
      }
    }

    return { current, previous }
  }

  reset(): void {
    this.data = {
      totalDownloads: 0,
      totalBytes: 0,
      totalBandwidth: 0,
      timeSavedSeconds: 0,
      successCount: 0,
      failCount: 0,
      avgSpeed: 0,
      totalDownloadDuration: 0,
      formatBreakdown: {},
      platformBreakdown: {},
      sourceBreakdown: { cloud: 0, local: 0 },
      topChannels: [],
      dailyStats: [],
      firstDownloadDate: null,
      lastUpdated: new Date().toISOString(),
    }
    this.save()
    logger.info('Analytics reset', 'All analytics data has been cleared')
  }
}

// Singleton instance
let analyticsManager: AnalyticsManager | null = null

export function getAnalyticsManager(): AnalyticsManager {
  if (!analyticsManager) {
    analyticsManager = new AnalyticsManager()
  }
  return analyticsManager
}
