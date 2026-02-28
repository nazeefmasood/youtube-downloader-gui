# VidGrab Design Guidelines

## Cyber Brutalism UI Design Philosophy

VidGrab follows a **Cyber Brutalism** design philosophy that emphasizes:

- **Bold Typography** - Space Grotesk font with strong letter-spacing and uppercase labels
- **High Contrast** - Stark borders, clear visual hierarchy, minimal gradients
- **Geometric Shapes** - Sharp corners, angular elements, prominent borders
- **Raw Aesthetics** - Visible structure, technical/terminal-inspired elements
- **Clarity Over Decoration** - Every element serves a functional purpose
- **Visual Impact** - Strong accent colors, confident design choices

**Anti-Patterns to Avoid:**
- Generic AI aesthetics (overly smooth, rounded, safe designs)
- Excessive gradients and blur effects
- Hidden or subtle interactions (make them obvious)
- Unnecessary decoration without purpose

---

## Color System

### CSS Custom Properties

All colors use CSS custom properties for theming support.

#### Core Colors (Dark Mode - Default)

```css
:root, [data-theme="dark"] {
  --bg-primary: #0a0a0a;      /* Main background */
  --bg-secondary: #111111;    /* Panel backgrounds */
  --bg-tertiary: #1a1a1a;     /* Input/card backgrounds */
  --bg-elevated: #222222;     /* Hover/active states */
  --border: #2a2a2a;          /* Default borders */
  --border-accent: #3a3a3a;   /* Accent borders */
  --text-primary: #ffffff;    /* Main text */
  --text-secondary: #888888;  /* Labels, secondary text */
  --text-muted: #555555;      /* Hints, placeholders */
  --overlay: rgba(0, 0, 0, 0.8);
}
```

#### Core Colors (Light Mode)

```css
[data-theme="light"] {
  --bg-primary: #fafafa;
  --bg-secondary: #f0f0f0;
  --bg-tertiary: #e8e8e8;
  --bg-elevated: #ffffff;
  --border: #d4d4d4;
  --border-accent: #bdbdbd;
  --text-primary: #1a1a1a;
  --text-secondary: #4a4a4a;
  --text-muted: #7a7a7a;
  --overlay: rgba(255, 255, 255, 0.95);
}
```

#### Accent Colors (Themeable)

```css
/* Default Green Accent */
--accent: #00ff88;
--accent-dim: #00cc6a;
--accent-glow: rgba(0, 255, 136, 0.3);
--success: #00ff88;
--warning: #ffaa00;
--error: #ff3366;
```

### Preset Themes

| Name | Accent | Usage |
|------|--------|-------|
| Purple | `#8b5cf6` | Default theme |
| Ocean Blue | `#0ea5e9` | Calm, professional |
| Forest Green | `#22c55e` | Natural, growth |
| Sunset Orange | `#f97316` | Energy, warmth |
| Midnight Indigo | `#6366f1` | Deep, technical |
| Rose Pink | `#ec4899` | Vibrant, playful |
| Cyan Teal | `#06b6d4` | Fresh, modern |
| Emerald | `#10b981` | Balanced, refined |

### Color Usage Guidelines

1. **Backgrounds** - Use the 4-tier system (primary, secondary, tertiary, elevated) to create depth
2. **Borders** - Always use `var(--border)` for standard dividers, `var(--border-accent)` for emphasis
3. **Text** - Never hardcode colors; always use semantic variables
4. **Accents** - Reserve for CTAs, active states, success indicators
5. **Status Colors** - Use `--success`, `--warning`, `--error` for status states only

---

## Typography

### Font Family: Space Grotesk

```css
font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Available Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Large display text (rare) |
| Regular | 400 | Body text, descriptions |
| Medium | 500 | Emphasized body text |
| SemiBold | 600 | Labels, buttons |
| Bold | 700 | Headers, titles |

### Typography Standards

```css
/* Labels, UI Elements */
font-size: 10px;
font-weight: 600;
letter-spacing: 0.15em;      /* Wide tracking for uppercase */
text-transform: uppercase;    /* Always uppercase for labels */

