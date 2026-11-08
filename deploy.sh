#!/bin/bash

# VIBE Deployment Script
# Usage: bash deploy.sh

set -e

echo "🚀 VIBE Deployment Starting..."
echo ""

# Get user input
read -p "Enter your Netlify Site ID: " SITE_ID
read -p "Enter your Supabase Service Role Key: " SUPABASE_KEY

if [ -z "$SITE_ID" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Missing credentials"
    exit 1
fi

echo ""
echo "📦 Installing dependencies..."
npm install > /dev/null 2>&1

echo "🔨 Building..."
npm run build > /dev/null 2>&1

echo "📤 Deploying to Netlify..."

# Deploy using Netlify CLI
netlify deploy \
    --site "$SITE_ID" \
    --prod \
    --dir . \
    --message "Deploy from script" \
    --auth "$GITHUB_TOKEN" \
    SUPABASE_URL=https://fhksytcoyjtcrkmhnoyw.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_KEY" \
    NODE_ENV=production \
    BASE_URL=https://vibegay.ca \
    STRIPE_PUBLIC_KEY=pk_test_123 \
    STRIPE_SECRET_KEY=sk_test_123 \
    STRIPE_WEBHOOK_SECRET=whsec_test_123 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo "🌐 Check: https://app.netlify.com/sites/$SITE_ID"
else
    echo "❌ Deployment failed"
    exit 1
fi
