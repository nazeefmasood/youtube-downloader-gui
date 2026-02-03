import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import { app, BrowserWindow } from 'electron'
import { logger } from './logger'

const YTDLP_VERSION = '2024.12.23'

interface BinaryInfo {
  name: string
  url: string
  path: string
  executable: boolean
}

// ... (imports remain the same)

export class BinaryManager {
  private bundledPath: string
  private userDataPath: string

  constructor() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

    // Bundled path (read-only in production)
    if (isDev) {
      this.bundledPath = path.join(process.cwd(), 'binaries')
    } else {
      this.bundledPath = path.join(process.resourcesPath, 'binaries')
    }

    // User data path (writable)
    this.userDataPath = path.join(app.getPath('userData'), 'binaries')
  }

  private getBinaryInfo(): BinaryInfo {
    const platform = process.platform
    let binaryName: string
    let url: string

    if (platform === 'win32') {
      binaryName = 'yt-dlp.exe'
      url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp.exe`
    } else if (platform === 'darwin') {
      binaryName = 'yt-dlp-macos'
      url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_macos`
    } else {
      binaryName = 'yt-dlp-linux'
      url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux`
    }

    // effectivePath will be determined by what exists, but default to userData for new downloads
    return {
      name: binaryName,
      url,
      path: path.join(this.userDataPath, binaryName), // Default download target
      executable: platform !== 'win32',
    }
  }

  isBinaryInstalled(): boolean {
    const binary = this.getBinaryInfo()

    // Check bundled path first
    const bundledPath = path.join(this.bundledPath, binary.name)
    if (fs.existsSync(bundledPath)) {
      logger.info('Binary check', `Found bundled binary at ${bundledPath}`)
      return true
    }

    // Check user data path
    const userDataPath = path.join(this.userDataPath, binary.name)
    const exists = fs.existsSync(userDataPath)
    logger.info('Binary check', `${binary.name}: ${exists ? 'found' : 'not found'} at ${userDataPath}`)
    return exists
  }

  async downloadBinary(mainWindow: BrowserWindow | null): Promise<boolean> {
    const binary = this.getBinaryInfo()

    logger.info('Starting binary download', binary.url)

    try {
      // Ensure binaries directory exists in userData
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true })
      }

      // Notify UI that download is starting
      mainWindow?.webContents.send('binary:download-start', {
        name: binary.name,
      })

      return new Promise((resolve) => {
        const downloadFile = (url: string, redirectCount = 0): void => {
          if (redirectCount > 5) {
            const error = 'Too many redirects'
            logger.error('Binary download failed', error)
            mainWindow?.webContents.send('binary:download-error', { error })
            resolve(false)
            return
          }

          https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
              const redirectUrl = response.headers.location
              if (redirectUrl) {
                logger.info('Following redirect', redirectUrl)
                downloadFile(redirectUrl, redirectCount + 1)
                return
              }
            }

            if (response.statusCode !== 200) {
              const error = `HTTP error: ${response.statusCode}`
              logger.error('Binary download failed', error)
              mainWindow?.webContents.send('binary:download-error', { error })
              resolve(false)
              return
            }

            const totalSize = parseInt(response.headers['content-length'] || '0', 10)
            let downloadedSize = 0

            // Always download to userDataPath (writable)
            const targetPath = path.join(this.userDataPath, binary.name)
            const file = fs.createWriteStream(targetPath)

            response.on('data', (chunk: Buffer) => {
              downloadedSize += chunk.length
              const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0
              mainWindow?.webContents.send('binary:download-progress', {
                percent,
                downloaded: downloadedSize,
                total: totalSize,
              })
            })

            response.pipe(file)

            file.on('finish', () => {
              file.close()

              // Make executable on Unix systems
              if (binary.executable) {
                try {
                  fs.chmodSync(targetPath, 0o755)
                } catch (err) {
                  logger.error('Failed to make binary executable', err instanceof Error ? err : String(err))
                }
              }

              logger.info('Binary download complete', targetPath)
              mainWindow?.webContents.send('binary:download-complete', {
                path: targetPath,
              })
              resolve(true)
            })

            file.on('error', (err) => {
              try {
                fs.unlinkSync(targetPath)
              } catch (e) { /* ignore */ }

              const error = err.message
              logger.error('Binary download failed', error)
              mainWindow?.webContents.send('binary:download-error', { error })
              resolve(false)
            })
          }).on('error', (err) => {
            logger.error('Binary download failed', err)
            mainWindow?.webContents.send('binary:download-error', {
              error: err.message,
            })
            resolve(false)
          })
        }

        downloadFile(binary.url)
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.error('Binary download setup failed', error)
      mainWindow?.webContents.send('binary:download-error', { error })
      return false
    }
  }

  getBinaryPath(): string {
    const binary = this.getBinaryInfo()

    // Check bundled path first
    const bundledPath = path.join(this.bundledPath, binary.name)
    if (fs.existsSync(bundledPath)) {
      return bundledPath
    }

    // Default to userData path (whether it exists or not)
    return path.join(this.userDataPath, binary.name)
  }
}

export const binaryManager = new BinaryManager()
