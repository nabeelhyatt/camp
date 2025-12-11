#!/bin/bash
echo "🏋️ Compiling..."
npx tsc || { echo "❌ TypeScript compilation failed"; exit 1; }

echo "👀 Checking out main..."
git checkout main || { echo "❌ Failed to checkout main"; exit 1; }

echo "🫡 Pulling latest changes from main..."
git pull origin main || { echo "❌ Failed to pull from main"; exit 1; }

echo "👀 Checking out release..."
git checkout release || { echo "❌ Failed to checkout release"; exit 1; }

git pull origin main || { echo "❌ Failed to pull main into release"; exit 1; }

git push origin release || { echo "❌ Failed to push to release"; exit 1; }

git checkout main || { echo "❌ Failed to return to main"; exit 1; }

echo "🤝 Done... check status at https://github.com/meltylabs/chorus/actions"
