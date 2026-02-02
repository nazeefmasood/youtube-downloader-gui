import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  details?: string
}

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_ERROR_HISTORY = 50

class Logger {
  private logFilePath: string
  private errorHistory: LogEntry[] = []
  private initialized = false

  constructor() {
    // Initialize path lazily since app.getPath may not be ready
    this.logFilePath = ''
  }

  private ensureInitialized(): void {
    if (this.initialized) return

    try {
      const logsDir = path.join(app.getPath('userData'), 'logs')
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }
      this.logFilePath = path.join(logsDir, 'vidgrab.log')
      this.initialized = true

      // Rotate log if needed on startup
      this.rotateIfNeeded()
    } catch (err) {
      console.error('Failed to initialize logger:', err)
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath)
        if (stats.size > MAX_LOG_SIZE) {
          // Keep backup of old log
          const backupPath = this.logFilePath + '.old'
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath)
          }
          fs.renameSync(this.logFilePath, backupPath)
        }
      }
    } catch (err) {
      console.error('Failed to rotate log:', err)
    }
  }

  private formatEntry(level: LogLevel, message: string, details?: string): string {
    const timestamp = new Date().toISOString()
    let entry = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    if (details) {
      entry += `\n  ${details.replace(/\n/g, '\n  ')}`
    }
    return entry + '\n'
  }

  private writeToFile(entry: string): void {
    this.ensureInitialized()
    if (!this.logFilePath) return

    try {
      fs.appendFileSync(this.logFilePath, entry, 'utf-8')
    } catch (err) {
      console.error('Failed to write to log file:', err)
    }
  }

  private addToErrorHistory(level: LogLevel, message: string, details?: string): void {
    if (level === 'error' || level === 'warn') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        details,
      }
      this.errorHistory.unshift(entry)
      if (this.errorHistory.length > MAX_ERROR_HISTORY) {
        this.errorHistory.pop()
      }
    }
  }

  info(message: string, details?: string): void {
    const entry = this.formatEntry('info', message, details)
    this.writeToFile(entry)
    console.log(`[INFO] ${message}`, details || '')
  }

  warn(message: string, details?: string): void {
    const entry = this.formatEntry('warn', message, details)
    this.writeToFile(entry)
    this.addToErrorHistory('warn', message, details)
    console.warn(`[WARN] ${message}`, details || '')
  }

  error(message: string, details?: string | Error): void {
    let detailStr: string | undefined
    if (details instanceof Error) {
      detailStr = `${details.message}\n${details.stack || ''}`
    } else {
      detailStr = details
    }

    const entry = this.formatEntry('error', message, detailStr)
    this.writeToFile(entry)
    this.addToErrorHistory('error', message, detailStr)
    console.error(`[ERROR] ${message}`, detailStr || '')
  }

  getRecentErrors(): LogEntry[] {
    return [...this.errorHistory]
  }

  getLogFilePath(): string {
    this.ensureInitialized()
    return this.logFilePath
  }

  // Log startup info for debugging
  logStartup(): void {
    this.info('='.repeat(50))
    this.info('VidGrab Starting Up')
    this.info(`Platform: ${process.platform}`)
    this.info(`Electron: ${process.versions.electron}`)
    this.info(`Node: ${process.versions.node}`)
    this.info(`App Version: ${app.getVersion()}`)
    this.info(`User Data: ${app.getPath('userData')}`)
    this.info(`Is Packaged: ${app.isPackaged}`)
    this.info('='.repeat(50))
  }
}

// Singleton instance
export const logger = new Logger()
