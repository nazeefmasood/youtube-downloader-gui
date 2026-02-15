import { app, BrowserWindow, ipcMain, dialog, shell, Menu, MenuItem } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { Downloader } from './downloader'
import { QueueManager, QueueStatus } from './queueManager'
import { startHttpServer } from './httpServer'
import { startPotTokenServer, cleanupPotTokenServer, getPotTokenStatus } from './potTokenServer'
import { logger } from './logger'
import { binaryManager } from './binaryManager'
import { updater, UpdateInfo, UpdateProgress } from './updater'
import * as http from 'http'

interface StoreData {
  settings: Record<string, unknown>
  history: Array<Record<string, unknown>>
  updateState: {
    lastVersionLaunched: string
    lastUpdateCheck: string | null
    updateSkippedVersion: string | null
    changelogSeenForVersion: string
  }
}

class SimpleStore {
  private data: StoreData
  private filePath: string
  private readonly maxHistorySize = 100

  constructor() {
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, 'config.json')
    this.data = this.load()
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        const data = JSON.parse(content)
        // Ensure updateState exists with defaults
        return {
          settings: {},
          history: [],
          updateState: {
            lastVersionLaunched: app.getVersion(),
            lastUpdateCheck: null,
            updateSkippedVersion: null,
            changelogSeenForVersion: app.getVersion(),
          },
          ...data,
        }
      }
    } catch (err) {
      console.error('Failed to load store:', err)
    }
    return {
      settings: {},
      history: [],
      updateState: {
        lastVersionLaunched: app.getVersion(),
        lastUpdateCheck: null,
        updateSkippedVersion: null,
        changelogSeenForVersion: app.getVersion(),
      },
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
    } catch (err) {
      console.error('Failed to save store:', err)
    }
  }

  get<K extends keyof StoreData>(key: K): StoreData[K] {
    return this.data[key]
  }

  set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    // Enforce history size limit in memory, not just on save
    if (key === 'history' && Array.isArray(value)) {
      this.data[key] = value.slice(0, this.maxHistorySize) as StoreData[K]
    } else {
      this.data[key] = value
    }
    this.save()
  }
}

let store: SimpleStore
let mainWindow: BrowserWindow | null = null
let downloader: Downloader | null = null
let queueManager: QueueManager | null = null
let httpServer: http.Server | null = null
let potStatusInterval: NodeJS.Timeout | null = null

