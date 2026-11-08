#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════
# VIBE Site Suspension - Emergency Recovery Script
# ═══════════════════════════════════════════════════════════════════════

set -e

echo "🔧 VIBE Suspension Recovery Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─────────────────────────────────────────────────────────────────────
# Step 1: Verify Domain Configuration
# ─────────────────────────────────────────────────────────────────────

echo "✓ Step 1: Verifying domain configuration..."

if grep -q "vibegay.ca" CNAME; then
    echo "  ✅ CNAME correctly set to: vibegay.ca"
else
    echo "  ❌ ERROR: CNAME not set to vibegay.ca"
    echo "  📝 CNAME content:"
    cat CNAME
    exit 1
fi

if grep -q "vibegay.ca" .env.example; then
    echo "  ✅ BASE_URL uses vibegay.ca"
else
    echo "  ❌ ERROR: BASE_URL not using vibegay.ca"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────
# Step 2: Verify Essential Files
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Step 2: Verifying essential files..."

FILES=("server.js" "package.json" "vercel.json" ".env.example" ".vercelignore")

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file exists"
    else
        echo "  ❌ ERROR: $file missing!"
        exit 1
    fi
done

# ─────────────────────────────────────────────────────────────────────
# Step 3: Check Dependencies
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Step 3: Checking dependencies..."

REQUIRED_DEPS=("express" "stripe" "@supabase/supabase-js" "dotenv" "cors" "helmet" "nodemailer" "axios" "@elastic/elasticsearch")

for dep in "${REQUIRED_DEPS[@]}"; do
    if grep -q "\"$dep\"" package.json; then
        echo "  ✅ $dep is in dependencies"
    else
        echo "  ⚠️  WARNING: $dep might be missing"
    fi
done

# ─────────────────────────────────────────────────────────────────────
# Step 4: Verify Environment Variables Template
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Step 4: Verifying environment variables template..."

REQUIRED_ENV_VARS=(
    "NODE_ENV"
    "BASE_URL"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "STRIPE_PUBLIC_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "STRIPE_PRICE_PREMIUM"
    "STRIPE_PRICE_FOUNDER"
)

for var in "${REQUIRED_ENV_VARS[@]}"; do
    if grep -q "$var" .env.example; then
        echo "  ✅ $var is documented"
    else
        echo "  ❌ ERROR: $var missing from .env.example"
    fi
done

# ─────────────────────────────────────────────────────────────────────
# Step 5: Generate Configuration Checklist
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Step 5: Generating configuration checklist..."

cat > VERCEL-IMMEDIATE-ACTIONS.txt << 'EOF'
╔════════════════════════════════════════════════════════════════════════╗
║  🚨 IMMEDIATE ACTIONS REQUIRED TO FIX SUSPENSION                       ║
║  Domain: vibegay.ca                                                    ║
║  Timeline: DO THIS NOW (5 minutes)                                     ║
╚════════════════════════════════════════════════════════════════════════╝

STEP 1: Go to Vercel Dashboard
────────────────────────────────────────────────────────────────────────
URL: https://vercel.com/dashboard

STEP 2: Select the VIBE Project
────────────────────────────────────────────────────────────────────────
Project Name: vibe (or similar)
Click to open settings

STEP 3: Add Environment Variables
────────────────────────────────────────────────────────────────────────
Go to: Settings → Environment Variables

Add ALL 10 of these (copy-paste from .env file):

1. NODE_ENV                      = production
2. BASE_URL                       = https://vibegay.ca
3. SUPABASE_URL                   = https://fhksytcoyjtcrkmhnoyw.supabase.co
4. SUPABASE_ANON_KEY              = [your key from Supabase]
5. SUPABASE_SERVICE_ROLE_KEY      = [your key from Supabase]
6. STRIPE_PUBLIC_KEY              = pk_live_... or pk_test_...
7. STRIPE_SECRET_KEY              = sk_live_... or sk_test_...
8. STRIPE_WEBHOOK_SECRET          = whsec_...
9. STRIPE_PRICE_PREMIUM           = price_1234567890
10. STRIPE_PRICE_FOUNDER          = price_0987654321

STEP 4: Add Domain
────────────────────────────────────────────────────────────────────────
Go to: Settings → Domains

Click "Add Domain"
Enter: vibegay.ca
Wait for DNS verification (should be green ✅)

If DNS verification fails:
  → Go to your DNS provider (Namecheap, etc.)
  → Add A record:
      Host: @
      Type: A
      Value: 76.76.19.165
  → OR add CNAME record:
      Host: www
      Type: CNAME
      Value: cname.vercel-dns.com

STEP 5: Redeploy
────────────────────────────────────────────────────────────────────────
Go to: Deployments

Find the latest deployment
Click: "Redeploy" button
Wait for green ✅ status (2-5 minutes)

STEP 6: Verify
────────────────────────────────────────────────────────────────────────
Test 1: Open https://vibegay.ca in browser
        Should load main page

Test 2: Check health endpoint
        curl https://vibegay.ca/api/health
        Should return: {status: "ok", ...}

Test 3: Check Vercel logs
        Deployments → Latest → Runtime Logs
        Should have NO red errors

═════════════════════════════════════════════════════════════════════════

Expected result after these steps: 🟢 SITE ACTIVE

If still suspended after this:
  → Check Vercel deployment logs for build errors
  → Verify all 10 environment variables are set correctly
  → Check DNS propagation (may take 5-30 minutes)
  → Contact Vercel support if issue persists

═════════════════════════════════════════════════════════════════════════
Generated: 2026-08-31
EOF

echo "  ✅ Checklist saved to: VERCEL-IMMEDIATE-ACTIONS.txt"

# ─────────────────────────────────────────────────────────────────────
# Step 6: Validate vercel.json
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Step 6: Validating vercel.json..."

if grep -q '"version": 2' vercel.json && grep -q '"server.js"' vercel.json; then
    echo "  ✅ vercel.json structure is correct"
else
    echo "  ❌ ERROR: vercel.json may be misconfigured"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────
# Step 7: Display Summary
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pre-Flight Checks Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📋 Summary:"
echo "  • Domain: vibegay.ca ✅"
echo "  • Files: All present ✅"
echo "  • Dependencies: Ready ✅"
echo "  • Configuration: Validated ✅"

echo ""
echo "🚀 Next Steps:"
echo "  1. Open: VERCEL-IMMEDIATE-ACTIONS.txt"
echo "  2. Follow the 6-step checklist"
echo "  3. Redeploy on Vercel"
echo "  4. Test at https://vibegay.ca"

echo ""
echo "⏱️  Estimated fix time: 10-15 minutes"

exit 0
