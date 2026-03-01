import { Tray, Menu, nativeImage, BrowserWindow, app, Notification, shell } from 'electron'
import * as path from 'path'
import { QueueManager, QueueStatus } from './queueManager'
import { logger } from './logger'

// Notification auto-dismiss timeout in milliseconds
const NOTIFICATION_AUTO_DISMISS_MS = 5000

// Number of recent downloads to show in tray menu
const MAX_RECENT_DOWNLOADS = 5

interface CompletedDownload {
  id: string
  title: string
  filePath?: string
  completedAt: number
}

export class TrayManager {
  private tray: Tray | null = null
  private queueManager: QueueManager
  private mainWindow: BrowserWindow | null = null
  private lastTrayUpdate = 0
  private readonly TRAY_UPDATE_THROTTLE = 1000
  private unreadCompletedCount = 0
  private activeNotifications: Notification[] = []
  private recentDownloads: CompletedDownload[] = []
  private downloadPath: string = ''

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  setDownloadPath(path: string): void {
    this.downloadPath = path
  }

  /**
   * Clear the unread notification count and update taskbar overlay
   * Should be called when user views the downloads tab
   */
  clearUnreadCount(): void {
    this.unreadCompletedCount = 0
    this.updateTaskbarOverlay()
  }

  /**
   * Update the taskbar overlay icon with the current count
   */
  private updateTaskbarOverlay(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    if (this.unreadCompletedCount === 0) {
      // Clear the overlay
      this.mainWindow.setOverlayIcon(null, '')
      return
    }

    // Create a small icon with the count
    const count = Math.min(this.unreadCompletedCount, 99) // Cap at 99
    const text = count > 99 ? '99+' : count.toString()

    // Create a canvas to draw the badge
    const size = 16 // Small size for taskbar overlay
    const canvas = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="#ef4444"/>
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
              fill="white" font-family="Arial, sans-serif" font-weight="bold"
              font-size="${text.length > 1 ? 8 : 10}">${text}</text>
      </svg>
    `

    try {
      // Create nativeImage from SVG
      const icon = nativeImage.createFromBuffer(Buffer.from(canvas))
      if (!icon.isEmpty()) {
        this.mainWindow.setOverlayIcon(icon, `${this.unreadCompletedCount} completed downloads`)
      }
    } catch (error) {
      logger.error('Failed to create overlay icon', error instanceof Error ? error : String(error))
    }
  }

  async initialize(): Promise<void> {
    if (this.tray) return

    // Use the app icon as base
    const iconPath = this.getAppIconPath()
    this.tray = new Tray(iconPath)

    this.updateTrayMenu()
    this.updateTrayTooltip('Grab - Idle')

    // Handle tray click
    this.tray.on('click', () => {
      this.showWindow()
    })

    // Double click to open window
    this.tray.on('double-click', () => {
      this.showWindow()
    })

    // Set up queue update listener
    this.queueManager.on('update', (status: QueueStatus) => {
      this.throttledUpdate(status)
    })

    // Listen for item completion to show notifications
    this.queueManager.on('itemComplete', (item: {
      id: string
      title: string
      url: string
      thumbnail?: string
      filePath?: string
      audioOnly: boolean
    }) => {
      this.showDownloadCompleteNotification(item.title)
      // Increment unread count and update taskbar overlay
      this.unreadCompletedCount++
      this.updateTaskbarOverlay()

      // Add to recent downloads
      this.addToRecentDownloads({
        id: item.id,
        title: item.title,
        filePath: item.filePath,
        completedAt: Date.now(),
      })
    })
  }

  private addToRecentDownloads(download: CompletedDownload): void {
    // Add to beginning of array
    this.recentDownloads.unshift(download)
    // Keep only the most recent
    if (this.recentDownloads.length > MAX_RECENT_DOWNLOADS) {
      this.recentDownloads = this.recentDownloads.slice(0, MAX_RECENT_DOWNLOADS)
    }
  }

  private throttledUpdate(status: QueueStatus): void {
    const now = Date.now()
    if (now - this.lastTrayUpdate < this.TRAY_UPDATE_THROTTLE) {
      return
    }
    this.lastTrayUpdate = now
    this.updateTrayMenu()
    this.updateTooltip(status)
  }

  private updateTooltip(status: QueueStatus): void {
    if (!this.tray) return

    const isDownloading = status.isProcessing
    const isPaused = status.isPaused
    const pendingCount = status.items.filter(i => i.status === 'pending').length
    const completedCount = status.items.filter(i => i.status === 'completed').length
    const failedCount = status.items.filter(i => i.status === 'failed').length
    const totalCount = status.items.length

    let tooltip = 'Grab'

    if (isPaused) {
      tooltip += ' - Paused'
    } else if (isDownloading) {
      const currentItem = status.items.find(i => i.id === status.currentItemId)
      const progress = currentItem?.progress?.percent ?? 0
      const speed = currentItem?.progress?.speed
      tooltip += ` - Downloading (${Math.round(progress)}%)`
      if (speed) {
        tooltip += ` ${this.formatSpeed(speed)}`
      }
    }

    if (totalCount > 0) {
      tooltip += `\nQueue: ${completedCount}/${totalCount}`
      if (pendingCount > 0) {
        tooltip += ` (${pendingCount} pending)`
      }
      if (failedCount > 0) {
        tooltip += ` [${failedCount} failed]`
      }
    }

    this.tray.setToolTip(tooltip)
  }

  private formatSpeed(bytesPerSecond: number | string): string {
    // If already a string, return it
    if (typeof bytesPerSecond === 'string') return bytesPerSecond

    if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  }

  private truncateTitle(title: string, maxLength: number = 40): string {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength - 3) + '...'
  }

  private updateTrayMenu(): void {
    if (!this.tray) return

    const status = this.queueManager.getStatus()
    const isPaused = status.isPaused
    const isDownloading = status.isProcessing
    const hasItems = status.items.length > 0
    const pendingCount = status.items.filter(i => i.status === 'pending').length
    const completedCount = status.items.filter(i => i.status === 'completed').length
    const failedCount = status.items.filter(i => i.status === 'failed').length

    const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = []

    // Current download section
    if (isDownloading) {
      const currentItem = status.items.find(i => i.id === status.currentItemId)
      if (currentItem) {
        const progress = Math.round(currentItem.progress?.percent ?? 0)
        const speed = currentItem.progress?.speed ? this.formatSpeed(currentItem.progress.speed) : ''
        template.push({
          label: `Now: ${this.truncateTitle(currentItem.title, 30)}`,
          enabled: false,
        })
        template.push({
          label: `   ${this.createProgressBar(progress)} ${progress}% ${speed}`,
          enabled: false,
        })
        template.push({ type: 'separator' })
      }
    }

    // Queue stats
    if (hasItems) {
      template.push({
        label: `Queue: ${completedCount}/${status.items.length} completed`,
        enabled: false,
      })
      if (pendingCount > 0) {
        template.push({
          label: `   ${pendingCount} pending`,
          enabled: false,
        })
      }
      if (failedCount > 0) {
        template.push({
          label: `   ${failedCount} failed`,
          enabled: false,
        })
      }
      template.push({ type: 'separator' })
    }

    // Recent downloads
    if (this.recentDownloads.length > 0) {
      template.push({
        label: 'Recent Downloads',
        enabled: false,
      })
      for (const download of this.recentDownloads) {
        const label = this.truncateTitle(download.title, 35)
        template.push({
          label: `   ${label}`,
          click: () => {
            if (download.filePath) {
              shell.showItemInFolder(download.filePath)
            } else {
              this.showWindow()
            }
          },
        })
      }
      template.push({ type: 'separator' })
    }

    // Main actions
    template.push({
      label: 'Open Grab',
      click: () => this.showWindow(),
    })

    template.push({
      label: 'Open Download Folder',
      click: () => {
        if (this.downloadPath) {
          shell.openPath(this.downloadPath)
        }
      },
    })

    template.push({ type: 'separator' })

    // Queue controls
    template.push({
      label: isPaused ? '▶ Resume All' : '⏸ Pause All',
      enabled: hasItems,
      click: () => {
        if (isPaused) {
          this.queueManager.resume()
        } else {
          this.queueManager.pause()
        }
      },
    })

    if (failedCount > 0) {
      template.push({
        label: `↻ Retry ${failedCount} Failed`,
        click: () => {
          this.queueManager.retryAllFailed()
        },
      })
    }

    template.push({ type: 'separator' })

    // Quit
    template.push({
      label: 'Quit Grab',
      click: () => {
        // Destroy the window first to bypass close-to-tray prevention
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.destroy()
        }
        // Destroy tray
        this.destroy()
        // Now quit the app
        app.quit()
      },
    })

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  private createProgressBar(percent: number, width: number = 10): string {
    const filled = Math.round((percent / 100) * width)
    const empty = width - filled
    return '█'.repeat(filled) + '░'.repeat(empty)
  }

  private updateTrayTooltip(text: string): void {
    if (!this.tray) return
    this.tray.setToolTip(text)
  }

  private showWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  private showDownloadCompleteNotification(title: string): void {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'Download Complete',
          body: title,
          icon: this.getAppIconPath(),
          silent: false,
        })

        notification.on('click', () => {
          this.showWindow()
          // Clear badge when user clicks notification
          this.clearUnreadCount()
        })

        notification.on('close', () => {
          // Remove from active notifications list
          const index = this.activeNotifications.indexOf(notification)
          if (index > -1) {
            this.activeNotifications.splice(index, 1)
          }
        })

        notification.show()
        this.activeNotifications.push(notification)
        logger.info('Notification shown', title)

        // Auto-dismiss after timeout
        setTimeout(() => {
          if (this.activeNotifications.includes(notification)) {
            notification.close()
          }
        }, NOTIFICATION_AUTO_DISMISS_MS)
      }
    } catch (error) {
      logger.error('Failed to show notification', error instanceof Error ? error : String(error))
    }
  }

  private getAppIconPath(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
      return path.join(process.cwd(), 'assets', 'icon.png')
    }
    return path.join(process.resourcesPath, 'assets', 'icon.png')
  }

  destroy(): void {
    // Close all active notifications
    for (const notification of this.activeNotifications) {
      notification.close()
    }
    this.activeNotifications = []

    // Clear overlay
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setOverlayIcon(null, '')
    }

    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  static isTraySupported(): boolean {
    return true // Tray is supported on all platforms
  }
}