function getIconPath(): string {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  if (isDev) {
    return path.join(process.cwd(), 'assets', 'icon.png')
  }
  return path.join(process.resourcesPath, 'assets', 'icon.png')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Wait for page to load before checking for updates
  mainWindow.webContents.once('did-finish-load', () => {
    // Check for changelog display
    const updateState = store.get('updateState')
    const currentVersion = app.getVersion()
    if (updateState.lastVersionLaunched !== currentVersion) {
      // First launch after update - show changelog
      mainWindow?.webContents.send('update:show-changelog', currentVersion)
      store.set('updateState', { ...updateState, lastVersionLaunched: currentVersion })
    }

    // Check for updates after page is fully loaded
    setTimeout(() => {
      console.log('[INFO] Checking for updates...')
      updater.checkForUpdates().then((info) => {
        if (info) {
          console.log('[INFO] Update available:', info.version)
        } else {
          console.log('[INFO] No updates available')
        }
      }).catch((err) => {
        console.error('[ERROR] Update check failed:', err)
      })
    }, 2000)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Add context menu for copy/paste
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()

    if (params.isEditable) {
      if (params.selectionText) {
        menu.append(new MenuItem({ label: 'Cut', role: 'cut' }))
        menu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
      }
      menu.append(new MenuItem({ label: 'Paste', role: 'paste' }))
      if (params.selectionText) {
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }))
      }
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
    }

    if (menu.items.length > 0) menu.popup()
  })

  // Initialize downloader
  downloader = new Downloader()

  // Initialize queue manager
  queueManager = new QueueManager()

  // Set up queue manager listeners
  queueManager.on('update', (status: QueueStatus) => {
    mainWindow?.webContents.send('queue:update', status)
  })

  // Add completed queue items to history
  queueManager.on('itemComplete', (item: {
    id: string
    title: string
    url: string
    thumbnail?: string
    filePath?: string
    audioOnly: boolean
  }) => {
    const historyItem = {
      id: `queue-${item.id}-${Date.now()}`,
      title: item.title,
      url: item.url,
      thumbnail: item.thumbnail,
      downloadDate: new Date().toISOString(),
      filePath: item.filePath || '',
      status: 'completed',
      type: item.audioOnly ? 'audio' : 'video',
    }
    const history = store.get('history')
    history.unshift(historyItem)
    store.set('history', history.slice(0, 100))
    logger.info('Added to history', item.title)
    // Notify frontend to update history
    mainWindow?.webContents.send('history:added', historyItem)
  })

  // Start HTTP server for extension communication
  startHttpServer(queueManager).then((server) => {
    httpServer = server
    console.log('HTTP server started for extension communication')
  }).catch((error) => {
    console.error('Failed to start HTTP server:', error)
  })

  // Start PO Token server
  const settings = store.get('settings')
  const potEnabled = (settings.potTokenEnabled as boolean) ?? true
  if (potEnabled) {
    const potPort = (settings.potTokenPort as number) || 4416
    const potTTL = (settings.potTokenTTL as number) || 360
    startPotTokenServer(potPort, potTTL).then(() => {
      console.log('[INFO] PO token server started')
    }).catch((error) => {
      console.error('[ERROR] Failed to start PO token server:', error)
    })
  }

  // Send PO token status to renderer every 30s
  potStatusInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pot:status', getPotTokenStatus())
    }
  }, 30000)

  // Set up updater event listeners
  updater.on('checking', () => {
    mainWindow?.webContents.send('update:checking')
  })

  updater.on('available', (info: UpdateInfo) => {
    mainWindow?.webContents.send('update:available', info)
  })

  updater.on('not-available', () => {
    mainWindow?.webContents.send('update:not-available')
    // Update last check time
    const updateState = store.get('updateState')
    store.set('updateState', { ...updateState, lastUpdateCheck: new Date().toISOString() })
  })

  updater.on('progress', (progress: UpdateProgress) => {
    mainWindow?.webContents.send('update:progress', progress)
  })

  updater.on('downloaded', (filePath: string) => {
    mainWindow?.webContents.send('update:downloaded', filePath)
  })

  updater.on('error', (error: string) => {
    mainWindow?.webContents.send('update:error', error)
  })

  updater.on('cancelled', () => {
    mainWindow?.webContents.send('update:cancelled')
  })

  updater.on('linux-deb', (filePath: string) => {
    mainWindow?.webContents.send('update:linux-deb', filePath)
  })

  updater.on('linux-appimage', (filePath: string) => {
    mainWindow?.webContents.send('update:linux-appimage', filePath)
  })
}

app.whenReady().then(() => {
  store = new SimpleStore()
  logger.logStartup()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Cleanup function to close all resources
function cleanup() {
  if (potStatusInterval) {
    clearInterval(potStatusInterval)
    potStatusInterval = null
  }
  cleanupPotTokenServer()
  if (httpServer) {
    try {
      httpServer.close()
      httpServer = null
      console.log('[INFO] HTTP server closed')
    } catch (err) {
      console.error('Error closing HTTP server:', err)
    }
  }
  if (queueManager) {
    queueManager.removeAllListeners()
  }
  if (downloader) {
    downloader.removeAllListeners()
  }
}

app.on('window-all-closed', () => {
  cleanup()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanup()
})

app.on('will-quit', () => {
  cleanup()
})

// Window control IPC handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false
})

// URL Detection
ipcMain.handle('url:detect', async (_event, url: string) => {
  if (!downloader) {
    logger.error('URL detection failed', 'Downloader not initialized')
    throw new Error('Downloader not initialized')
  }
  try {
    logger.info('Detecting URL', url)
    const result = await downloader.detectUrl(url)
    logger.info('URL detection successful', `Type: ${result.type}, Title: ${result.title}`)
    return result
  } catch (error) {
    logger.error('URL detection failed', error instanceof Error ? error : String(error))
    throw error
  }
})

// Cancel URL Detection
ipcMain.handle('url:cancelDetect', () => {
  if (!downloader) throw new Error('Downloader not initialized')
  downloader.cancelDetection()
})

