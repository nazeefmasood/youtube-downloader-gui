# VidGrab

A fast and beautiful YouTube video downloader with a modern UI. Download videos, playlists, and entire channels with ease.

## App Features

- **One-Click Downloads**: Paste URL and download instantly
- **Quality Selection**: Choose from 360p to 4K resolution
- **Audio Extraction**: Download audio-only in MP3 or M4A format
- **Playlist Support**: Download entire playlists with proper naming
- **Channel Downloads**: Grab all videos from a channel
- **Progress Tracking**: Real-time progress with speed and ETA
- **Smart Organization**: Auto-organize downloads by type
- **Download History**: Track all your downloads
- **Custom UI**: Modern IDM-style interface with custom window controls

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
- **yt-dlp** - YouTube download engine
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
vidgrab/
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
~/Downloads/Youtube Downloads/
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
