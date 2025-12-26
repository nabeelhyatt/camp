#!/bin/bash

# Build Camp icons from source PNG
# Requires: ImageMagick (brew install imagemagick)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
ICONS_DIR="$REPO_DIR/src-tauri/icons"

# Source icon - use the campfire logo
SOURCE_ICON="${1:-/Users/nabeelhyatt/Library/Application Support/com.conductor.app/uploads/originals/4f774389-5fc0-4bfb-bfa8-b52e1610194f.png}"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    echo "Usage: $0 [path-to-source-icon.png]"
    exit 1
fi

echo "Building Camp icons from: $SOURCE_ICON"
echo "Output directory: $ICONS_DIR"
echo ""

# Ensure ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "Error: ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

# Create a square version of the source icon by extending canvas
echo "Creating square version of source icon..."
TEMP_SQUARE="/tmp/camp-icon-square.png"
# Get dimensions and make square by extending with transparency
DIMENSIONS=$(magick identify -format "%wx%h" "$SOURCE_ICON")
WIDTH=$(echo "$DIMENSIONS" | cut -dx -f1)
HEIGHT=$(echo "$DIMENSIONS" | cut -dx -f2)
SIZE=$((WIDTH > HEIGHT ? WIDTH : HEIGHT))
magick "$SOURCE_ICON" -gravity center -background none -extent ${SIZE}x${SIZE} "$TEMP_SQUARE"
echo "Original: ${WIDTH}x${HEIGHT}, Square: ${SIZE}x${SIZE}"

# Use the square version for all operations
SOURCE_ICON="$TEMP_SQUARE"

# Core PNG sizes
echo "Generating core PNG sizes..."
magick "$SOURCE_ICON" -resize 32x32 "$ICONS_DIR/32x32.png"
magick "$SOURCE_ICON" -resize 128x128 "$ICONS_DIR/128x128.png"
magick "$SOURCE_ICON" -resize 256x256 "$ICONS_DIR/128x128@2x.png"
magick "$SOURCE_ICON" -resize 512x512 "$ICONS_DIR/icon.png"

# Windows sizes
echo "Generating Windows sizes..."
magick "$SOURCE_ICON" -resize 30x30 "$ICONS_DIR/Square30x30Logo.png"
magick "$SOURCE_ICON" -resize 44x44 "$ICONS_DIR/Square44x44Logo.png"
magick "$SOURCE_ICON" -resize 71x71 "$ICONS_DIR/Square71x71Logo.png"
magick "$SOURCE_ICON" -resize 89x89 "$ICONS_DIR/Square89x89Logo.png"
magick "$SOURCE_ICON" -resize 107x107 "$ICONS_DIR/Square107x107Logo.png"
magick "$SOURCE_ICON" -resize 142x142 "$ICONS_DIR/Square142x142Logo.png"
magick "$SOURCE_ICON" -resize 150x150 "$ICONS_DIR/Square150x150Logo.png"
magick "$SOURCE_ICON" -resize 284x284 "$ICONS_DIR/Square284x284Logo.png"
magick "$SOURCE_ICON" -resize 310x310 "$ICONS_DIR/Square310x310Logo.png"
magick "$SOURCE_ICON" -resize 50x50 "$ICONS_DIR/StoreLogo.png"

# macOS .icns
echo "Generating macOS .icns..."
mkdir -p "$ICONS_DIR/icon.iconset"
magick "$SOURCE_ICON" -resize 16x16     "$ICONS_DIR/icon.iconset/icon_16x16.png"
magick "$SOURCE_ICON" -resize 32x32     "$ICONS_DIR/icon.iconset/icon_16x16@2x.png"
magick "$SOURCE_ICON" -resize 32x32     "$ICONS_DIR/icon.iconset/icon_32x32.png"
magick "$SOURCE_ICON" -resize 64x64     "$ICONS_DIR/icon.iconset/icon_32x32@2x.png"
magick "$SOURCE_ICON" -resize 128x128   "$ICONS_DIR/icon.iconset/icon_128x128.png"
magick "$SOURCE_ICON" -resize 256x256   "$ICONS_DIR/icon.iconset/icon_128x128@2x.png"
magick "$SOURCE_ICON" -resize 256x256   "$ICONS_DIR/icon.iconset/icon_256x256.png"
magick "$SOURCE_ICON" -resize 512x512   "$ICONS_DIR/icon.iconset/icon_256x256@2x.png"
magick "$SOURCE_ICON" -resize 512x512   "$ICONS_DIR/icon.iconset/icon_512x512.png"
magick "$SOURCE_ICON" -resize 1024x1024 "$ICONS_DIR/icon.iconset/icon_512x512@2x.png"
iconutil -c icns "$ICONS_DIR/icon.iconset" -o "$ICONS_DIR/icon.icns"
rm -rf "$ICONS_DIR/icon.iconset"