// Get formats
ipcMain.handle('formats:get', async (_event, url: string) => {
  if (!downloader) {
    logger.error('Get formats failed', 'Downloader not initialized')
    throw new Error('Downloader not initialized')
  }
  try {
    logger.info('Fetching formats', url)
    const formats = await downloader.getFormats(url)
    logger.info('Formats fetched successfully', `Found ${formats.length} formats`)
    return formats
  } catch (error) {
    logger.error('Get formats failed', error instanceof Error ? error : String(error))
    throw error
  }
})

// Get subtitles
ipcMain.handle('subtitles:get', async (_event, url: string) => {
  if (!downloader) {
    logger.error('Get subtitles failed', 'Downloader not initialized')
    throw new Error('Downloader not initialized')
  }
  try {
    logger.info('Fetching subtitles', url)
    const subtitles = await downloader.getSubtitles(url)
    logger.info('Subtitles fetched successfully', `Found ${subtitles.length} tracks`)
    return subtitles
  } catch (error) {
    logger.error('Get subtitles failed', error instanceof Error ? error : String(error))
    throw error
  }
})

// Start download
ipcMain.handle('download:start', async (_event, options: {
  url: string
  format: string
  audioOnly?: boolean
  outputPath?: string
}) => {
  if (!downloader) throw new Error('Downloader not initialized')

  const settings = store.get('settings')
  const outputPath = options.outputPath || settings.downloadPath as string || getDefaultDownloadPath()

  // Remove old listeners before adding new ones
  downloader.removeAllListeners()

  downloader.on('progress', (progress) => {
    mainWindow?.webContents.send('download:progress', progress)
  })

  downloader.on('complete', (result) => {
    mainWindow?.webContents.send('download:complete', result)
  })

  downloader.on('videoComplete', (videoInfo) => {
    mainWindow?.webContents.send('download:videoComplete', videoInfo)
  })

  downloader.on('error', (error) => {
    mainWindow?.webContents.send('download:error', error)
  })

  await downloader.download({
    ...options,
    outputPath,
    organizeByType: settings.organizeByType as boolean ?? true,
    delayBetweenDownloads: settings.delayBetweenDownloads as number ?? 2000,
  })
})

// Cancel download
ipcMain.handle('download:cancel', async () => {
  if (!downloader) throw new Error('Downloader not initialized')
  downloader.cancel()
})

// Settings
ipcMain.handle('settings:get', () => {
  const defaults = {
    downloadPath: getDefaultDownloadPath(),
    defaultQuality: 'Best Quality',
    defaultFormat: 'mp4',
    organizeByType: true,
    autoStartDownload: false,
    autoBestQuality: true,
    maxConcurrentDownloads: 1,
    delayBetweenDownloads: 3000,
    theme: 'dark',
    fontSize: 'medium',
    batchSize: 25,
    batchPauseShort: 5,
    batchPauseLong: 10,
    batchDownloadEnabled: true,
    potTokenEnabled: true,
    potTokenPort: 4416,
    potTokenTTL: 360,
  }
  return { ...defaults, ...store.get('settings') }
})

ipcMain.handle('settings:save', (_event, settings: Record<string, unknown>) => {
  const current = store.get('settings')
  store.set('settings', { ...current, ...settings })
})

// History
ipcMain.handle('history:get', () => {
  return store.get('history')
})

ipcMain.handle('history:add', (_event, item: Record<string, unknown>) => {
  const history = store.get('history')
  history.unshift(item)
  store.set('history', history.slice(0, 100))
})

ipcMain.handle('history:remove', (_event, id: string) => {
  const history = store.get('history') as Array<{ id: string }>
  store.set('history', history.filter(item => item.id !== id))
})

ipcMain.handle('history:clear', () => {
  store.set('history', [])
})

// File operations
ipcMain.handle('file:open', async (_event, filePath: string) => {
  await shell.openPath(filePath)
})

ipcMain.handle('file:showInFolder', async (_event, filePath: string) => {
  const fs = await import('fs')
  const stats = await fs.promises.stat(filePath).catch(() => null)

  if (stats?.isDirectory()) {
    // If it's a directory, open it directly
    await shell.openPath(filePath)
  } else {
    // If it's a file, show it in folder
    shell.showItemInFolder(filePath)
  }
})

