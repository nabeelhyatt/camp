#!/bin/bash

# Script to set up an isolated development instance of Camp
# Usage: ./script/setup-instance.sh [instance-name]

# Get the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the parent directory (the repo root)
REPO_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
# Get the workspace parent directory (e.g., camp-v1/)
WORKSPACE_DIR="$( cd "$REPO_DIR/.." && pwd )"
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

# ============================================
# Step 1: Copy .env file from workspace parent
# ============================================
if [ ! -f "$REPO_DIR/.env" ]; then
    # First try: workspace parent directory (e.g., camp-v1/.env)
    if [ -f "$WORKSPACE_DIR/.env" ]; then
        echo "Copying .env from workspace directory..."
        cp "$WORKSPACE_DIR/.env" "$REPO_DIR/.env"
        echo "✓ .env copied from $WORKSPACE_DIR"
    # Second try: user's Code directory
    elif [ -f "$HOME/Code/camp/.env" ]; then
        echo "Copying .env from ~/Code/camp..."
        cp "$HOME/Code/camp/.env" "$REPO_DIR/.env"
        echo "✓ .env copied"
    # Fall back: create from example
    elif [ -f "$REPO_DIR/.env.example" ]; then
        echo "⚠️  No .env file found. Creating from .env.example..."
        cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
        echo ""
        echo "   ❌ You MUST fill in these required values in .env:"
        echo "      VITE_CONVEX_URL - from 'npx convex dev'"
        echo "      VITE_CLERK_PUBLISHABLE_KEY - from Clerk dashboard"
        echo ""
    else
        echo "❌ ERROR: No .env file found and no .env.example to copy!"
        echo "   The app requires VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY"
        exit 1
    fi
else
    echo "✓ .env file already exists"
fi

# ============================================
# Step 2: Install dependencies
# ============================================
echo ""
echo "Installing dependencies..."
npx --yes corepack pnpm install

