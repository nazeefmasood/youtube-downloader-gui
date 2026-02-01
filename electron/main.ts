import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { Downloader } from './downloader'

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
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Initialize downloader
  downloader = new Downloader()
}

app.whenReady().then(() => {
  store = new SimpleStore()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
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
  if (!downloader) throw new Error('Downloader not initialized')
  return await downloader.detectUrl(url)
})

// Cancel URL Detection
ipcMain.handle('url:cancelDetect', () => {
  if (!downloader) throw new Error('Downloader not initialized')
  downloader.cancelDetection()
})

// Get formats
ipcMain.handle('formats:get', async (_event, url: string) => {
  if (!downloader) throw new Error('Downloader not initialized')
  return await downloader.getFormats(url)
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
  shell.showItemInFolder(filePath)
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