ipcMain.handle('folder:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

function getDefaultDownloadPath(): string {
  const home = app.getPath('home')
  return path.join(home, 'Downloads', 'Youtube Downloads')
}

// Queue IPC handlers
ipcMain.handle('queue:get', () => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.getStatus()
})

ipcMain.handle('queue:add', (_event, item: {
  url: string
  title: string
  thumbnail?: string
  format: string
  qualityLabel?: string
  audioOnly: boolean
  source: 'app' | 'extension'
  sourceType?: 'single' | 'playlist' | 'channel'
  contentType?: 'video' | 'audio' | 'subtitle' | 'video+sub'
  subtitleOptions?: {
    enabled: boolean
    languages: string[]
    includeAutoGenerated: boolean
    format: 'srt' | 'vtt' | 'ass'
    embedInVideo: boolean
  }
  subtitleDisplayNames?: string
  batchGroupId?: string
}) => {
  if (!queueManager) throw new Error('Queue manager not initialized')

  // Update queue manager with current settings
  const settings = store.get('settings')
  queueManager.setDownloadPath(settings.downloadPath as string || getDefaultDownloadPath())
  queueManager.setSettings({
    organizeByType: settings.organizeByType as boolean ?? true,
    delayBetweenDownloads: settings.delayBetweenDownloads as number ?? 2000,
    batchSize: settings.batchSize as number ?? 25,
    batchPauseShort: settings.batchPauseShort as number ?? 5,
    batchPauseLong: settings.batchPauseLong as number ?? 10,
    batchDownloadEnabled: settings.batchDownloadEnabled as boolean ?? true,
  })

  return queueManager.addItem(item)
})

ipcMain.handle('queue:remove', (_event, id: string) => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.removeItem(id)
})

ipcMain.handle('queue:cancel', (_event, id: string) => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.cancelItem(id)
})

ipcMain.handle('queue:pause', () => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  queueManager.pause()
})

ipcMain.handle('queue:resume', () => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  queueManager.resume()
})

ipcMain.handle('queue:clear', () => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  queueManager.clear()
})

ipcMain.handle('queue:pauseItem', (_event, id: string) => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.pauseItem(id)
})

ipcMain.handle('queue:resumeItem', (_event, id: string) => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.resumeItem(id)
})

ipcMain.handle('queue:retry', (_event, id: string) => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.retryItem(id)
})

ipcMain.handle('queue:retryAllFailed', () => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.retryAllFailed()
})

// PO Token IPC handlers
ipcMain.handle('pot:getStatus', () => {
  return getPotTokenStatus()
})

ipcMain.handle('pot:restart', async () => {
  cleanupPotTokenServer()
  const settings = store.get('settings')
  const potPort = (settings.potTokenPort as number) || 4416
  const potTTL = (settings.potTokenTTL as number) || 360
  await startPotTokenServer(potPort, potTTL)
})

// Logger IPC handlers
ipcMain.handle('logger:getErrors', () => {
  return logger.getRecentErrors()
})

ipcMain.handle('logger:openLogFile', () => {
  const logPath = logger.getLogFilePath()
  if (logPath) {
    shell.showItemInFolder(logPath)
  }
})

// Binary management IPC handlers
ipcMain.handle('binary:check', () => {
  return binaryManager.isBinaryInstalled()
})

ipcMain.handle('binary:download', async () => {
  return await binaryManager.downloadBinary(mainWindow)
})

ipcMain.handle('binary:status', () => {
  return binaryManager.getBinaryStatus()
})

// FFmpeg IPC handlers
ipcMain.handle('ffmpeg:check', () => {
  return binaryManager.isFfmpegInstalled()
})

ipcMain.handle('ffmpeg:download', async () => {
  const result = await binaryManager.downloadFfmpeg(mainWindow)
  if (result && downloader) {
    // Refresh ffmpeg path in downloader after successful download
    downloader.refreshFfmpegPath()
  }
  return result
})

ipcMain.handle('ffmpeg:path', () => {
  return binaryManager.getFfmpegPath()
})

// Update IPC handlers
ipcMain.handle('update:check', async () => {
  return await updater.checkForUpdates()
})

ipcMain.handle('update:download', async () => {
  return await updater.downloadUpdate()
})

ipcMain.handle('update:install', async () => {
  return await updater.installUpdate()
})

