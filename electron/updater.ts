import { app, shell } from 'electron'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import { logger } from './logger'

export interface UpdateInfo {
  version: string
  currentVersion: string
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
  mandatory: boolean
}

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateStatus {
  checking: boolean
  available: boolean
  downloading: boolean
  downloaded: boolean
  error: string | null
  info: UpdateInfo | null
  progress: UpdateProgress | null
}

export interface ChangelogSection {
  added: string[]
  changed: string[]
  fixed: string[]
  removed: string[]
}

export class Updater extends EventEmitter {
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    info: null,
    progress: null,
  }

  private downloadedFilePath: string | null = null
  private downloadRequest: http.ClientRequest | null = null
  private readonly GITHUB_REPO = 'nazeefmasood/youtube-downloader-gui'
  private readonly GITHUB_API_URL = `https://api.github.com/repos/${this.GITHUB_REPO}/releases/latest`

  // GitHub tokens for API authentication (with fallback)
  private readonly GITHUB_TOKENS = [
    process.env.GITHUB_TOKEN || '', // Primary token from environment
    process.env.GITHUB_TOKEN_FALLBACK || '', // Fallback token from environment
  ].filter(t => t.length > 0)

  constructor() {
    super()
  }

  getStatus(): UpdateStatus {
    return { ...this.status }
  }

  // Compare semantic versions
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number)
    const parts2 = v2.replace(/^v/, '').split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0
      if (p1 > p2) return 1
      if (p1 < p2) return -1
    }
    return 0
  }

  // Get the appropriate download asset for the current platform
  private getPlatformAsset(assets: Array<{ name: string; browser_download_url: string }>): string | null {
    const platform = process.platform
    const arch = process.arch

    for (const asset of assets) {
      const name = asset.name.toLowerCase()

      if (platform === 'win32') {
        // Windows: Prefer NSIS installer (.exe)
        if (name.endsWith('.exe') && !name.includes('portable')) {
          return asset.browser_download_url
        }
      } else if (platform === 'darwin') {
        // macOS: Prefer .zip or .dmg
        if (name.endsWith('.zip') || name.endsWith('.dmg')) {
          return asset.browser_download_url
        }
      } else if (platform === 'linux') {
        // Linux: Prefer AppImage, fallback to .deb
        if (name.includes('.appimage') && name.includes(arch === 'x64' ? 'amd64' : arch)) {
          return asset.browser_download_url
        }
        if (name.endsWith('.deb') && name.includes(arch === 'x64' ? 'amd64' : arch)) {
          return asset.browser_download_url
        }
      }
    }

    // Fallback: try to find any matching asset
    for (const asset of assets) {
      const name = asset.name.toLowerCase()
      if (platform === 'win32' && name.includes('win')) return asset.browser_download_url
      if (platform === 'darwin' && name.includes('mac')) return asset.browser_download_url
      if (platform === 'linux' && name.includes('linux')) return asset.browser_download_url
    }

    return null
  }

  // Check if release is mandatory
  private isMandatory(body: string): boolean {
    return body.toLowerCase().includes('mandatory update') ||
           body.toLowerCase().includes('critical security')
  }

  // Fetch latest release from GitHub
  async checkForUpdates(): Promise<UpdateInfo | null> {
    this.status.checking = true
    this.status.error = null
    this.emit('checking')

    try {
      const release = await this.fetchLatestRelease()
      const currentVersion = app.getVersion()

      if (!release) {
        this.status.checking = false
        this.emit('not-available')
        return null
      }

      const latestVersion = release.tag_name.replace(/^v/, '')

      if (this.compareVersions(latestVersion, currentVersion) <= 0) {
        this.status.checking = false
        this.emit('not-available')
        return null
      }

      const downloadUrl = this.getPlatformAsset(release.assets)

      if (!downloadUrl) {
        this.status.checking = false
        this.status.error = 'No suitable download found for your platform'
        this.emit('error', this.status.error)
        return null
      }

      const info: UpdateInfo = {
        version: latestVersion,
        currentVersion,
        releaseDate: release.published_at,
        releaseNotes: release.body || '',
        downloadUrl,
        mandatory: this.isMandatory(release.body || ''),
      }

      this.status.checking = false
      this.status.available = true
      this.status.info = info
      this.emit('available', info)

      logger.info('Update available', `v${latestVersion}`)
      return info
    } catch (error) {
      this.status.checking = false
      this.status.error = error instanceof Error ? error.message : 'Failed to check for updates'
      this.emit('error', this.status.error)
      logger.error('Update check failed', this.status.error)
      return null
    }
  }

  // Fetch latest release from GitHub API with token fallback
  private fetchLatestRelease(): Promise<{
    tag_name: string
    published_at: string
    body: string
    assets: Array<{ name: string; browser_download_url: string }>
  } | null> {
    return this.fetchWithTokenFallback(0)
  }

  // Try fetching with each token, falling back on 404/auth errors
  private fetchWithTokenFallback(tokenIndex: number): Promise<{
    tag_name: string
    published_at: string
    body: string
    assets: Array<{ name: string; browser_download_url: string }>
  } | null> {
    return new Promise((resolve, reject) => {
      // If we've exhausted all tokens, try unauthenticated as last resort
      const token = tokenIndex < this.GITHUB_TOKENS.length ? this.GITHUB_TOKENS[tokenIndex] : null

      const options: https.RequestOptions = {
        headers: {
          'User-Agent': 'VidGrab-Updater',
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }

      const req = https.get(this.GITHUB_API_URL, options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          // On 404 or 401, try next token
          if (res.statusCode === 404 || res.statusCode === 401) {
            const nextIndex = tokenIndex + 1
            if (nextIndex <= this.GITHUB_TOKENS.length) {
              logger.warn(`GitHub token ${tokenIndex} returned ${res.statusCode}, trying fallback`)
              this.fetchWithTokenFallback(nextIndex).then(resolve).catch(reject)
              return
            }
            reject(new Error(`GitHub API returned ${res.statusCode}`))
            return
          }

          if (res.statusCode === 403) {
            // Rate limited - try next token
            const nextIndex = tokenIndex + 1
            if (nextIndex <= this.GITHUB_TOKENS.length) {
              logger.warn('GitHub rate limited, trying fallback token')
              this.fetchWithTokenFallback(nextIndex).then(resolve).catch(reject)
              return
            }
            reject(new Error('GitHub API rate limited. Please try again later.'))
            return
          }

          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}`))
            return
          }

          try {
            const release = JSON.parse(data)
            resolve(release)
          } catch {
            reject(new Error('Failed to parse GitHub response'))
          }
        })
      })

      req.on('error', (err) => {
        reject(err)
      })

      req.setTimeout(30000, () => {
        req.destroy()
        reject(new Error('Update check timed out. Please check your internet connection.'))
      })
    })
  }

  // Download the update
  async downloadUpdate(): Promise<string | null> {
    if (!this.status.info) {
      this.status.error = 'No update available to download'
      this.emit('error', this.status.error)
      return null
    }

    this.status.downloading = true
    this.status.downloaded = false
    this.status.progress = { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }
    this.emit('download-start')

    try {
      const downloadPath = await this.downloadFile(
        this.status.info.downloadUrl,
        (progress) => {
          this.status.progress = progress
          this.emit('progress', progress)
        }
      )

      this.downloadedFilePath = downloadPath
      this.status.downloading = false
      this.status.downloaded = true
      this.emit('downloaded', downloadPath)

      logger.info('Update downloaded', downloadPath)
      return downloadPath
    } catch (error) {
      this.status.downloading = false
      this.status.error = error instanceof Error ? error.message : 'Download failed'
      this.emit('error', this.status.error)
      logger.error('Update download failed', this.status.error)
      return null
    }
  }

  // Extract filename from URL or query parameters
  private extractFilename(url: string): string {
    try {
      const urlObj = new URL(url)

      // Check for filename in query parameters (Azure blob storage pattern)
      const filenameParam = urlObj.searchParams.get('filename')
      if (filenameParam) {
        return filenameParam
      }

      // Check for response-content-disposition header pattern
      const disposition = urlObj.searchParams.get('response-content-disposition')
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i)
        if (match) {
          return match[1]
        }
      }

      // Fall back to last path segment without query params
      const pathParts = urlObj.pathname.split('/')
      const lastPart = pathParts[pathParts.length - 1]
      if (lastPart && lastPart.length < 100) {
        return lastPart
      }
    } catch {
      // URL parsing failed, use fallback
    }

    // Ultimate fallback
    return 'update'
  }

  // Download file with progress
  private downloadFile(
    url: string,
    onProgress: (progress: UpdateProgress) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Determine download path
      const fileName = this.extractFilename(url)
      const downloadsPath = app.getPath('downloads')
      const filePath = path.join(downloadsPath, fileName)

      const file = fs.createWriteStream(filePath)
      let startTime = Date.now()
      let previousBytes = 0

      const protocol = url.startsWith('https') ? https : http

      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'VidGrab-Updater',
        },
      }, (response) => {
        // Handle redirects (301, 302, 303, 307, 308)
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location
          file.close()
          fs.unlinkSync(filePath)
          this.downloadFile(redirectUrl, onProgress).then(resolve).catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          file.close()
          fs.unlinkSync(filePath)
          reject(new Error(`Download failed with status ${response.statusCode}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10)

        response.on('data', (chunk) => {
          const now = Date.now()
          const elapsed = (now - startTime) / 1000
          const transferred = file.bytesWritten

          // Calculate speed every 500ms
          if (now - startTime > 500) {
            const bytesPerSecond = Math.round((transferred - previousBytes) / (elapsed / 2))
            previousBytes = transferred
            startTime = now
          }

          const progress: UpdateProgress = {
            percent: totalSize > 0 ? Math.round((transferred / totalSize) * 100) : 0,
            transferred,
            total: totalSize,
            bytesPerSecond: previousBytes > 0 ? previousBytes : 0,
          }

          onProgress(progress)
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve(filePath)
        })
      })

      request.on('error', (err) => {
        file.close()
        try {
          fs.unlinkSync(filePath)
        } catch {
          // Ignore cleanup errors
        }
        reject(err)
      })

      this.downloadRequest = request

      request.setTimeout(300000, () => {
        request.destroy()
        file.close()
        try {
          fs.unlinkSync(filePath)
        } catch {
          // Ignore cleanup errors
        }
        reject(new Error('Download timeout'))
      })
    })
  }

  // Install the update
  async installUpdate(): Promise<void> {
    if (!this.downloadedFilePath) {
      this.status.error = 'No update downloaded'
      this.emit('error', this.status.error)
      return
    }

    const platform = process.platform

    try {
      if (platform === 'win32') {
        // Windows: Open the installer
        await shell.openPath(this.downloadedFilePath)
        // Give it a moment to start then quit
        setTimeout(() => app.quit(), 1000)
      } else if (platform === 'darwin') {
        // macOS: Open the DMG/ZIP
        await shell.openPath(this.downloadedFilePath)
        setTimeout(() => app.quit(), 1000)
      } else if (platform === 'linux') {
        // Linux: For AppImage, just show the file location
        // For DEB, show instructions
        if (this.downloadedFilePath.endsWith('.deb')) {
          shell.showItemInFolder(this.downloadedFilePath)
          this.emit('linux-deb', this.downloadedFilePath)
        } else {
          // AppImage - just open the folder
          shell.showItemInFolder(this.downloadedFilePath)
          this.emit('linux-appimage', this.downloadedFilePath)
        }
      }
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : 'Failed to install update'
      this.emit('error', this.status.error)
      logger.error('Update install failed', this.status.error)
    }
  }

  // Cancel the download
  cancelDownload(): void {
    if (this.downloadRequest) {
      this.downloadRequest.destroy()
      this.downloadRequest = null
      this.status.downloading = false
      this.status.progress = null
      this.emit('cancelled')
    }
  }

  // Parse changelog from release notes
  parseChangelog(body: string, version: string): { version: string; date: string; sections: ChangelogSection } {
    const sections: ChangelogSection = {
      added: [],
      changed: [],
      fixed: [],
      removed: [],
    }

    // Parse markdown sections
    const lines = body.split('\n')
    let currentSection: keyof ChangelogSection | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      // Detect section headers
      if (trimmed.match(/^##?\s*🚀\s*Added/i) || trimmed.match(/^##?\s*Added/i)) {
        currentSection = 'added'
        continue
      }
      if (trimmed.match(/^##?\s*🔄\s*Changed/i) || trimmed.match(/^##?\s*Changed/i)) {
        currentSection = 'changed'
        continue
      }
      if (trimmed.match(/^##?\s*🐛\s*Fixed/i) || trimmed.match(/^##?\s*Fixed/i)) {
        currentSection = 'fixed'
        continue
      }
      if (trimmed.match(/^##?\s*❌\s*Removed/i) || trimmed.match(/^##?\s*Removed/i)) {
        currentSection = 'removed'
        continue
      }

      // Parse list items
      if (currentSection && trimmed.startsWith('- ')) {
        const item = trimmed.substring(2).trim()
        if (item && !item.startsWith('**')) {
          sections[currentSection].push(item)
        }
      }
    }

    return {
      version,
      date: new Date().toISOString(),
      sections,
    }
  }

  // Reset status
  reset(): void {
    this.status = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      error: null,
      info: null,
      progress: null,
    }
    this.downloadedFilePath = null
    this.downloadRequest = null
  }
}

// Singleton instance
export const updater = new Updater()
