import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function parseYouTubeUrl(url: string): { type: 'video' | 'playlist' | 'channel' | 'unknown'; id: string | null } {
  try {
    const urlObj = new URL(url)

    // Video patterns
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      const videoId = urlObj.searchParams.get('v')
      if (videoId) {
        return { type: 'video', id: videoId }
      }
    }

    // Short URL
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1)
      if (videoId) {
        return { type: 'video', id: videoId }
      }
    }

    // Playlist
    if (urlObj.searchParams.get('list')) {
      return { type: 'playlist', id: urlObj.searchParams.get('list') }
    }

    // Channel patterns
    if (urlObj.pathname.startsWith('/channel/') ||
        urlObj.pathname.startsWith('/c/') ||
        urlObj.pathname.startsWith('/@')) {
      const channelId = urlObj.pathname.split('/')[2] || urlObj.pathname.slice(2)
      return { type: 'channel', id: channelId }
    }

    return { type: 'unknown', id: null }
  } catch {
    return { type: 'unknown', id: null }
  }
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}