ipcMain.handle('update:getStatus', () => {
  return updater.getStatus()
})

ipcMain.handle('update:cancel', () => {
  updater.cancelDownload()
})

ipcMain.handle('update:getChangelog', (_event, body: string, version: string) => {
  return updater.parseChangelog(body, version)
})

ipcMain.handle('update:markChangelogSeen', () => {
  const updateState = store.get('updateState')
  store.set('updateState', {
    ...updateState,
    changelogSeenForVersion: app.getVersion(),
  })
})

ipcMain.handle('update:getUpdateState', () => {
  return store.get('updateState')
})

ipcMain.handle('update:skipVersion', (_event, version: string) => {
  const updateState = store.get('updateState')
  store.set('updateState', {
    ...updateState,
    updateSkippedVersion: version,
  })
})

ipcMain.handle('update:reset', () => {
  updater.reset()
})

// Empty changelog fallback
const getEmptyChangelog = (version: string) => ({
  version,
  date: new Date().toISOString(),
  sections: {
    added: [] as string[],
    changed: [] as string[],
    fixed: [] as string[],
    removed: [] as string[],
  },
})

// Parse local CHANGELOG.md file - returns all versions
function parseLocalChangelog(): ReturnType<typeof getEmptyChangelog>[] {
  try {
    // Try to find CHANGELOG.md in different locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'CHANGELOG.md'), // Production (extraResources)
      path.join(process.resourcesPath, 'app', 'CHANGELOG.md'), // Production alt
      path.join(__dirname, '..', 'CHANGELOG.md'), // Production alt
      path.join(__dirname, '../../CHANGELOG.md'), // Production alt 2
      path.join(path.dirname(app.getPath('exe')), 'resources', 'CHANGELOG.md'), // Windows installed
      path.join(app.getAppPath(), 'CHANGELOG.md'), // App path
      path.join(process.cwd(), 'CHANGELOG.md'), // Development
    ]

    logger.info('Searching for CHANGELOG.md...')
    for (const p of possiblePaths) {
      logger.info(`Checking path: ${p}`)
      if (fs.existsSync(p)) {
        logger.info(`Found CHANGELOG.md at: ${p}`)
        const content = fs.readFileSync(p, 'utf-8')
        return parseChangelogContent(content)
      }
    }

    logger.warn('CHANGELOG.md not found in any location')
    return []
  } catch (err) {
    logger.error('Failed to parse changelog', err instanceof Error ? err.message : String(err))
    return []
  }
}

// Parse changelog content string
function parseChangelogContent(content: string): ReturnType<typeof getEmptyChangelog>[] {
  try {
    const versions: ReturnType<typeof getEmptyChangelog>[] = []

    // Split by version headers
    const versionRegex = /## \[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/g
    let match
    const sections = content.split(/## \[[^\]]+\]/)

    // First section is the header, skip it
    let sectionIndex = 1

    while ((match = versionRegex.exec(content)) !== null) {
      const version = match[1]
      const date = match[2]
      const sectionContent = sections[sectionIndex] || ''

      // Parse each subsection
      const parseSection = (header: string): string[] => {
        const sectionRegex = new RegExp(`### ${header}\\n([\\s\\S]*?)(?=### |## |$)`, 'i')
        const sectionMatch = sectionContent.match(sectionRegex)
        if (!sectionMatch) return []

        return sectionMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('- '))
          .map(line => line.substring(2).trim())
          .filter(line => line.length > 0)
      }

      const versionData = {
        version,
        date,
        sections: {
          added: parseSection('Added'),
          changed: parseSection('Changed'),
          fixed: parseSection('Fixed'),
          removed: parseSection('Removed'),
        },
      }

      // Only add if there's at least some content
      if (versionData.sections.added.length > 0 ||
          versionData.sections.changed.length > 0 ||
          versionData.sections.fixed.length > 0 ||
          versionData.sections.removed.length > 0) {
        versions.push(versionData)
      }

      sectionIndex++
    }

    logger.info('Changelog loaded', `${versions.length} versions`)
    return versions
  } catch (err) {
    logger.error('Failed to parse changelog content', err instanceof Error ? err.message : String(err))
    return []
  }
}

// Fetch changelog from local file only
ipcMain.handle('update:fetchChangelog', async () => {
  return parseLocalChangelog()
})