/* Section Headers */
font-size: 11px;
font-weight: 700;
letter-spacing: 0.2em;
text-transform: uppercase;

/* Titles */
font-size: 14-16px;
font-weight: 700;
letter-spacing: 0.02em;      /* Tighter tracking for readability */
text-transform: uppercase;    /* Titles are uppercase */

/* Body Text */
font-size: 12-14px;
font-weight: 400;
line-height: 1.5;

/* Code/Mono */
font-family: 'Space Grotesk Mono', 'SF Mono', 'Consolas', monospace;
font-size: 11px;
```

### Text Transformation Rules

| Element Type | Transform | Example |
|--------------|-----------|---------|
| Labels/Buttons | UPPERCASE | "DOWNLOAD", "CANCEL" |
| Section Headers | UPPERCASE | "DOWNLOAD QUEUE", "SETTINGS" |
| Content Titles | UPPERCASE | "VIDEO TITLE HERE" |
| Body Text | Sentence case | "Select a format to download" |
| Code/Commands | lowercase | `npm install` |

### Letter Spacing Standards

| Context | Value |
|---------|-------|
| Uppercase labels | `0.15em - 0.2em` |
| Uppercase titles | `0.02em - 0.05em` |
| Body text | `0` (default) |
| Numbers/Technical | `0.05em` |

---

## Components

### Buttons

#### Primary Button (`.btn-primary`)

```tsx
<button type="button" className="btn-primary">
  Download
</button>
```

**Style:**
- Background: `var(--accent)`
- Text: `var(--bg-primary)` (contrast)
- Padding: `12px 24px`
- No border
- Rounded: `4px` (minimal)
- Uppercase, 700 weight

**States:**
- Hover: Background `var(--accent-dim)`, `translateY(-2px)`, shadow
- Active: `translateY(0)`
- Disabled: Opacity 0.3

#### Secondary Button (`.btn-secondary`, `.btn-outline`)

```tsx
<button type="button" className="btn-secondary">
  Cancel
</button>
```

**Style:**
- Background: Transparent
- Border: `1px solid var(--border)`
- Text: `var(--text-secondary)`
- Padding: `8px 16px`

**States:**
- Hover: Border `var(--accent)`, text `var(--accent)`, `translateY(-1px)`

#### Download/Action Button (`.btn-download`)

```tsx
<button type="button" className="btn-download">
  <DownloadIcon />
  DOWNLOAD
  <span className="shortcut-hint">D</span>
</button>
```

**Style:**
- Background: `var(--text-primary)` (inverted)
- Text: `var(--bg-primary)`
- Large padding: `14px 28px`
- Icon support
- Optional keyboard shortcut hint

#### Icon Buttons

```tsx
<button
  type="button"
  className="theme-toggle"
  title="Toggle theme"
>
  <MoonIcon />
</button>
```

**Style:**
- Square: `36px x 36px` or `40px x 40px`
- Centered content
- Border: `1px solid var(--border)`
- Hover: Rotate, scale, border color change

### Cards

#### Stat Card (`.stat-card`)

```tsx
<div className="stat-card">
  <div className="stat-card-header">
    <span className="stat-card-icon">ICON</span>
    <span className="stat-card-title">LABEL</span>
  </div>
  <div className="stat-card-value">1,234</div>
  <div className="stat-card-footer">
    <span className="stat-card-subtitle">subtitle</span>
  </div>
</div>
```

**Style:**
- Background: `var(--bg-secondary)`
- Border: `1px solid var(--border)`
- Padding: `16px`
- Corner accents (brackets) on hover

#### Content Card (`.content-info`)

```tsx
<div className="content-info">
  <div className="content-header">
    <div className="content-thumbnail">
      <img src={thumbnail} alt="" />
    </div>
    <div className="content-details">
      <span className="content-type">VIDEO</span>
      <h3 className="content-title">Title Here</h3>
      <div className="content-meta">
        <span className="content-meta-item">Duration</span>
        <span className="content-meta-item">Format</span>
      </div>
    </div>
  </div>
