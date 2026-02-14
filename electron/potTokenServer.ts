import * as http from 'http'
import { logger } from './logger'

const DEFAULT_PORT = 4416
const HOST = '127.0.0.1'
const DEFAULT_TTL_MINUTES = 360 // 6 hours

interface TokenCache {
  token: string
  visitorData: string
  generatedAt: number
  ttlMs: number
}

let server: http.Server | null = null
let tokenCache: TokenCache | null = null
let tokenCount = 0
let startTime = Date.now()
let lastError: string | null = null
let healthCheckInterval: NodeJS.Timeout | null = null
let currentPort = DEFAULT_PORT

async function generatePotToken(): Promise<{ token: string; visitorData: string }> {
  try {
    // Dynamic imports for ESM modules
    const bgutils = await import('bgutils-js')
    const { BG } = bgutils  // BG namespace contains Challenge, PoToken, BotGuardClient, WebPoMinter
    const { JSDOM } = await import('jsdom')
    const { Innertube } = await import('youtubei.js')

    logger.info('PO Token', 'Generating new PO token...')

    // Step 1: Create InnerTube instance to get visitor data
    const innertube = await Innertube.create({ retrieve_player: false })
    const visitorData = innertube.session.context.client.visitorData

    if (!visitorData) {
      throw new Error('Failed to get visitor data from InnerTube')
    }

    // Step 2: Set up JSDOM environment with proper YouTube context
    // This is critical for BotGuard's environment checks to pass
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    const dom = new JSDOM('', {
      url: 'https://www.youtube.com/',
      referrer: 'https://www.youtube.com/',
      userAgent: USER_AGENT,
    })

    // Set up globalThis with proper browser environment
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      location: dom.window.location,
      origin: dom.window.origin,
    })

    // Add navigator if not present (required for BotGuard checks)
    if (!Reflect.has(globalThis, 'navigator')) {
      Object.defineProperty(globalThis, 'navigator', {
        value: dom.window.navigator,
        configurable: true,
        writable: true,
      })
    }

    // Step 3: Configure BotGuard
    const requestKey = 'O43z0dpjhgX20SCx4KAo'
    const bgConfig = {
      fetch: (input: string | URL | Request, init?: RequestInit) => fetch(input, init),
      globalObj: globalThis,
      identifier: visitorData,
      requestKey,
    }

    // Step 4: Create BotGuard challenge
    const challenge = await BG.Challenge.create(bgConfig)

    if (!challenge) {
      throw new Error('Failed to create BotGuard challenge')
    }

    // Step 5: Execute the interpreter javascript (VM code from BotGuard)
    const interpreterJavascript = challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue
    if (interpreterJavascript) {
      new Function(interpreterJavascript)()
    }

    // Step 6: Try to generate full PO token, fall back to cold start token
    try {
      const poTokenResult = await BG.PoToken.generate({
        program: challenge.program,
        globalName: challenge.globalName,
        bgConfig,
      })

      if (poTokenResult?.poToken) {
        const token = poTokenResult.poToken
        tokenCount++
        lastError = null
        logger.info('PO Token', `Generated successfully (token #${tokenCount}, length: ${token.length})`)
        return { token, visitorData }
      }
    } catch (poError) {
      const errorMsg = poError instanceof Error ? poError.message : String(poError)
      logger.warn('PO Token', `Full token generation failed (${errorMsg}), using cold start token`)
    }

    // Fallback: Generate cold start token (works when SPS is 2)
    const coldStartToken = BG.PoToken.generateColdStartToken(visitorData)
    tokenCount++
    lastError = null
    logger.info('PO Token', `Generated cold start token (token #${tokenCount}, length: ${coldStartToken.length})`)

    return { token: coldStartToken, visitorData }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    lastError = errorMsg
    logger.error('PO Token generation failed', errorMsg)
    throw err
  }
}

async function getOrGenerateToken(ttlMinutes: number = DEFAULT_TTL_MINUTES): Promise<{ token: string; visitorData: string }> {
  const ttlMs = ttlMinutes * 60 * 1000

  // Return cached token if still valid
  if (tokenCache && (Date.now() - tokenCache.generatedAt) < tokenCache.ttlMs) {
    return { token: tokenCache.token, visitorData: tokenCache.visitorData }
  }

  // Generate new token
  const result = await generatePotToken()
  tokenCache = {
    ...result,
    generatedAt: Date.now(),
    ttlMs,
  }

  return result
}

function createPotServer(port: number, ttlMinutes: number): http.Server {
  const srv = http.createServer(async (req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown'

    // Only allow localhost
    if (clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== '::ffff:127.0.0.1') {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden' }))
      return
    }

    const url = req.url || '/'

    try {
      if (req.method === 'GET' && url === '/get_token') {
        const result = await getOrGenerateToken(ttlMinutes)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }

      if (req.method === 'GET' && url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          running: true,
          port,
          tokenCount,
          uptime: Math.floor((Date.now() - startTime) / 1000),
          cacheValid: tokenCache ? (Date.now() - tokenCache.generatedAt) < tokenCache.ttlMs : false,
          lastError,
        }))
        return
      }

      if (req.method === 'POST' && url === '/invalidate') {
        tokenCache = null
        logger.info('PO Token', 'Token cache invalidated')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error('PO Token server error', errorMsg)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: errorMsg }))
    }
  })

  return srv
}

export async function startPotTokenServer(port: number = DEFAULT_PORT, ttlMinutes: number = DEFAULT_TTL_MINUTES): Promise<http.Server> {
  currentPort = port
  startTime = Date.now()
  tokenCount = 0
  lastError = null
  tokenCache = null

  return new Promise((resolve, reject) => {
    server = createPotServer(port, ttlMinutes)

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn('PO Token server', `Port ${port} already in use`)
        resolve(server!)
      } else {
        lastError = error.message
        reject(error)
      }
    })

    server.listen(port, HOST, () => {
      logger.info('PO Token server', `Started on http://${HOST}:${port}`)

      // Set up health check interval for auto-restart
      if (healthCheckInterval) clearInterval(healthCheckInterval)
      healthCheckInterval = setInterval(() => {
        if (!server || !server.listening) {
          logger.warn('PO Token server', 'Health check failed, attempting restart...')
          startPotTokenServer(port, ttlMinutes).catch(err => {
            logger.error('PO Token server restart failed', err instanceof Error ? err.message : String(err))
          })
        }
      }, 30000)

      resolve(server!)
    })
  })
}

export function cleanupPotTokenServer(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
  }
  if (server) {
    try {
      server.close()
      server = null
      logger.info('PO Token server', 'Stopped')
    } catch (err) {
      logger.error('PO Token server cleanup error', err instanceof Error ? err.message : String(err))
    }
  }
}

export function getPotTokenStatus(): {
  running: boolean
  port: number
  lastTokenTime: string | null
  tokenCount: number
  error: string | null
  uptime: number
} {
  return {
    running: server?.listening ?? false,
    port: currentPort,
    lastTokenTime: tokenCache ? new Date(tokenCache.generatedAt).toISOString() : null,
    tokenCount,
    error: lastError,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  }
}

export async function fetchPotToken(port: number = DEFAULT_PORT): Promise<{ token: string; visitorData: string } | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/get_token`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json() as { token: string; visitorData: string }
  } catch (err) {
    logger.warn('PO Token fetch failed', err instanceof Error ? err.message : String(err))
    return null
  }
}
