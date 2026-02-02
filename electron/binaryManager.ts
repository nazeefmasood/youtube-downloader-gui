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

export class BinaryManager {
  private binariesPath: string

  constructor() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
      this.binariesPath = path.join(process.cwd(), 'binaries')
    } else {
      this.binariesPath = path.join(process.resourcesPath, 'binaries')
    }
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

    return {
      name: binaryName,
      url,
      path: path.join(this.binariesPath, binaryName),
      executable: platform !== 'win32',
    }
  }

  isBinaryInstalled(): boolean {
    const binary = this.getBinaryInfo()
    const exists = fs.existsSync(binary.path)
    logger.info('Binary check', `${binary.name}: ${exists ? 'found' : 'not found'} at ${binary.path}`)
    return exists
  }

  async downloadBinary(mainWindow: BrowserWindow | null): Promise<boolean> {
    const binary = this.getBinaryInfo()

    logger.info('Starting binary download', binary.url)

    // Ensure binaries directory exists
    if (!fs.existsSync(this.binariesPath)) {
      fs.mkdirSync(this.binariesPath, { recursive: true })
    }

    // Notify UI that download is starting
    mainWindow?.webContents.send('binary:download-start', {
      name: binary.name,
    })

    return new Promise((resolve) => {
      const downloadFile = (url: string, redirectCount = 0): void => {
        if (redirectCount > 5) {
          logger.error('Binary download failed', 'Too many redirects')
          mainWindow?.webContents.send('binary:download-error', {
            error: 'Too many redirects',
          })
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
            logger.error('Binary download failed', `HTTP ${response.statusCode}`)
            mainWindow?.webContents.send('binary:download-error', {
              error: `HTTP error: ${response.statusCode}`,
            })
            resolve(false)
            return
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10)
          let downloadedSize = 0

          const file = fs.createWriteStream(binary.path)

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
                fs.chmodSync(binary.path, 0o755)
              } catch (err) {
                logger.error('Failed to make binary executable', err instanceof Error ? err : String(err))
              }
            }

            logger.info('Binary download complete', binary.path)
            mainWindow?.webContents.send('binary:download-complete', {
              path: binary.path,
            })
            resolve(true)
          })

          file.on('error', (err) => {
            fs.unlinkSync(binary.path)
            logger.error('Binary download failed', err)
            mainWindow?.webContents.send('binary:download-error', {
              error: err.message,
            })
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
  }

  getBinaryPath(): string {
    return this.getBinaryInfo().path
  }
}

export const binaryManager = new BinaryManager()
