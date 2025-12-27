#!/bin/bash

# Script to run isolated development instances of Camp
# Usage: ./script/dev-instance.sh [instance-name]

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

# Calculate a unique port based on the instance name
# Use a hash of the instance name to generate a port number between 1422 and 1620
HASH=$(echo -n "$SAFE_INSTANCE_NAME" | cksum | cut -d' ' -f1)
BASE_PORT=$((1422 + (($HASH % 100) * 2)))

# Function to check if a port is available
port_available() {
    ! lsof -i :$1 > /dev/null 2>&1
}

# Find an available port starting from BASE_PORT
PORT=$BASE_PORT
MAX_ATTEMPTS=50
ATTEMPT=0
while ! port_available $PORT && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    PORT=$(($PORT + 2))
    ATTEMPT=$(($ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "Error: Could not find an available port after $MAX_ATTEMPTS attempts"
    exit 1
fi

if [ $PORT -ne $BASE_PORT ]; then
    echo "Note: Port $BASE_PORT was busy, using port $PORT instead"
fi

HMR_PORT=$(($PORT + 1))

# Check if custom icon exists for this instance
APP_SUPPORT_DIR="$HOME/Library/Application Support"
INSTANCE_DIR="$APP_SUPPORT_DIR/$IDENTIFIER"
CUSTOM_ICON="$INSTANCE_DIR/icons/icon.icns"

# Create a temporary config override file
CONFIG_OVERRIDE=$(mktemp)

# Build the config, conditionally including icon if it exists
if [ -f "$CUSTOM_ICON" ]; then
    echo "Using custom icon for instance: $INSTANCE_NAME"
    cat > "$CONFIG_OVERRIDE" <<EOF
{
  "identifier": "$IDENTIFIER",
  "productName": "Camp Dev - $INSTANCE_NAME",
  "bundle": {
    "icon": ["$CUSTOM_ICON"]
  },
  "build": {
    "devUrl": "http://localhost:$PORT"
  }
}
EOF
else
    # Write the JSON configuration override without custom icon
    cat > "$CONFIG_OVERRIDE" <<EOF
{
  "identifier": "$IDENTIFIER",
  "productName": "Camp Dev - $INSTANCE_NAME",
  "build": {
    "devUrl": "http://localhost:$PORT"
  }
}
EOF
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Error: node_modules not found. Please run 'npm install' first."
    exit 1
fi

echo "Starting Camp development instance: $INSTANCE_NAME"
echo "App identifier: $IDENTIFIER"
echo "Data directory: ~/Library/Application Support/$IDENTIFIER/"
echo "Dev server port: $PORT (HMR: $HMR_PORT)"

# Set environment variables
export CAMP_INSTANCE_NAME="$INSTANCE_NAME"
export VITE_PORT="$PORT"
export VITE_HMR_PORT="$HMR_PORT"

# Start Convex dev server in background (no-open flag prevents browser from opening)
echo "Starting Convex dev server in background..."
npm run convex:dev -- --no-open > /dev/null 2>&1 &
CONVEX_PID=$!

# Cleanup function to kill background processes
cleanup() {
    echo "Shutting down..."
    kill $CONVEX_PID 2>/dev/null
    rm -f "$CONFIG_OVERRIDE"
}
trap cleanup EXIT

# Run tauri dev with the base dev config and our override
npm run tauri -- dev --config src-tauri/tauri.dev.conf.json --config "$CONFIG_OVERRIDE"