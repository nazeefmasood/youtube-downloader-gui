/**
 * Multi-Platform URL Detection Tests
 * Tests URL validation and detection for 200+ platforms supported by yt-dlp
 *
 * Run with: npx tsx tests/multi-platform.test.ts
 */

// URL validation function (copied from httpServer.ts for testing)
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// Platform detection (copied from AnalyzeTab.tsx for testing)
interface DetectedUrl {
  url: string
  type: 'video' | 'playlist' | 'channel' | 'unknown'
  id: string | null
  isValid: boolean
  selected: boolean
}

function parseUrl(url: string): DetectedUrl {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { url, type: 'unknown', id: null, isValid: false, selected: false }
    }

    // YouTube
    const isYouTube =
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'm.youtube.com' ||
      parsed.hostname === 'youtu.be' ||
      parsed.hostname === 'www.youtu.be' ||
      parsed.hostname === 'music.youtube.com'

    // Twitch
    const isTwitch =
      parsed.hostname === 'www.twitch.tv' ||
      parsed.hostname === 'twitch.tv' ||
      parsed.hostname === 'clips.twitch.tv'

    // Twitter/X
    const isTwitter =
      parsed.hostname === 'twitter.com' ||
      parsed.hostname === 'www.twitter.com' ||
      parsed.hostname === 'x.com' ||
      parsed.hostname === 'www.x.com'

    // TikTok
    const isTikTok =
      parsed.hostname === 'www.tiktok.com' ||
      parsed.hostname === 'tiktok.com' ||
      parsed.hostname === 'vm.tiktok.com'

    // Instagram
    const isInstagram =
      parsed.hostname === 'www.instagram.com' ||
      parsed.hostname === 'instagram.com'

    // Reddit
    const isReddit =
      parsed.hostname === 'www.reddit.com' ||
      parsed.hostname === 'reddit.com' ||
      parsed.hostname.endsWith('.reddit.com')

    // Vimeo
    const isVimeo =
      parsed.hostname === 'vimeo.com' ||
      parsed.hostname === 'www.vimeo.com' ||
      parsed.hostname === 'player.vimeo.com'

    // For known platforms, mark as video
    if (isTwitch || isTwitter || isTikTok || isInstagram || isReddit || isVimeo) {
      return {
        url,
        type: 'video',
        id: parsed.pathname.split('/').filter(Boolean).pop() || null,
        isValid: true,
        selected: true,
      }
    }

    // For YouTube, do detailed parsing
    if (isYouTube) {
      if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
        const videoId = parsed.pathname.slice(1)
        if (videoId) {
          return { url, type: 'video', id: videoId, isValid: true, selected: true }
        }
      }
      return { url, type: 'video', id: null, isValid: true, selected: true }
    }

    // Unknown platform - still try (yt-dlp supports 1000+ sites)
    return {
      url,
      type: 'video',
      id: null,
      isValid: true,
      selected: true,
    }
  } catch {
    return { url, type: 'unknown', id: null, isValid: false, selected: false }
  }
}

// Test runner
let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✅ PASS: ${name}`)
    passed++
  } catch (error) {
    console.log(`❌ FAIL: ${name}`)
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
    failed++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`)
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`)
      }
    },
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`Expected true, got ${actual}`)
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`Expected false, got ${actual}`)
      }
    },
  }
}

console.log('\n🧪 Multi-Platform URL Detection Tests\n')
console.log('=' .repeat(60))

// ============ YouTube Tests ============
console.log('\n📺 YouTube URLs')
const youtubeUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtube.com/watch?v=dQw4w9WgXcQ',
  'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtu.be/dQw4w9WgXcQ',
  'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/playlist?list=PLtest123',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
]

youtubeUrls.forEach((url) => {
  test(`YouTube: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Twitch Tests ============
console.log('\n🎮 Twitch URLs')
const twitchUrls = [
  'https://www.twitch.tv/shroud',
  'https://twitch.tv/shroud',
  'https://www.twitch.tv/shroud/v/123456789',
  'https://clips.twitch.tv/TestClip',
  'https://www.twitch.tv/videos/123456789',
]