</div>
```

### Charts

All charts use Recharts with consistent styling:

```tsx
<ResponsiveContainer width="100%" height={250}>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
    <XAxis stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} fontSize={12} />
    <YAxis stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} fontSize={12} />
    <Tooltip contentStyle={{
      backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
      border: '1px solid ' + (theme === 'dark' ? '#374151' : '#e5e7eb'),
      borderRadius: '8px',
    }} />
  </AreaChart>
</ResponsiveContainer>
```

**Chart Colors Palette:**
```css
--chart-purple: #8b5cf6;
--chart-green: #22c55e;
--chart-orange: #f59e0b;
--chart-red: #ef4444;
--chart-blue: #0ea5e9;
--chart-pink: #ec4899;
--chart-indigo: #6366f1;
--chart-lime: #84cc16;
```

### Forms

#### Text Input (`.url-input`, `.setting-input`)

```tsx
<input
  type="text"
  className="url-input"
  placeholder="Paste YouTube URL here..."
/>
```

**Style:**
- Background: `var(--bg-primary)`
- Border: `1px solid var(--border)`
- Padding: `14px 16px`
- Font: Inherit, 13px
- Focus: Border `var(--accent)`, `box-shadow: 0 0 0 3px var(--accent-glow)`

#### Select Dropdown (`.setting-select`)

```tsx
<select className="setting-select">
  <option value="mp4">MP4</option>
  <option value="webm">WebM</option>
</select>
```

**Style:**
- Background: `var(--bg-tertiary)`
- Border: `1px solid var(--border)`
- Padding: `8px 12px`
- Font: Inherit, 12px

#### Toggle Switch (`.toggle`)

```tsx
<button
  type="button"
  className={`toggle ${enabled ? 'on' : ''}`}
  onClick={toggle}
>
  <span className="toggle-knob" />
</button>
```

**Style:**
- Size: `44px x 24px`
- Background: `var(--bg-tertiary)` → `var(--accent)` when on
- Border: `1px solid var(--border)`
- Knob: `18px` circle, slides left to right

#### Checkbox (`.video-checkbox`)

```tsx
<div
  className={`video-checkbox ${checked ? 'checked' : ''}`}
  onClick={toggle}
>
  {checked && <CheckIcon />}
</div>
```

**Style:**
- Size: `20px x 20px`
- Border: `2px solid var(--border)`
- Background: Transparent → `var(--accent)` when checked
- Icon appears when checked

### Modals & Overlays

#### Modal Overlay (`.changelog-brutal-overlay`)

```tsx
<div className="changelog-brutal-overlay">
  <div className="changelog-brutal-container">
    <div className="changelog-scanlines" />
    {/* Content */}
  </div>
</div>
```

**Style:**
- Overlay: `rgba(0, 0, 0, 0.95)` fixed, inset 0
- Container: `var(--bg-primary)`, `border: 2px solid var(--accent)`
- Scanline effect: Repeating gradient overlay
- Animation: `fadeIn 0.2s ease-out`, `brutalSlideIn 0.3s`

### Progress Indicators

#### Progress Bar (`.queue-progress-bar`)

```tsx
<div className="queue-progress-bar">
  <div
    className="queue-progress-fill"
    style={{ width: `${percent}%` }}
  />
</div>
```

**Style:**
- Track: `var(--bg-tertiary)`, `4px` height
- Fill: `var(--accent)`, animated with stripes
- Optional glow effect

#### Progress Ring (SVG)

```tsx
<svg className="progress-ring" width="100" height="100">
  <circle className="progress-ring-bg" cx="50" cy="50" r="40" strokeWidth="8" />
  <circle
    className="progress-ring-fill"
    cx="50" cy="50" r="40" strokeWidth="8"
    strokeDasharray={circumference}
    strokeDashoffset={strokeDashoffset}
  />
</svg>
```

#### Spinner (`.spinner`)

```css
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
```

---

## Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| 4px | 0.25rem | Tight spacing between related elements |
| 8px | 0.5rem | Default gap between small elements |
| 12px | 0.75rem | Gap between medium elements |
| 16px | 1rem | Standard padding, card spacing |
| 24px | 1.5rem | Large padding, section gaps |
| 32px | 2rem | Extra large spacing |
| 48px | 3rem | Hero/empty state spacing |

### Layout Patterns

```tsx
/* Flex row with standard gap */
<div style={{ display: 'flex', gap: '8px' }}>

