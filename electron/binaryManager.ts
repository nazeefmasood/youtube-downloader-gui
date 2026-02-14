import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as zlib from 'zlib'
import { pipeline } from 'stream/promises'
import { app, BrowserWindow } from 'electron'
import { execSync } from 'child_process'
import { logger } from './logger'

// Using latest stable version
const YTDLP_VERSION = '2026.02.04'
const FFMPEG_VERSION = '7.1.1'

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

    // Include version in filename to track and update binaries properly
    if (platform === 'win32') {
      binaryName = `yt-dlp_${YTDLP_VERSION}.exe`
      url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp.exe`
    } else if (platform === 'darwin') {
      binaryName = `yt-dlp-macos_${YTDLP_VERSION}`
      url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_macos`
    } else {
      binaryName = `yt-dlp-linux_${YTDLP_VERSION}`
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

  // Get ffmpeg binary info for current platform
  private getFfmpegBinaryInfo(): BinaryInfo {
    const platform = process.platform
    const arch = process.arch
    let binaryName: string
    let url: string

    // Use gyan.dev builds (official Windows builds) and evermeetcx for macOS, johnvansickle for Linux
    if (platform === 'win32') {
      // Windows: Use essentials build (smaller, has all we need)
      binaryName = `ffmpeg-${FFMPEG_VERSION}-essentials_build.zip`
      url = `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`
    } else if (platform === 'darwin') {
      // macOS: Use evermeetcx builds
      binaryName = `ffmpeg-${FFMPEG_VERSION}.zip`
      url = `https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip`
    } else {
      // Linux: Use johnvansickle builds (static)
      const linuxArch = arch === 'arm64' ? 'arm64' : 'amd64'
      binaryName = `ffmpeg-${FFMPEG_VERSION}-${linuxArch}.tar.xz`
      url = `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${linuxArch}-static.tar.xz`
    }

    return {
      name: binaryName,
      url,
      path: path.join(this.userDataPath, binaryName),
      executable: platform !== 'win32',
    }
  }

  // Get the base name pattern for old binaries (without version)
  private getOldBinaryPattern(): string {
    const platform = process.platform
    if (platform === 'win32') {
      return 'yt-dlp'
    } else if (platform === 'darwin') {
      return 'yt-dlp-macos'
    } else {
      return 'yt-dlp-linux'
    }
  }

  // Clean up old unversioned or different-versioned binaries
  private cleanOldBinaries(): void {
    const binary = this.getBinaryInfo()
    const oldPattern = this.getOldBinaryPattern()

    try {
      // Clean from bundled path
      if (fs.existsSync(this.bundledPath)) {
        const bundledFiles = fs.readdirSync(this.bundledPath)
        for (const file of bundledFiles) {
          if (file.startsWith(oldPattern) && file !== binary.name) {
            const filePath = path.join(this.bundledPath, file)
            try {
              fs.unlinkSync(filePath)
              logger.info('Cleaned old binary', filePath)
            } catch (e) {
              logger.warn('Failed to clean old binary', `${filePath}: ${e}`)
            }
          }
        }
      }

      // Clean from userData path
      if (fs.existsSync(this.userDataPath)) {
        const userFiles = fs.readdirSync(this.userDataPath)
        for (const file of userFiles) {
          if (file.startsWith(oldPattern) && file !== binary.name) {
            const filePath = path.join(this.userDataPath, file)
            try {
              fs.unlinkSync(filePath)
              logger.info('Cleaned old binary', filePath)
            } catch (e) {
              logger.warn('Failed to clean old binary', `${filePath}: ${e}`)
            }
          }
        }
      }
    } catch (err) {
      logger.error('Error cleaning old binaries', err instanceof Error ? err : String(err))
    }
  }

  // Verify that the binary is functional by running --version
  private verifyBinary(binaryPath: string): boolean {
    try {
      // Check file size (yt-dlp should be at least 1MB)
      const stats = fs.statSync(binaryPath)
      if (stats.size < 1024 * 1024) {
        logger.error('Binary verification failed', `File too small: ${stats.size} bytes`)
        return false
      }

      // Run --version to verify binary works
      const version = execSync(`"${binaryPath}" --version`, { timeout: 15000 }).toString().trim()
      logger.info('Binary verified', `Version: ${version}`)
      return true
    } catch (err) {
      logger.error('Binary verification failed', err instanceof Error ? err.message : String(err))
      return false
    }
  }

  // Check if the correct versioned binary exists
  hasCorrectVersion(): boolean {
    const binary = this.getBinaryInfo()

    // Check bundled path
    const bundledPath = path.join(this.bundledPath, binary.name)
    if (fs.existsSync(bundledPath)) {
      return true
    }

    // Check user data path
    const userDataPath = path.join(this.userDataPath, binary.name)
    return fs.existsSync(userDataPath)
  }

  isBinaryInstalled(): boolean {
    const binary = this.getBinaryInfo()

    // Clean old binaries when checking (ensures we use the correct version)
    this.cleanOldBinaries()

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
            // Handle redirects (301, 302, 303, 307, 308)
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              const redirectUrl = response.headers.location
              logger.info('Following redirect', `${response.statusCode} -> ${redirectUrl}`)
              downloadFile(redirectUrl, redirectCount + 1)
              return
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

              // Wait for file system to fully flush the file to disk
              // This prevents "Text file busy" errors when trying to execute the binary
              setTimeout(() => {
                // Make executable on Unix systems
                if (binary.executable) {
                  try {
                    fs.chmodSync(targetPath, 0o755)
                  } catch (err) {
                    logger.error('Failed to make binary executable', err instanceof Error ? err : String(err))
                  }
                }

                // Verify the downloaded binary works
                if (!this.verifyBinary(targetPath)) {
                  try {
                    fs.unlinkSync(targetPath)
                  } catch (e) { /* ignore */ }
                  const error = 'Binary verification failed - downloaded file may be corrupted'
                  logger.error('Binary download failed', error)
                  mainWindow?.webContents.send('binary:download-error', { error })
                  resolve(false)
                  return
                }

                logger.info('Binary download complete', targetPath)
                mainWindow?.webContents.send('binary:download-complete', {
                  path: targetPath,
                })
                resolve(true)
              }, 500) // 500ms delay to ensure file is fully written
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

  // Get the expected ffmpeg executable name for the current platform
  private getFfmpegExecutableName(): string {
    return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  }

  // Get the path where ffmpeg executable should be stored
  getFfmpegPath(): string {
    const ffmpegName = this.getFfmpegExecutableName()

    // Check bundled path first
    const bundledFfmpeg = path.join(this.bundledPath, ffmpegName)
    if (fs.existsSync(bundledFfmpeg)) {
      return bundledFfmpeg
    }

    // Check userData path
    const userFfmpeg = path.join(this.userDataPath, ffmpegName)
    return userFfmpeg
  }

  // Check if ffmpeg is installed (bundled or downloaded)
  isFfmpegInstalled(): boolean {
    const ffmpegPath = this.getFfmpegPath()
    return fs.existsSync(ffmpegPath)
  }

  // Download and extract ffmpeg
  async downloadFfmpeg(mainWindow: BrowserWindow | null): Promise<boolean> {
    const ffmpegName = this.getFfmpegExecutableName()
    const targetPath = path.join(this.userDataPath, ffmpegName)

    logger.info('Starting ffmpeg download')

    try {
      // Ensure binaries directory exists
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true })
      }

      mainWindow?.webContents.send('binary:download-start', {
        name: `ffmpeg-${FFMPEG_VERSION}`,
      })

      const platform = process.platform

      // For macOS, we can download the binary directly
      if (platform === 'darwin') {
        return await this.downloadFfmpegMacos(targetPath, mainWindow)
      }

      // For Windows and Linux, we need to download and extract from archive
      return await this.downloadAndExtractFfmpeg(targetPath, mainWindow)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.error('ffmpeg download setup failed', error)
      mainWindow?.webContents.send('binary:download-error', { error })
      return false
    }
  }

  // Download ffmpeg for macOS (direct binary)
  private async downloadFfmpegMacos(targetPath: string, mainWindow: BrowserWindow | null): Promise<boolean> {
    const url = 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip'

    return new Promise((resolve) => {
      const tempPath = targetPath + '.zip'

      const downloadFile = (downloadUrl: string, redirectCount = 0): void => {
        if (redirectCount > 5) {
          const error = 'Too many redirects'
          logger.error('ffmpeg download failed', error)
          mainWindow?.webContents.send('binary:download-error', { error })
          resolve(false)
          return
        }

        https.get(downloadUrl, (response) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            const redirectUrl = response.headers.location
            logger.info('Following redirect', `${response.statusCode} -> ${redirectUrl}`)
            downloadFile(redirectUrl, redirectCount + 1)
            return
          }

          if (response.statusCode !== 200) {
            const error = `HTTP error: ${response.statusCode}`
            logger.error('ffmpeg download failed', error)
            mainWindow?.webContents.send('binary:download-error', { error })
            resolve(false)
            return
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10)
          let downloadedSize = 0
          const file = fs.createWriteStream(tempPath)

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

            // Extract the zip (macOS zip contains just 'ffmpeg' binary)
            try {
              // Use unzip command on macOS
              execSync(`unzip -o "${tempPath}" -d "${this.userDataPath}"`, { timeout: 30000 })
              fs.unlinkSync(tempPath)

              // Make executable
              fs.chmodSync(targetPath, 0o755)

              // Verify
              const version = execSync(`"${targetPath}" -version`, { timeout: 10000 }).toString().split('\n')[0].trim()
              logger.info('ffmpeg downloaded and verified', version)
              mainWindow?.webContents.send('binary:download-complete', { path: targetPath })
              resolve(true)
            } catch (extractErr) {
              const error = `Failed to extract ffmpeg: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`
              logger.error('ffmpeg extraction failed', error)
              mainWindow?.webContents.send('binary:download-error', { error })
              resolve(false)
            }
          })

          file.on('error', (err) => {
            try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
            logger.error('ffmpeg download failed', err.message)
            mainWindow?.webContents.send('binary:download-error', { error: err.message })
            resolve(false)
          })
        }).on('error', (err) => {
          logger.error('ffmpeg download failed', err)
          mainWindow?.webContents.send('binary:download-error', { error: err.message })
          resolve(false)
        })
      }

      downloadFile(url, 0)
    })
  }

  // Download and extract ffmpeg for Windows/Linux
  private async downloadAndExtractFfmpeg(targetPath: string, mainWindow: BrowserWindow | null): Promise<boolean> {
    const platform = process.platform
    const arch = process.arch

    let url: string
    let tempExt: string

    if (platform === 'win32') {
      url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
      tempExt = '.zip'
    } else {
      // Linux
      const linuxArch = arch === 'arm64' ? 'arm64' : 'amd64'
      url = `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${linuxArch}-static.tar.xz`
      tempExt = '.tar.xz'
    }

    return new Promise((resolve) => {
      const tempPath = targetPath + tempExt

      const downloadFile = (downloadUrl: string, redirectCount = 0): void => {
        if (redirectCount > 5) {
          const error = 'Too many redirects'
          logger.error('ffmpeg download failed', error)
          mainWindow?.webContents.send('binary:download-error', { error })
          resolve(false)
          return
        }

        https.get(downloadUrl, (response) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            const redirectUrl = response.headers.location
            logger.info('Following redirect', `${response.statusCode} -> ${redirectUrl}`)
            downloadFile(redirectUrl, redirectCount + 1)
            return
          }

          if (response.statusCode !== 200) {
            const error = `HTTP error: ${response.statusCode}`
            logger.error('ffmpeg download failed', error)
            mainWindow?.webContents.send('binary:download-error', { error })
            resolve(false)
            return
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10)
          let downloadedSize = 0
          const file = fs.createWriteStream(tempPath)

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

            // Extract
            try {
              if (platform === 'win32') {
                // Windows: Extract using PowerShell or built-in tools
                // Find ffmpeg.exe in the extracted folder structure
                const extractDir = path.join(this.userDataPath, 'ffmpeg-temp')
                execSync(`powershell -Command "Expand-Archive -Path '${tempPath}' -DestinationPath '${extractDir}' -Force"`, { timeout: 60000 })

                // Find and move ffmpeg.exe
                const findAndMove = (dir: string): boolean => {
                  const items = fs.readdirSync(dir)
                  for (const item of items) {
                    const itemPath = path.join(dir, item)
                    const stat = fs.statSync(itemPath)
                    if (stat.isDirectory()) {
                      if (findAndMove(itemPath)) return true
                    } else if (item === 'ffmpeg.exe') {
                      fs.copyFileSync(itemPath, targetPath)
                      return true
                    }
                  }
                  return false
                }

                if (findAndMove(extractDir)) {
                  // Cleanup
                  fs.rmSync(extractDir, { recursive: true, force: true })
                  fs.unlinkSync(tempPath)

                  const version = execSync(`"${targetPath}" -version`, { timeout: 10000 }).toString().split('\n')[0].trim()
                  logger.info('ffmpeg downloaded and verified', version)
                  mainWindow?.webContents.send('binary:download-complete', { path: targetPath })
                  resolve(true)
                } else {
                  throw new Error('ffmpeg.exe not found in archive')
                }
              } else {
                // Linux: Extract tar.xz
                const extractDir = path.join(this.userDataPath, 'ffmpeg-temp')
                fs.mkdirSync(extractDir, { recursive: true })
                execSync(`tar -xf "${tempPath}" -C "${extractDir}"`, { timeout: 60000 })

                // Find and move ffmpeg
                const findAndMove = (dir: string): boolean => {
                  const items = fs.readdirSync(dir)
                  for (const item of items) {
                    const itemPath = path.join(dir, item)
                    const stat = fs.statSync(itemPath)
                    if (stat.isDirectory()) {
                      if (findAndMove(itemPath)) return true
                    } else if (item === 'ffmpeg') {
                      fs.copyFileSync(itemPath, targetPath)
                      fs.chmodSync(targetPath, 0o755)
                      return true
                    }
                  }
                  return false
                }

                if (findAndMove(extractDir)) {
                  // Cleanup
                  fs.rmSync(extractDir, { recursive: true, force: true })
                  fs.unlinkSync(tempPath)

                  const version = execSync(`"${targetPath}" -version`, { timeout: 10000 }).toString().split('\n')[0].trim()
                  logger.info('ffmpeg downloaded and verified', version)
                  mainWindow?.webContents.send('binary:download-complete', { path: targetPath })
                  resolve(true)
                } else {
                  throw new Error('ffmpeg not found in archive')
                }
              }
            } catch (extractErr) {
              const error = `Failed to extract ffmpeg: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`
              logger.error('ffmpeg extraction failed', error)
              // Cleanup on error
              try { fs.rmSync(path.join(this.userDataPath, 'ffmpeg-temp'), { recursive: true, force: true }) } catch { /* ignore */ }
              try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
              mainWindow?.webContents.send('binary:download-error', { error })
              resolve(false)
            }
          })

          file.on('error', (err) => {
            try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
            logger.error('ffmpeg download failed', err.message)
            mainWindow?.webContents.send('binary:download-error', { error: err.message })
            resolve(false)
          })
        }).on('error', (err) => {
          logger.error('ffmpeg download failed', err)
          mainWindow?.webContents.send('binary:download-error', { error: err.message })
          resolve(false)
        })
      }

      downloadFile(url, 0)
    })
  }

  // Check if ffmpeg is available (downloaded, bundled, or system)
  checkFfmpeg(): { available: boolean; path: string | null; version: string | null } {
    const ffmpegPath = this.getFfmpegPath()

    // First check if we have a downloaded/bundled ffmpeg
    if (fs.existsSync(ffmpegPath)) {
      try {
        const version = execSync(`"${ffmpegPath}" -version`, { timeout: 10000 })
          .toString()
          .split('\n')[0]
          .trim()
        logger.info('ffmpeg verified', `Path: ${ffmpegPath}, Version: ${version}`)
        return { available: true, path: ffmpegPath, version }
      } catch (versionErr) {
        logger.warn('ffmpeg exists but failed version check', versionErr instanceof Error ? versionErr.message : String(versionErr))
      }
    }

    // Fall back to system ffmpeg
    try {
      const version = execSync('ffmpeg -version', { timeout: 10000 })
        .toString()
        .split('\n')[0]
        .trim()
      logger.info('System ffmpeg found', version)
      return { available: true, path: 'ffmpeg', version }
    } catch (systemErr) {
      logger.warn('System ffmpeg not found', systemErr instanceof Error ? systemErr.message : String(systemErr))
    }

    logger.error('No ffmpeg available', 'Neither downloaded nor system ffmpeg found')
    return { available: false, path: null, version: null }
  }

  // Check if ffprobe is available (system only - ffprobe-static removed for size)
  checkFfprobe(): { available: boolean; path: string | null } {
    try {
      execSync('ffprobe -version', { timeout: 10000 })
      logger.info('System ffprobe found')
      return { available: true, path: 'ffprobe' }
    } catch {
      logger.warn('System ffprobe not found')
    }

    return { available: false, path: null }
  }

  // Get all binary status for the UI
  getBinaryStatus(): {
    ytdlp: { installed: boolean; version: string | null; path: string | null }
    ffmpeg: { available: boolean; version: string | null; path: string | null }
    ffprobe: { available: boolean; path: string | null }
  } {
    const ytdlpPath = this.getBinaryPath()
    let ytdlpVersion: string | null = null
    const ytdlpInstalled = this.isBinaryInstalled()

    if (ytdlpInstalled) {
      try {
        ytdlpVersion = execSync(`"${ytdlpPath}" --version`, { timeout: 10000 }).toString().trim()
      } catch {
        ytdlpVersion = null
      }
    }

    const ffmpegStatus = this.checkFfmpeg()
    const ffprobeStatus = this.checkFfprobe()

    return {
      ytdlp: {
        installed: ytdlpInstalled,
        version: ytdlpVersion,
        path: ytdlpInstalled ? ytdlpPath : null,
      },
      ffmpeg: ffmpegStatus,
      ffprobe: ffprobeStatus,
    }
  }
}

export const binaryManager = new BinaryManager()