# Windows .ico
echo "Generating Windows .ico..."
magick "$SOURCE_ICON" -resize 256x256 -define icon:auto-resize=256,128,96,64,48,32,16 "$ICONS_DIR/icon.ico"

# iOS icons
echo "Generating iOS icons..."
IOS_DIR="$ICONS_DIR/ios"
mkdir -p "$IOS_DIR"
magick "$SOURCE_ICON" -resize 20x20 "$IOS_DIR/AppIcon-20x20@1x.png"
magick "$SOURCE_ICON" -resize 40x40 "$IOS_DIR/AppIcon-20x20@2x.png"
magick "$SOURCE_ICON" -resize 60x60 "$IOS_DIR/AppIcon-20x20@3x.png"
magick "$SOURCE_ICON" -resize 29x29 "$IOS_DIR/AppIcon-29x29@1x.png"
magick "$SOURCE_ICON" -resize 58x58 "$IOS_DIR/AppIcon-29x29@2x.png"
magick "$SOURCE_ICON" -resize 87x87 "$IOS_DIR/AppIcon-29x29@3x.png"
magick "$SOURCE_ICON" -resize 40x40 "$IOS_DIR/AppIcon-40x40@1x.png"
magick "$SOURCE_ICON" -resize 80x80 "$IOS_DIR/AppIcon-40x40@2x.png"
magick "$SOURCE_ICON" -resize 120x120 "$IOS_DIR/AppIcon-40x40@3x.png"
magick "$SOURCE_ICON" -resize 76x76 "$IOS_DIR/AppIcon-76x76@1x.png"
magick "$SOURCE_ICON" -resize 152x152 "$IOS_DIR/AppIcon-76x76@2x.png"
magick "$SOURCE_ICON" -resize 167x167 "$IOS_DIR/AppIcon-83.5x83.5@2x.png"
magick "$SOURCE_ICON" -resize 120x120 "$IOS_DIR/AppIcon-60x60@2x.png"
magick "$SOURCE_ICON" -resize 180x180 "$IOS_DIR/AppIcon-60x60@3x.png"
magick "$SOURCE_ICON" -resize 1024x1024 "$IOS_DIR/AppIcon-512@2x.png"

# Android icons
echo "Generating Android icons..."
ANDROID_DIR="$ICONS_DIR/android"
mkdir -p "$ANDROID_DIR"
magick "$SOURCE_ICON" -resize 36x36 "$ANDROID_DIR/mipmap-ldpi/ic_launcher.png" 2>/dev/null || magick "$SOURCE_ICON" -resize 36x36 "$ANDROID_DIR/ic_launcher_36.png"
magick "$SOURCE_ICON" -resize 48x48 "$ANDROID_DIR/mipmap-mdpi/ic_launcher.png" 2>/dev/null || magick "$SOURCE_ICON" -resize 48x48 "$ANDROID_DIR/ic_launcher_48.png"
magick "$SOURCE_ICON" -resize 72x72 "$ANDROID_DIR/mipmap-hdpi/ic_launcher.png" 2>/dev/null || magick "$SOURCE_ICON" -resize 72x72 "$ANDROID_DIR/ic_launcher_72.png"
magick "$SOURCE_ICON" -resize 96x96 "$ANDROID_DIR/mipmap-xhdpi/ic_launcher.png" 2>/dev/null || magick "$SOURCE_ICON" -resize 96x96 "$ANDROID_DIR/ic_launcher_96.png"
magick "$SOURCE_ICON" -resize 144x144 "$ANDROID_DIR/mipmap-xxhdpi/ic_launcher.png" 2>/dev/null || magick "$SOURCE_ICON" -resize 144x144 "$ANDROID_DIR/ic_launcher_144.png"
magick "$SOURCE_ICON" -resize 192x192 "$ANDROID_DIR/mipmap-xxxhdpi/ic_launcher.png" 2>/dev/null || magick "$SOURCE_ICON" -resize 192x192 "$ANDROID_DIR/ic_launcher_192.png"

echo ""
echo "✅ Done! Icons generated in $ICONS_DIR"
echo ""
echo "To verify: ls -la $ICONS_DIR"
