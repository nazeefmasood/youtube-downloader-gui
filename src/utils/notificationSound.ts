/**
 * Notification Sound Utility
 * Uses Web Audio API to generate synthesized sounds without external files
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Play a success sound (ascending pleasant tone: C4 -> E4 -> G4)
 * @param volume Volume from 0 to 100
 */
export function playSuccessSound(volume: number = 50): void {
  try {
    const ctx = getAudioContext()
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100
    const now = ctx.currentTime

    // Note frequencies: C4=261.63Hz, E4=329.63Hz, G4=392.00Hz
    const notes = [
      { freq: 261.63, startTime: 0, duration: 0.15 },
      { freq: 329.63, startTime: 0.1, duration: 0.15 },
      { freq: 392.00, startTime: 0.2, duration: 0.25 },
    ]

    notes.forEach(({ freq, startTime, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + startTime)

      // Envelope: attack, decay, sustain, release
      gain.gain.setValueAtTime(0, now + startTime)
      gain.gain.linearRampToValueAtTime(normalizedVolume * 0.3, now + startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + startTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + startTime)
      osc.stop(now + startTime + duration)
    })
  } catch (error) {
    console.error('Failed to play success sound:', error)
  }
}

/**
 * Play an error sound (descending tone: G4 -> E4 -> C4)
 * @param volume Volume from 0 to 100
 */
export function playErrorSound(volume: number = 50): void {
  try {
    const ctx = getAudioContext()
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100
    const now = ctx.currentTime

    // Descending notes for error indication
    const notes = [
      { freq: 392.00, startTime: 0, duration: 0.12 },
      { freq: 329.63, startTime: 0.08, duration: 0.12 },
      { freq: 261.63, startTime: 0.16, duration: 0.2 },
    ]

    notes.forEach(({ freq, startTime, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      // Use sawtooth for a more "alert" sound
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + startTime)

      // Sharper envelope for error sound
      gain.gain.setValueAtTime(0, now + startTime)
      gain.gain.linearRampToValueAtTime(normalizedVolume * 0.25, now + startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + startTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + startTime)
      osc.stop(now + startTime + duration)
    })
  } catch (error) {
    console.error('Failed to play error sound:', error)
  }
}

/**
 * Play a notification sound based on type
 * @param type 'success' or 'error'
 * @param volume Volume from 0 to 100
 */
export function playNotificationSound(type: 'success' | 'error', volume: number = 50): void {
  if (type === 'success') {
    playSuccessSound(volume)
  } else {
    playErrorSound(volume)
  }
}

/**
 * Resume audio context if suspended (required by some browsers)
 */
export function ensureAudioContextReady(): void {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
  } catch (error) {
    console.error('Failed to resume audio context:', error)
  }
}
