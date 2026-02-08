import { app, BrowserWindow, ipcMain, dialog, shell, Menu, MenuItem } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { Downloader } from './downloader'
import { QueueManager, QueueStatus } from './queueManager'
import { startHttpServer } from './httpServer'
import { logger } from './logger'
import { binaryManager } from './binaryManager'
import * as http from 'http'

interface StoreData {
  settings: Record<string, unknown>
  history: Array<Record<string, unknown>>
}

class SimpleStore {
  private data: StoreData
  private filePath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, 'config.json')
    this.data = this.load()
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (err) {
      console.error('Failed to load store:', err)
    }
    return { settings: {}, history: [] }
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
    this.data[key] = value
    this.save()
  }
}

let store: SimpleStore
let mainWindow: BrowserWindow | null = null
let downloader: Downloader | null = null
let queueManager: QueueManager | null = null
let httpServer: http.Server | null = null

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
    defaultQuality: '1080p',
    defaultFormat: 'mp4',
    organizeByType: true,
    autoStartDownload: false,
    maxConcurrentDownloads: 1,
    delayBetweenDownloads: 2000,
    theme: 'dark',
    fontSize: 'medium',
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
  audioOnly: boolean
  source: 'app' | 'extension'
}) => {
  if (!queueManager) throw new Error('Queue manager not initialized')

  // Update queue manager with current settings
  const settings = store.get('settings')
  queueManager.setDownloadPath(settings.downloadPath as string || getDefaultDownloadPath())
  queueManager.setSettings({
    organizeByType: settings.organizeByType as boolean ?? true,
    delayBetweenDownloads: settings.delayBetweenDownloads as number ?? 2000,
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

ipcMain.handle('queue:retry', (_event, id: string) => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.retryItem(id)
})

ipcMain.handle('queue:retryAllFailed', () => {
  if (!queueManager) throw new Error('Queue manager not initialized')
  return queueManager.retryAllFailed()
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
