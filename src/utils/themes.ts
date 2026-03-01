/**
 * Theme system for Grab
 * Supports preset themes and custom accent colors
 */

export interface ThemeColors {
  name: string
  displayName: string
  colors: {
    accent: string       // Primary accent color
    accentHover: string  // Accent hover state
    accentLight: string  // Accent as transparent background
    success: string      // Success/completed color
    warning: string      // Warning color
    error: string        // Error/failed color
  }
}

/**
 * Generate hover and light variants from a base color
 */
export function generateColorVariants(baseColor: string): {
  accent: string
  accentHover: string
  accentLight: string
} {
  // Convert hex to RGB
  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Generate hover (slightly darker)
  const hoverFactor = 0.85
  const hoverR = Math.round(r * hoverFactor)
  const hoverG = Math.round(g * hoverFactor)
  const hoverB = Math.round(b * hoverFactor)
  const accentHover = `#${hoverR.toString(16).padStart(2, '0')}${hoverG.toString(16).padStart(2, '0')}${hoverB.toString(16).padStart(2, '0')}`

  // Generate light variant (transparent)
  const accentLight = `rgba(${r}, ${g}, ${b}, 0.1)`

  return {
    accent: baseColor,
    accentHover,
    accentLight,
  }
}

/**
 * Get complementary color (for success state to match accent)
 * Currently returns a fixed success color that works well with most themes
 */
export function getComplementaryColor(_baseColor: string): string {
  // Fixed success color that works well with most accent colors
  return '#22c55e'
}

/**
 * Preset themes with carefully chosen color palettes
 */
export const PRESET_THEMES: ThemeColors[] = [
  {
    name: 'purple',
    displayName: 'Purple',
    colors: {
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      accentLight: 'rgba(139, 92, 246, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'ocean',
    displayName: 'Ocean Blue',
    colors: {
      accent: '#0ea5e9',
      accentHover: '#0284c7',
      accentLight: 'rgba(14, 165, 233, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'forest',
    displayName: 'Forest Green',
    colors: {
      accent: '#22c55e',
      accentHover: '#16a34a',
      accentLight: 'rgba(34, 197, 94, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'sunset',
    displayName: 'Sunset Orange',
    colors: {
      accent: '#f97316',
      accentHover: '#ea580c',
      accentLight: 'rgba(249, 115, 22, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'midnight',
    displayName: 'Midnight Indigo',
    colors: {
      accent: '#6366f1',
      accentHover: '#4f46e5',
      accentLight: 'rgba(99, 102, 241, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'rose',
    displayName: 'Rose Pink',
    colors: {
      accent: '#ec4899',
      accentHover: '#db2777',
      accentLight: 'rgba(236, 72, 153, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'cyan',
    displayName: 'Cyan Teal',
    colors: {
      accent: '#06b6d4',
      accentHover: '#0891b2',
      accentLight: 'rgba(6, 182, 212, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    name: 'emerald',
    displayName: 'Emerald',
    colors: {
      accent: '#10b981',
      accentHover: '#059669',
      accentLight: 'rgba(16, 185, 129, 0.1)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
]

/**
 * Get theme by name
 */
export function getThemeByName(name: string): ThemeColors | undefined {
  return PRESET_THEMES.find((theme) => theme.name === name)
}

/**
 * Create custom theme from accent color
 */
export function createCustomTheme(accentColor: string): ThemeColors {
  const variants = generateColorVariants(accentColor)
  return {
    name: 'custom',
    displayName: 'Custom',
    colors: {
      ...variants,
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  }
}

/**
 * Apply theme to document root CSS variables
 */
export function applyTheme(theme: ThemeColors): void {
  const root = document.documentElement

  root.style.setProperty('--accent', theme.colors.accent)
  root.style.setProperty('--accent-hover', theme.colors.accentHover)
  root.style.setProperty('--accent-dim', theme.colors.accentHover)
  root.style.setProperty('--accent-glow', theme.colors.accentLight)
  root.style.setProperty('--success', theme.colors.success)
  root.style.setProperty('--warning', theme.colors.warning)
  root.style.setProperty('--error', theme.colors.error)
}

/**
 * Default theme (purple - original Grab look)
 */
export const DEFAULT_THEME: ThemeColors = PRESET_THEMES[0]