# ============================================
# Step 3: Create .env.local for Convex CLI
# ============================================
# The Convex CLI needs CONVEX_DEPLOYMENT to run non-interactively
# Extract the deployment name from VITE_CONVEX_URL (e.g., "dutiful-gecko-899" from "https://dutiful-gecko-899.convex.cloud")
if [ ! -f "$REPO_DIR/.env.local" ]; then
    # Try to extract CONVEX_URL from .env (use -m1 to get only first match)
    CONVEX_URL=$(grep -m1 -E '^[[:space:]]*VITE_CONVEX_URL=' "$REPO_DIR/.env" 2>/dev/null | sed 's/.*=//' | tr -d '"' | tr -d "'" | tr -d '[:space:]')

    if [ -n "$CONVEX_URL" ] && [[ "$CONVEX_URL" == https://*.convex.cloud* ]]; then
        # Extract deployment name: "https://dutiful-gecko-899.convex.cloud" -> "dev:dutiful-gecko-899"
        DEPLOYMENT_NAME=$(echo "$CONVEX_URL" | sed 's|https://||' | sed 's|\.convex\.cloud.*||')
        echo "Creating .env.local with Convex deployment: $DEPLOYMENT_NAME"
        echo "CONVEX_DEPLOYMENT=dev:$DEPLOYMENT_NAME" > "$REPO_DIR/.env.local"
        echo "✓ .env.local created for non-interactive Convex"
    else
        echo ""
        echo "⚠️  Convex not configured. You need to run:"
        echo "   npx convex login   # (if not already logged in)"
        echo "   npx convex dev     # (to create/connect deployment)"
        echo ""
        echo "   This will create .env.local with CONVEX_DEPLOYMENT"
    fi
else
    echo "✓ .env.local already exists"
fi

# ============================================
# Step 4: Sync Convex environment variables
# ============================================
# The Convex backend needs its own env vars (separate from Vite)
# This syncs default API keys from .env to Convex
echo ""
echo "Syncing environment variables to Convex..."

# Map of Vite env vars to Convex env vars
declare -A CONVEX_ENV_MAPPINGS=(
    ["VITE_DEFAULT_OPENROUTER_KEY"]="DEFAULT_OPENROUTER_KEY"
    ["VITE_DEFAULT_OPENAI_KEY"]="DEFAULT_OPENAI_KEY"
    ["VITE_DEFAULT_ANTHROPIC_KEY"]="DEFAULT_ANTHROPIC_KEY"
    ["VITE_DEFAULT_GOOGLE_KEY"]="DEFAULT_GOOGLE_KEY"
    ["VITE_DEFAULT_PERPLEXITY_KEY"]="DEFAULT_PERPLEXITY_KEY"
    ["VITE_DEFAULT_GROK_KEY"]="DEFAULT_GROK_KEY"
)

CONVEX_SYNCED=0
for VITE_VAR in "${!CONVEX_ENV_MAPPINGS[@]}"; do
    CONVEX_VAR="${CONVEX_ENV_MAPPINGS[$VITE_VAR]}"
    # Extract value from .env (handle quotes and whitespace)
    VALUE=$(grep -m1 -E "^[[:space:]]*${VITE_VAR}=" "$REPO_DIR/.env" 2>/dev/null | sed 's/.*=//' | tr -d '"' | tr -d "'" | tr -d '[:space:]')

    if [ -n "$VALUE" ]; then
        # Set in Convex (suppress output for cleaner logs)
        if npx convex env set "$CONVEX_VAR" "$VALUE" >/dev/null 2>&1; then
            echo "  ✓ $CONVEX_VAR synced"
            CONVEX_SYNCED=$((CONVEX_SYNCED + 1))
        else
            echo "  ⚠ Failed to sync $CONVEX_VAR (Convex not configured?)"
        fi
    fi
done

if [ $CONVEX_SYNCED -gt 0 ]; then
    echo "✓ $CONVEX_SYNCED Convex env vars synced"
else
    echo "⚠ No API keys found in .env to sync to Convex"
fi

# ============================================
# Step 5: Create Application Support directory
# ============================================
APP_SUPPORT_DIR="$HOME/Library/Application Support"
INSTANCE_DIR="$APP_SUPPORT_DIR/$IDENTIFIER"

if [ ! -d "$INSTANCE_DIR" ]; then
    echo ""
    echo "Creating data directory: $INSTANCE_DIR"
    mkdir -p "$INSTANCE_DIR"
else
    echo "✓ Data directory already exists: $INSTANCE_DIR"
fi

# ============================================
# Step 6: Copy auth.dat if available
# ============================================
SOURCE_AUTH="$APP_SUPPORT_DIR/ai.getcamp.app.dev/auth.dat"
if [ -f "$SOURCE_AUTH" ]; then
    echo "Copying auth.dat from ai.getcamp.app.dev..."
    cp "$SOURCE_AUTH" "$INSTANCE_DIR/auth.dat"
    echo "✓ Authentication copied successfully"
else
    echo "⚠ No auth.dat found in ai.getcamp.app.dev - you'll need to log in"
fi

# ============================================
# Step 7: Copy chats.db if available
# ============================================
SOURCE_CHATS="$APP_SUPPORT_DIR/ai.getcamp.app.dev/chats.db"
if [ -f "$SOURCE_CHATS" ]; then
    echo "Copying chats.db from ai.getcamp.app.dev using sqlite's online backup API..."
    if sqlite3 "$SOURCE_CHATS" ".backup '$INSTANCE_DIR/chats.db'"; then
        echo "✓ Chats copied successfully"
    else
        echo "❌ Failed to copy chats database - database will start empty"
    fi
else
    echo "⚠ No chats.db found in ai.getcamp.app.dev - database will start empty"
fi

# ============================================
# Step 8: Generate custom icon (optional)
# ============================================
if command -v magick >/dev/null 2>&1; then
    echo ""
    echo "Generating custom icon..."

    # Create instance icons directory
    ICONS_DIR="$INSTANCE_DIR/icons"
    mkdir -p "$ICONS_DIR"

    # Generate icon with instance name overlay
    BASE_ICON="$REPO_DIR/src-tauri/icons/icon.png"
    OUTPUT_ICON="$ICONS_DIR/icon.png"

    # Create icon with text overlay
    magick "$BASE_ICON" \
        -gravity South \
        -pointsize 86 \
        -font Arial-Bold \
        -fill darkorange \
        -stroke white \
        -strokewidth 2 \
        -annotate +0+60 "$INSTANCE_NAME" \
        "$OUTPUT_ICON"

    # Create .icns file for macOS
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

# ============================================
# Done!
# ============================================
echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the app:"
echo "    ./script/dev-instance.sh"
echo ""
echo "Or via Conductor: use the 'run' command"
