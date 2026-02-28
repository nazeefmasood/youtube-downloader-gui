import { Tray, Menu, nativeImage, BrowserWindow, app, Notification } from 'electron'
import * as path from 'path'
import { QueueManager, QueueStatus } from './queueManager'
import { logger } from './logger'

// Notification auto-dismiss timeout in milliseconds
const NOTIFICATION_AUTO_DISMISS_MS = 5000

export class TrayManager {
  private tray: Tray | null = null
  private queueManager: QueueManager
  private mainWindow: BrowserWindow | null = null
  private lastTrayUpdate = 0
  private readonly TRAY_UPDATE_THROTTLE = 1000
  private unreadCompletedCount = 0
  private activeNotifications: Notification[] = []

  // Emojis for different states (works cross-platform)
  private readonly ICON_IDLE = '' // Use app icon
  private readonly ICON_DOWNLOADING = '' // Use app icon
  private readonly ICON_PAUSED = ''

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
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
    this.updateTrayTooltip('VidGrab - Idle')

    // Handle tray click
    this.tray.on('click', () => {
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
    })
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
    const totalCount = status.items.length

    let tooltip = 'VidGrab'

    if (isPaused) {
      tooltip += ' - Paused'
    } else if (isDownloading) {
      const currentItem = status.items.find(i => i.id === status.currentItemId)
      const progress = currentItem?.progress?.percent ?? 0
      tooltip += ` - Downloading (${Math.round(progress)}%)`
    }

    if (totalCount > 0) {
      tooltip += `\nQueue: ${completedCount}/${totalCount}`
      if (pendingCount > 0) {
        tooltip += ` (${pendingCount} pending)`
      }
    }

    this.tray.setToolTip(tooltip)
  }

  private updateTrayMenu(): void {
    if (!this.tray) return

    const status = this.queueManager.getStatus()
    const isPaused = status.isPaused
    const hasItems = status.items.length > 0

    const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
      {
        label: 'Open VidGrab',
        click: () => this.showWindow(),
      },
      { type: 'separator' },
      {
        label: isPaused ? 'Resume All' : 'Pause All',
        enabled: hasItems,
        click: () => {
          if (isPaused) {
            this.queueManager.resume()
          } else {
            this.queueManager.pause()
          }
        },
      },
      {
        label: 'Show Downloads',
        enabled: hasItems,
        click: () => this.showWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
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