/* Flex column with standard gap */
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

/* Grid for cards */
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
```

### Container Standards

| Container | Max Width | Padding |
|-----------|-----------|---------|
| Main content | 100% | 16px |
| Modal | 90vw, 600px | 24px |
| Card | 100% | 16px |
| Toolbar | 100% | 8px 16px |

### Responsive Breakpoints

While VidGrab is an Electron app with fixed window sizing, use these for internal layout:

```css
/* Small sidebar/panel */
@media (max-width: 300px) { ... }

/* Compact mode */
@media (max-width: 600px) { ... }

/* Standard desktop */
@media (min-width: 601px) { ... }
```

---

## Animations & Transitions

### Standard Transitions

```css
/* Fast interactions (hover, focus) */
transition: all 0.15s ease;

/* Standard interactions */
transition: all 0.2s ease;

/* Slow transitions (theme, layout) */
transition: all 0.3s ease;

/* Complex easing (springs) */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### Keyframe Animations

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Fade in with slide up */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale in */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* Spin (loader) */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Blink (cursor) */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

### Hover Effects

```css
/* Subtle lift */
:hover {
  transform: translateY(-1px);
}

/* Border glow */
:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* Invert */
:hover {
  background: var(--accent);
  color: var(--bg-primary);
}
```

### Loading States

1. **Spinner** - Use `.spinner` for inline loading
2. **Skeleton** - Use shimmer animation for content placeholders
3. **Pulse** - Use `opacity` animation for status indicators
4. **Progress** - Always show progress for downloads/operations

---

## Iconography

### SVG Icons

All icons are inline SVG components. Use Lucide or Heroicons as source.

```tsx
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
```

### Icon Sizes

| Size | Value | Usage |
|------|-------|-------|
| XS | 12px | Inline icons, badges |
| SM | 14px | Buttons, list items |
| MD | 16px | Standard icons |
| LG | 20px | Headers, cards |
| XL | 24px | Large displays |
| XXL | 32-64px | Empty states, hero |

### Icon Spacing

```tsx
{/* Icon with text */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <Icon />
  <span>Text</span>
</div>

{/* Icon button */}
<button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
  <Icon />
</button>
```

### Icon Colors

```css
/* Default (inherits text color) */
stroke: currentColor;

/* Accent */
stroke: var(--accent);

/* Muted */
stroke: var(--text-muted);

/* Semantic */
stroke: var(--success);
stroke: var(--warning);
stroke: var(--error);
```

---

## Accessibility

### Button Requirements

1. **Always include `type` attribute**
   ```tsx
   <button type="button">...</button>
   <button type="submit">...</button>
   ```

2. **Include `title` for icon-only buttons**
   ```tsx
   <button type="button" title="Download">
     <DownloadIcon />
   </button>
   ```

3. **Visible focus states**
   ```css
   &:focus-visible {
     outline: 2px solid var(--accent);
     outline-offset: 2px;
   }
   ```

### Form Requirements

1. **All inputs need labels**
   ```tsx
   <label htmlFor="url-input">URL</label>
   <input id="url-input" type="text" />
   ```

2. **Placeholder is not a label** - Use aria-label if needed
   ```tsx
   <input aria-label="YouTube URL" placeholder="Paste URL..." />
   ```

3. **Error messages must be associated**
   ```tsx
   <input aria-describedby="error-message" aria-invalid={hasError} />
   <span id="error-message" role="alert">{error}</span>
   ```

### Color Contrast

Ensure WCAG AA compliance:
- Normal text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

Current dark theme passes all checks.

### Keyboard Navigation

All interactive elements must be keyboard accessible:
- Tab order follows visual layout
- Enter/Space activate buttons
- Escape closes modals
- Arrow keys navigate lists

---

## Code Patterns

### CSS Class Naming

Use kebab-case for all CSS classes:
- `.stat-card`
- `.btn-primary`
- `.queue-progress-bar`

### Modifier Pattern

