#!/bin/bash

# Download yt-dlp binaries for all platforms
# Run this script before building the app

BINARIES_DIR="binaries"
YT_DLP_VERSION="2024.12.23"

mkdir -p "$BINARIES_DIR"

echo "Downloading yt-dlp binaries..."

# Linux
echo "Downloading Linux binary..."
curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" -o "$BINARIES_DIR/yt-dlp-linux"
chmod +x "$BINARIES_DIR/yt-dlp-linux"

# macOS
echo "Downloading macOS binary..."
curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp_macos" -o "$BINARIES_DIR/yt-dlp-macos"
chmod +x "$BINARIES_DIR/yt-dlp-macos"

# Windows
echo "Downloading Windows binary..."
curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp.exe" -o "$BINARIES_DIR/yt-dlp.exe"

echo "Done! Binaries downloaded to $BINARIES_DIR/"
ls -la "$BINARIES_DIR/"
