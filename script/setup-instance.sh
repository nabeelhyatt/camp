#!/bin/bash

# Script to set up an isolated development instance of Camp
# Usage: ./script/setup-instance.sh [instance-name]

# Get the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the parent directory (the repo root)
REPO_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
# Get just the directory name
DEFAULT_INSTANCE_NAME="$(basename "$REPO_DIR")"

# Get the instance name from the first argument, or use the repo directory name if not provided
INSTANCE_NAME="${1:-$DEFAULT_INSTANCE_NAME}"

# Sanitize the instance name to be filesystem-safe
SAFE_INSTANCE_NAME=$(echo "$INSTANCE_NAME" | sed 's/[^a-zA-Z0-9_-]/_/g')

# Create the unique identifier
IDENTIFIER="ai.getcamp.app.dev.$SAFE_INSTANCE_NAME"

echo "Setting up Camp development instance: $INSTANCE_NAME"
echo "App identifier: $IDENTIFIER"

# Copy .env file if it doesn't exist
if [ ! -f "$REPO_DIR/.env" ]; then
    # Try to find .env in main repo
    MAIN_REPO_DIR="$HOME/Code/camp-v1"
    if [ -f "$MAIN_REPO_DIR/.env" ]; then
        echo "Copying .env from main repo..."
        cp "$MAIN_REPO_DIR/.env" "$REPO_DIR/.env"
        echo "✓ .env copied"
    else
        echo "⚠️  WARNING: No .env file found!"
        echo "   Please copy .env from your main Camp directory"
        echo "   The app will not start without VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY"
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Create the Application Support directory
APP_SUPPORT_DIR="$HOME/Library/Application Support"
INSTANCE_DIR="$APP_SUPPORT_DIR/$IDENTIFIER"

if [ ! -d "$INSTANCE_DIR" ]; then
    echo "Creating data directory: $INSTANCE_DIR"
    mkdir -p "$INSTANCE_DIR"
else
    echo "Data directory already exists: $INSTANCE_DIR"
fi

# Copy auth.dat if it exists in the source directory
SOURCE_AUTH="$APP_SUPPORT_DIR/ai.getcamp.app.dev/auth.dat"
if [ -f "$SOURCE_AUTH" ]; then
    echo "Copying auth.dat from ai.getcamp.app.dev..."
    cp "$SOURCE_AUTH" "$INSTANCE_DIR/auth.dat"
    echo "✓ Authentication copied successfully"
else
    echo "⚠ No auth.dat found in ai.getcamp.app.dev - you'll need to log in"
fi

# copy chats.db if it exists in the source directory
SOURCE_CHATS="$APP_SUPPORT_DIR/ai.getcamp.app.dev/chats.db"
if [ -f "$SOURCE_CHATS" ]; then
    echo "Copying chats.db from ai.getcamp.app.dev using sqlite's online backup API..."
    if ! sqlite3 "$SOURCE_CHATS" ".backup '$INSTANCE_DIR/chats.db'"; then
        echo "❌ Failed to copy chats database - database will start empty"
    fi

    echo "✓ Chats copied successfully"
else
    echo "⚠ No chats.db found in ai.getcamp.app.dev - database will start empty"
fi

# Copy .env file from main camp directory if it exists and we don't have one
# Look in multiple possible locations
MAIN_CAMP_DIR="$HOME/Code/camp"
if [ ! -f "$REPO_DIR/.env" ]; then
    if [ -f "$MAIN_CAMP_DIR/.env" ]; then
        echo "Copying .env from main camp repo..."
        cp "$MAIN_CAMP_DIR/.env" "$REPO_DIR/.env"
        echo "✓ Environment variables copied successfully"
    elif [ -f "$REPO_DIR/.env.local" ]; then
        # Convex creates .env.local with VITE_CONVEX_URL
        echo "Found .env.local from Convex, but .env is missing."
        echo "⚠ Creating .env from .env.example - you need to add VITE_CLERK_PUBLISHABLE_KEY"
        cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    elif [ -f "$REPO_DIR/.env.example" ]; then
        echo "⚠ No .env file found. Creating from .env.example..."
        echo "  You'll need to fill in VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY"
        cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    else
        echo "❌ No .env file found! The app requires:"
        echo "   VITE_CONVEX_URL - from 'npx convex dev'"
        echo "   VITE_CLERK_PUBLISHABLE_KEY - from Clerk dashboard"
    fi
else
    echo "✓ .env file already exists"
fi

# Generate custom icon with ImageMagick if available
if command -v magick >/dev/null 2>&1; then
    echo ""
    echo "Generating custom icon..."
    
    # Create instance icons directory
    ICONS_DIR="$INSTANCE_DIR/icons"
    mkdir -p "$ICONS_DIR"
    
    # Generate icon with instance name overlay
    # Use the dev icon as base
    BASE_ICON="$REPO_DIR/src-tauri/icons/icon.png"
    OUTPUT_ICON="$ICONS_DIR/icon.png"
    
    # Create icon with text overlay
    # Position text in the bottom third of the icon
    magick "$BASE_ICON" \
        -gravity South \
        -pointsize 86 \
        -font Arial-Bold \
        -fill darkorange \
        -stroke white \
        -strokewidth 2 \
        -annotate +0+60 "$INSTANCE_NAME" \
        "$OUTPUT_ICON"
    
    # Also create the .icns file for macOS
    # First create required sizes
    mkdir -p "$ICONS_DIR/icon.iconset"
    
    # Generate all required sizes for iconset
    magick "$OUTPUT_ICON" -resize 16x16     "$ICONS_DIR/icon.iconset/icon_16x16.png"
    magick "$OUTPUT_ICON" -resize 32x32     "$ICONS_DIR/icon.iconset/icon_16x16@2x.png"
    magick "$OUTPUT_ICON" -resize 32x32     "$ICONS_DIR/icon.iconset/icon_32x32.png"
    magick "$OUTPUT_ICON" -resize 64x64     "$ICONS_DIR/icon.iconset/icon_32x32@2x.png"
    magick "$OUTPUT_ICON" -resize 128x128   "$ICONS_DIR/icon.iconset/icon_128x128.png"
    magick "$OUTPUT_ICON" -resize 256x256   "$ICONS_DIR/icon.iconset/icon_128x128@2x.png"
    magick "$OUTPUT_ICON" -resize 256x256   "$ICONS_DIR/icon.iconset/icon_256x256.png"
    magick "$OUTPUT_ICON" -resize 512x512   "$ICONS_DIR/icon.iconset/icon_256x256@2x.png"
    magick "$OUTPUT_ICON" -resize 512x512   "$ICONS_DIR/icon.iconset/icon_512x512.png"
    magick "$OUTPUT_ICON" -resize 1024x1024 "$ICONS_DIR/icon.iconset/icon_512x512@2x.png"
    
    # Convert to .icns
    iconutil -c icns "$ICONS_DIR/icon.iconset" -o "$ICONS_DIR/icon.icns" 2>/dev/null || true
    
    # Clean up iconset
    rm -rf "$ICONS_DIR/icon.iconset"
    
    echo "✓ Custom icon generated!"
else
    echo ""
    echo "⚠ ImageMagick not found - skipping icon generation"
    echo "  Install with: brew install imagemagick"
fi

echo ""
echo "✅ Setup complete! You can now run:"
echo "    npm run dev"