Use modifier classes for states:
- `.btn-primary` → Base
- `.btn-primary:hover` → State
- `.btn-primary:disabled` → State
- `.video-checkbox.checked` → Modifier

### When to Use Inline Styles

**Avoid inline styles for:**
- Colors (use CSS variables)
- Spacing (use padding/margin classes or CSS)
- Typography (use font classes)

**Use inline styles for:**
- Dynamic values (width, height from state)
- Conditional transforms
- Animation delays
- Component-specific calculated values

```tsx
{/* Good: Dynamic value */}
<div style={{ width: `${progress}%` }} />

{/* Good: Transform from state */}
<div style={{ transform: `translateX(${offset}px)` }} />

{/* Bad: Static color */}
<div style={{ color: '#ff0000' }} />
{/* Use: color: var(--error) */}
```

### CSS Custom Properties Usage

Always reference variables, never hardcode:

```tsx
{/* Correct */}
className="text-[var(--text-secondary)]"

{/* Incorrect */}
className="text-[#888888]"
```

For Tailwind, use arbitrary values with CSS variables:
```tsx
<div className="bg-[var(--bg-primary)] border-[var(--border)]">
```

---

## Component Examples

### Empty State

```tsx
<div className="empty-state">
  <div className="empty-state-icon">
    <Icon />
  </div>
  <div className="empty-state-title">TITLE<span className="blink">_</span></div>
  <div className="empty-state-text">// Description text</div>
</div>
```

### Section Header

```tsx
<div className="video-list-header">
  <div className="video-list-header-left">
    <span className="video-list-title">// SECTION TITLE</span>
    <span className="video-list-count">5 items</span>
  </div>
  <div className="video-list-controls">
    <button type="button" className="btn-select">Action</button>
  </div>
</div>
```

### Status Badge

```tsx
<span className="queue-badge downloading">ACTIVE</span>
<span className="queue-badge pending">QUEUED</span>
<span className="queue-badge completed">DONE</span>
```

### Label With Prefix

```tsx
<div className="url-bar-label">
  Enter URL
</div>
/* CSS adds // prefix via ::before */
```

---

## File Structure

```
src/
├── index.css          # Global styles, CSS variables, base components
├── components/
│   ├── tabs/          # Tab-specific components
│   └── ...            # Shared components
└── utils/
    └── themes.ts      # Theme definitions and utilities
```

---

## Best Practices Summary

1. **Always use CSS variables** for colors, spacing, typography
2. **Include `type="button"`** on all non-form buttons
3. **Use uppercase for labels** with appropriate letter-spacing
4. **Add hover states** to all interactive elements
5. **Provide visual feedback** for all actions (loading, success, error)
6. **Maintain contrast** in both light and dark themes
7. **Test keyboard navigation** for all interactions
8. **Keep animations** short and purposeful (under 300ms)
9. **Use semantic HTML** elements when possible
10. **Document complex components** with usage examples

---

## Quick Reference Card

| Need | Solution |
|------|----------|
| Primary action | `.btn-primary` |
| Secondary action | `.btn-secondary` |
| Icon button | `.theme-toggle` pattern |
| Input field | `.url-input` |
| Dropdown | `.setting-select` |
| Toggle | `.toggle` |
| Checkbox | `.video-checkbox` |
| Card | `.stat-card`, `.content-info` |
| Progress bar | `.queue-progress-bar` |
| Spinner | `.spinner` |
| Badge | `.queue-badge` |
| Empty state | `.empty-state` |
| Modal | `.changelog-brutal-overlay` |

---

## Adding New Components

When creating new components:

1. **Check existing patterns first** - reuse before creating new
2. **Use CSS variables** - never hardcode colors
3. **Include all states** - default, hover, active, disabled, focus
4. **Add animation** - subtle transitions for polish
5. **Test in both themes** - dark and light mode
6. **Document usage** - add example to this file
7. **Follow naming** - kebab-case, descriptive
8. **Include type prop** - if button, add `type="button"`
9. **Consider accessibility** - labels, focus states, keyboard
10. **Test responsive** - although Electron is fixed-size, layouts can vary

---

*Version 1.0 - Updated for VidGrab v1.5.0*
