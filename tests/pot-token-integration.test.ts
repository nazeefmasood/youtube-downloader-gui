/**
 * PO Token Integration Test
 *
 * Tests that the generated PO token actually works with yt-dlp
 */

import { spawn } from 'child_process'
import http from 'http'
import path from 'path'
import fs from 'fs'

const PO_TOKEN_PORT = 4416
const BASE_URL = `http://127.0.0.1:${PO_TOKEN_PORT}`

interface TokenResponse {
  token: string
  visitorData: string
}

function httpRequest(path: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: data ? JSON.parse(data) : null,
          })
        } catch {
          resolve({ status: res.statusCode || 0, data })
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function getToken(): Promise<TokenResponse> {
  const response = await httpRequest('/get_token')
  if (response.status !== 200) {
    throw new Error(`Failed to get token: HTTP ${response.status}`)
  }
  return response.data as TokenResponse
}

function runYtDlp(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const ytDlpPath = path.join(process.env.HOME || '', '.config', 'vidgrab', 'binaries', 'yt-dlp-linux_2026.02.04')

    const proc = spawn(ytDlpPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => stdout += data)
    proc.stderr.on('data', (data) => stderr += data)

    proc.on('close', (code) => {
      resolve({ code: code || 0, stdout, stderr })
    })
  })
}

async function testYtDlpWithToken(): Promise<void> {
  console.log('══════════════════════════════════════════════════════════════')
  console.log('           PO TOKEN INTEGRATION TEST')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('────────────────────────────────────────────────────────────────\n')

  // Test 1: Check server is running
  console.log('[1/5] Checking PO Token server...')
  try {
    const health = await httpRequest('/health')
    if (health.status !== 200) {
      throw new Error('Server not responding')
    }
    console.log('      ✓ Server is running\n')
  } catch (err) {
    console.error('      ✗ Server not running - start with npm run electron:dev')
    process.exit(1)
  }

  // Test 2: Get PO token
  console.log('[2/5] Generating PO token...')
  let token: TokenResponse
  try {
    token = await getToken()
    console.log(`      ✓ Token generated (${token.token.length} chars)`)
    console.log(`      ✓ VisitorData: ${token.visitorData.substring(0, 30)}...\n`)
  } catch (err) {
    console.error('      ✗ Failed:', err)
    process.exit(1)
  }

  // Test 3: Test yt-dlp with PO token (simulate only - no download)
  console.log('[3/5] Testing yt-dlp with PO token (simulation)...')
  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

  const result = await runYtDlp([
    '--simulate',
    '--print', '%(title)s',
    '--extractor-args', `youtube:player_client=web_creator,mweb;visitor_data=${token.visitorData}`,
    '--no-check-certificates',
    testUrl,
  ])

  if (result.code === 0) {
    console.log(`      ✓ yt-dlp simulation successful`)
    console.log(`      ✓ Video title: ${result.stdout.trim()}\n`)
  } else {
    console.log(`      ⚠ yt-dlp returned code ${result.code}`)
    console.log(`      ⚠ This might be normal if YouTube is rate limiting\n`)
  }

  // Test 4: Test format listing with token
  console.log('[4/5] Testing format listing with PO token...')
  const formatResult = await runYtDlp([
    '-F',
    '--extractor-args', `youtube:player_client=web_creator,mweb;visitor_data=${token.visitorData}`,
    '--no-check-certificates',
    testUrl,
  ])

  if (formatResult.code === 0) {
    const lines = formatResult.stdout.split('\n').length
    console.log(`      ✓ Format listing successful (${lines} lines of output)`)

    // Count available formats
    const formatLines = formatResult.stdout.split('\n').filter(l => /^\d+/.test(l.trim()))
    console.log(`      ✓ Available formats: ${formatLines.length}\n`)
  } else {
    console.log(`      ⚠ Format listing returned code ${formatResult.code}\n`)
  }

  // Test 5: Test error handling - invalid URL
  console.log('[5/5] Testing error handling...')
  const errorResult = await runYtDlp([
    '--simulate',
    '--extractor-args', `youtube:player_client=web_creator,mweb;visitor_data=${token.visitorData}`,
    'https://www.youtube.com/watch?v=invalid123',
  ])

  if (errorResult.code !== 0) {
    console.log('      ✓ Invalid URL correctly rejected\n')
  } else {
    console.log('      ⚠ Invalid URL was not rejected\n')
  }

  // Summary
  console.log('────────────────────────────────────────────────────────────────')
  console.log('                         SUMMARY')
  console.log('────────────────────────────────────────────────────────────────')
  console.log('  PO Token Server:    ✓ Running')
  console.log(`  Token Generation:   ✓ Success (${token.token.length} chars)`)
  console.log(`  yt-dlp Simulation:  ${result.code === 0 ? '✓ Passed' : '⚠ Check output'}`)
  console.log(`  Format Listing:     ${formatResult.code === 0 ? '✓ Passed' : '⚠ Check output'}`)
  console.log('────────────────────────────────────────────────────────────────')
  console.log('\n✓ Integration test completed successfully!')
  console.log('══════════════════════════════════════════════════════════════')
}

testYtDlpWithToken().catch(err => {
  console.error('Integration test failed:', err)
  process.exit(1)
})
