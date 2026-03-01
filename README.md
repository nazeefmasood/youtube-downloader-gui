# Grab

A fast and beautiful universal media downloader with a modern UI. Download videos, audio, playlists, and channels from 1000+ platforms including YouTube, TikTok, Twitch, Twitter/X, Instagram, Reddit, Vimeo, Facebook, and many more.

## Features

- **1000+ Platforms**: Download from YouTube, TikTok, Twitch, Twitter/X, Instagram, Reddit, Vimeo, Facebook, and more
- **One-Click Downloads**: Paste URL and download instantly
- **Quality Selection**: Choose from 360p to 4K resolution with AV1/HDR support
- **Audio Extraction**: Download audio-only in MP3 or M4A format
- **Subtitle Downloads**: Download subtitles in all available languages
- **Playlist & Channel Support**: Download entire playlists and channels with proper naming
- **Batch Processing**: Download multiple items with configurable delays and batching
- **Cloud Sync**: Sync your download queue across devices with Grab Cloud
- **Browser Extension**: Send downloads directly from your browser
- **Progress Tracking**: Real-time progress with speed and ETA
- **Smart Organization**: Auto-organize downloads by type
- **Download History**: Track all your downloads with export options
- **Custom UI**: Modern cyber-brutalist interface with custom window controls

## Screenshots

The app features a sleek dark theme with:
- Custom frameless window with title bar controls
- Toolbar with quick actions
- Download list with progress indicators
- Quality selection panel
- Settings and history views

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI framework
- **Vite** - Fast build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **yt-dlp** - Download engine (supports 1000+ sites)
- **ffmpeg** - Video/audio processing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd youtube-downloader-gui
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the app in development mode:
```bash
npm run electron:dev
```

### Building

Build for your current platform:
```bash
npm run electron:build
```

Build for all platforms:
```bash
npm run build:all
```

Build for specific platforms:
```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Project Structure

```
grab/
├── electron/           # Electron main process
│   ├── main.ts        # Main entry point
│   ├── preload.ts     # IPC bridge
│   └── downloader.ts  # yt-dlp wrapper
├── src/               # React renderer
│   ├── App.tsx        # Main app component
│   ├── stores/        # Zustand store
│   ├── lib/           # Utilities
│   └── types.ts       # TypeScript types
├── binaries/          # yt-dlp binaries (all platforms)
└── resources/         # App icons
```

## Download Folder Structure

Downloads are automatically organized:
```
~/Downloads/Grab/
├── [Single videos]
├── Playlists/
│   └── [Playlist Name]/
│       ├── 01 - Video Title.mp4
│       └── 02 - Video Title.mp4
└── Channels/
    └── [Channel Name]/
        └── Video Title.mp4
```

## License

MIT