twitchUrls.forEach((url) => {
  test(`Twitch: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Twitter/X Tests ============
console.log('\n🐦 Twitter/X URLs')
const twitterUrls = [
  'https://twitter.com/user/status/123456789',
  'https://www.twitter.com/user/status/123456789',
  'https://x.com/user/status/123456789',
  'https://www.x.com/user/status/123456789',
]

twitterUrls.forEach((url) => {
  test(`Twitter/X: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ TikTok Tests ============
console.log('\n🎵 TikTok URLs')
const tiktokUrls = [
  'https://www.tiktok.com/@user/video/123456789',
  'https://tiktok.com/@user/video/123456789',
  'https://vm.tiktok.com/ZM6abc123/',
]

tiktokUrls.forEach((url) => {
  test(`TikTok: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Instagram Tests ============
console.log('\n📸 Instagram URLs')
const instagramUrls = [
  'https://www.instagram.com/reel/abc123/',
  'https://instagram.com/reel/abc123/',
  'https://www.instagram.com/p/abc123/',
  'https://www.instagram.com/tv/abc123/',
]

instagramUrls.forEach((url) => {
  test(`Instagram: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Reddit Tests ============
console.log('\n🔴 Reddit URLs')
const redditUrls = [
  'https://www.reddit.com/r/videos/comments/abc123/',
  'https://reddit.com/r/videos/comments/abc123/',
  'https://old.reddit.com/r/videos/comments/abc123/',
  'https://v.redd.it/abc123',
]

redditUrls.forEach((url) => {
  test(`Reddit: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Vimeo Tests ============
console.log('\n🎬 Vimeo URLs')
const vimeoUrls = [
  'https://vimeo.com/123456789',
  'https://www.vimeo.com/123456789',
  'https://player.vimeo.com/video/123456789',
]

vimeoUrls.forEach((url) => {
  test(`Vimeo: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Other Platforms (200+) ============
console.log('\n🌐 Other Supported Platforms')
const otherPlatformUrls = [
  { platform: 'Facebook', url: 'https://www.facebook.com/watch?v=123456789' },
  { platform: 'Facebook', url: 'https://fb.watch/abc123/' },
  { platform: 'Dailymotion', url: 'https://www.dailymotion.com/video/x123abc' },
  { platform: 'Bilibili', url: 'https://www.bilibili.com/video/BV1abc123' },
  { platform: 'SoundCloud', url: 'https://soundcloud.com/artist/track-name' },
  { platform: 'Spotify', url: 'https://open.spotify.com/track/123abc' },
  { platform: 'Rumble', url: 'https://rumble.com/v123abc-video-title.html' },
  { platform: 'Odysee', url: 'https://odysee.com/@channel:123/video:456' },
  { platform: 'BitChute', url: 'https://www.bitchute.com/video/abc123/' },
  { platform: 'Streamable', url: 'https://streamable.com/abc123' },
  { platform: 'Imgur', url: 'https://imgur.com/gallery/abc123' },
  { platform: 'Pinterest', url: 'https://www.pinterest.com/pin/123456789/' },
  { platform: 'LinkedIn', url: 'https://www.linkedin.com/posts/activity-123456789' },
  { platform: 'Patreon', url: 'https://www.patreon.com/posts/video-post-123456' },
]

otherPlatformUrls.forEach(({ platform, url }) => {
  test(`${platform}: ${url}`, () => {
    expect(isValidUrl(url)).toBeTrue()
    const parsed = parseUrl(url)
    // Unknown platforms should still be marked as valid (yt-dlp handles validation)
    expect(parsed.isValid).toBeTrue()
    expect(parsed.type).toBe('video')
  })
})

// ============ Invalid URLs ============
console.log('\n🚫 Invalid URLs')
const invalidUrls = [
  { desc: 'not a url', url: 'not a url' },
  { desc: 'ftp protocol', url: 'ftp://example.com/video' },
  { desc: 'javascript', url: 'javascript:alert(1)' },
  { desc: 'file protocol', url: 'file:///etc/passwd' },
  { desc: 'empty string', url: '' },
  { desc: 'just http://', url: 'http://' },
]

invalidUrls.forEach(({ desc, url }) => {
  test(`Invalid: ${desc}`, () => {
    expect(isValidUrl(url)).toBeFalse()
  })
})

// ============ Edge Cases ============
console.log('\n🔧 Edge Cases')

test('URL with query parameters', () => {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123s'
  expect(isValidUrl(url)).toBeTrue()
})

test('URL with fragment', () => {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=123'
  expect(isValidUrl(url)).toBeTrue()
})

test('URL with special characters', () => {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123'
  expect(isValidUrl(url)).toBeTrue()
})

test('URL with port', () => {
  const url = 'https://example.com:8080/video/123'
  expect(isValidUrl(url)).toBeTrue()
})

test('HTTP (non-HTTPS) URL', () => {
  const url = 'http://example.com/video.mp4'
  expect(isValidUrl(url)).toBeTrue()
})

// ============ Summary ============
console.log('\n' + '=' .repeat(60))
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
