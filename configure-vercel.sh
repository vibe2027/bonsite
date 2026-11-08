#!/bin/bash

###############################################################################
# VIBE Production Deployment — API Keys Configuration
# Usage: VERCEL_TOKEN=vcp_... ./configure-vercel.sh "SUPABASE_KEY" "STRIPE_SECRET" "STRIPE_WEBHOOK" "SENDGRID_KEY"
###############################################################################

SUPABASE_SERVICE_ROLE_KEY="$1"
STRIPE_SECRET_KEY="$2"
STRIPE_WEBHOOK_SECRET="$3"
SENDGRID_API_KEY="$4"

VERCEL_TOKEN="${VERCEL_TOKEN:-}"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$STRIPE_WEBHOOK_SECRET" ] || [ -z "$SENDGRID_API_KEY" ]; then
  echo "Usage: VERCEL_TOKEN=vcp_... $0 <SUPABASE_SERVICE_ROLE_KEY> <STRIPE_SECRET_KEY> <STRIPE_WEBHOOK_SECRET> <SENDGRID_API_KEY>"
  exit 1
fi

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ VERCEL_TOKEN environment variable not set"
  echo "   Usage: VERCEL_TOKEN=vcp_... $0 ..."
  exit 1
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     VIBE — Configuration Vercel (4 clés API)                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Clés reçues:"
echo "   1. SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo "   2. STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:0:20}..."
echo "   3. STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:0:20}..."
echo "   4. SENDGRID_API_KEY: ${SENDGRID_API_KEY:0:20}..."
echo ""

PROJECT_ID="vibegay"
VERCEL_API="https://api.vercel.com"

echo "═══════════════════════════════════════════════════════════════"
echo "📤 Configuration Vercel en cours..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Variables à configurer
declare -A VARS=(
  ["SUPABASE_URL"]="https://vdqamjtzksiifnsnztki.supabase.co"
  ["SUPABASE_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcWFtanR6a3NpaWZuc256dGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODA0MjAsImV4cCI6MjEwMjY1NjQyMH0.6vwQwinxLeGXHKQ1VRPwRHtaIM6ZTXFYpfeVaW-7aoA"
  ["SUPABASE_SERVICE_ROLE_KEY"]="$SUPABASE_SERVICE_ROLE_KEY"
  ["STRIPE_PUBLIC_KEY"]="pk_test_51U8PSb6J6CxrJ9ySJdfDnfHCDv3cVHu8LLeGzjhcmp4tvwQa6mVTBPMn1HZKOnWF62MYNYgQVXdZks42Te235Uhs00mByqEMHa"
  ["STRIPE_SECRET_KEY"]="$STRIPE_SECRET_KEY"
  ["STRIPE_WEBHOOK_SECRET"]="$STRIPE_WEBHOOK_SECRET"
  ["SENDGRID_API_KEY"]="$SENDGRID_API_KEY"
  ["SENDGRID_FROM_EMAIL"]="support@vibegay.ca"
  ["NODE_ENV"]="production"
)

SUCCESS=0
FAILED=0

for VAR_NAME in "${!VARS[@]}"; do
  VAR_VALUE="${VARS[$VAR_NAME]}"
  echo -n "   Configuring $VAR_NAME... "

  RESPONSE=$(curl -s -X POST "$VERCEL_API/v10/projects/$PROJECT_ID/env" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$VAR_NAME\", \"value\": \"$VAR_VALUE\", \"target\": [\"production\"]}" 2>&1 || echo "")

  if echo "$RESPONSE" | grep -q "error\|403\|gateway"; then
    echo "⚠️"
    ((FAILED++))
  else
    echo "✅"
    ((SUCCESS++))
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Configuration complétée!"
echo "═══════════════════════════════════════════════════════════════"
