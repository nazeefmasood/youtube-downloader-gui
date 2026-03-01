import * as http from 'http'
import * as crypto from 'crypto'
import { QueueManager } from './queueManager'

const PORT = 3847
const HOST = '127.0.0.1'

// Authentication token - generated on server start
let apiToken: string

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60

// Generate a secure random token
function generateApiToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Get the current API token (for external access)
export function getApiToken(): string {
  return apiToken
}

// Validate Bearer token from Authorization header
function validateAuthToken(req: http.IncomingMessage): boolean {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.slice(7)
  return token === apiToken
}

// Cleanup rate limit map periodically to prevent memory leak
function cleanupRateLimitMap(): void {
  const now = Date.now()
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip)
    }
  }
}
// Run cleanup every 5 minutes
setInterval(cleanupRateLimitMap, 5 * 60 * 1000)

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return false
  }

  record.count++
  return record.count > RATE_LIMIT_MAX_REQUESTS
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // yt-dlp supports many platforms - allow all valid HTTP/HTTPS URLs
    // The downloader will validate if the platform is supported
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
      // Limit body size to 1MB
      if (body.length > 1024 * 1024) {
        reject(new Error('Body too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, data: unknown, statusCode = 200): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'chrome-extension://*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(data))
}

function sendError(res: http.ServerResponse, message: string, statusCode = 400): void {
  sendJson(res, { error: message }, statusCode)
}

export function createHttpServer(queueManager: QueueManager): http.Server {
  // Generate new API token on server creation
  apiToken = generateApiToken()
  console.log('[HTTP] Generated new API token for extension authentication')

  // Use shared downloader instance from queue manager to avoid creating multiple instances
  const downloader = queueManager.getDownloader()

  const server = http.createServer(async (req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown'

    // Only allow localhost connections
    if (clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== '::ffff:127.0.0.1') {
      sendError(res, 'Forbidden', 403)
      return
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': 'chrome-extension://*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    // Rate limiting
    if (isRateLimited(clientIp)) {
      sendError(res, 'Too many requests', 429)
      return
    }

    const url = req.url || '/'

    try {
      // GET /api/status - Check if app is running (no auth required)
      if (req.method === 'GET' && url === '/api/status') {
        const status = queueManager.getStatus()
        sendJson(res, {
          running: true,
          queueLength: status.items.filter(i => i.status === 'pending' || i.status === 'downloading').length,
          isProcessing: status.isProcessing,
          isPaused: status.isPaused,
        })
        return
      }

      // GET /api/token - Get authentication token (localhost only, no auth required)
      // This allows the extension to authenticate on first use
      if (req.method === 'GET' && url === '/api/token') {
        sendJson(res, { token: apiToken })
        return
      }

      // All endpoints below require authentication
      if (!validateAuthToken(req)) {
        sendError(res, 'Unauthorized - Invalid or missing API token', 401)
        return
      }

      // GET /api/queue - Get queue status
      if (req.method === 'GET' && url === '/api/queue') {
        sendJson(res, queueManager.getStatus())
        return
      }

      // POST /api/formats - Get available formats for URL
      if (req.method === 'POST' && url === '/api/formats') {
        const body = await parseBody(req)
        const videoUrl = body.url as string

        if (!videoUrl) {
          sendError(res, 'URL is required')
          return
        }

        if (!isValidUrl(videoUrl)) {
          sendError(res, 'Invalid URL')
          return
        }

        try {
          const [contentInfo, formats] = await Promise.all([
            downloader.detectUrl(videoUrl),
            downloader.getFormats(videoUrl),
          ])

          sendJson(res, {
            title: contentInfo.title,
            thumbnail: contentInfo.thumbnail,
            duration: contentInfo.duration,
            type: contentInfo.type,
            formats: formats.map(f => ({
              formatId: f.formatId,
              quality: f.quality,
              ext: f.ext,
              isAudioOnly: f.isAudioOnly,
              filesize: f.filesize,
            })),
          })
        } catch (error) {
          sendError(res, error instanceof Error ? error.message : 'Failed to get formats', 500)
        }
        return
      }

      // POST /api/download - Add to queue
      if (req.method === 'POST' && url === '/api/download') {
        const body = await parseBody(req)
        const videoUrl = body.url as string
        const format = body.format as string
        const audioOnly = body.audioOnly as boolean || false
        const title = body.title as string || 'Unknown'
        const thumbnail = body.thumbnail as string | undefined

        if (!videoUrl) {
          sendError(res, 'URL is required')
          return
        }

        if (!isValidUrl(videoUrl)) {
          sendError(res, 'Invalid URL')
          return
        }

        if (!format) {
          sendError(res, 'Format is required')
          return
        }

        const result = queueManager.addItem({
          url: videoUrl,
          title,
          thumbnail,
          format,
          audioOnly,
          source: 'extension',
          sourceType: 'single',
          contentType: audioOnly ? 'audio' : 'video',
        })

        sendJson(res, result)
        return
      }

      // 404 for unknown routes
      sendError(res, 'Not found', 404)
    } catch (error) {
      console.error('HTTP server error:', error)
      sendError(res, 'Internal server error', 500)
    }
  })

  return server
}

export function startHttpServer(queueManager: QueueManager): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer(queueManager)

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`Port ${PORT} is already in use, HTTP server not started`)
        // Don't reject, just resolve with the server anyway
        // The extension will show "app not running" which is fine
        resolve(server)
      } else {
        reject(error)
      }
    })

    server.listen(PORT, HOST, () => {
      console.log(`Grab HTTP server listening on http://${HOST}:${PORT}`)
      resolve(server)
    })
  })
}
