/**
 * Platform detection and styling utilities
 */

export function detectPlatform(url: string): string | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube'
  }
  if (urlLower.includes('twitch.tv')) {
    return 'twitch'
  }
  if (urlLower.includes('tiktok.com')) {
    return 'tiktok'
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter'
  }
  if (urlLower.includes('instagram.com')) {
    return 'instagram'
  }
  if (urlLower.includes('reddit.com')) {
    return 'reddit'
  }
  if (urlLower.includes('vimeo.com')) {
    return 'vimeo'
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
    return 'facebook'
  }

  return null
}

export function getPlatformIcon(platform: string | null): string {
  switch (platform) {
    case 'youtube':
      return '▶' // Play icon
    case 'twitch':
      return '◆' // Diamond
    case 'tiktok':
      return '♪' // Music note
    case 'twitter':
      return '𝕏' // X
    case 'instagram':
      return '○' // Camera circle
    case 'reddit':
      return '◉' // Robot
    case 'vimeo':
      return '◈' // Film
    case 'facebook':
      return 'f' // F
    default:
      return '◇' // Link
  }
}

export function getPlatformColor(platform: string | null): string {
  switch (platform) {
    case 'youtube':
      return '#ff0000'
    case 'twitch':
      return '#9146ff'
    case 'tiktok':
      return '#00f2ea'
    case 'twitter':
      return '#1da1f2'
    case 'instagram':
      return '#e1306c'
    case 'reddit':
      return '#ff4500'
    case 'vimeo':
      return '#1ab7ea'
    case 'facebook':
      return '#1877f2'
    default:
      return '#6b7280' // Gray
  }
}

export function getPlatformLabel(platform: string | null): string {
  if (!platform) return 'OTHER'
  return platform.toUpperCase()
}
