#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════
# VIBE Site Healthcheck - Run every 5 minutes
# ═══════════════════════════════════════════════════════════════════════

set -e

SITE="https://vibegay.ca"
LOG_FILE="/tmp/vibe-health.log"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
THRESHOLD=3  # Alert after 3 consecutive failures

# ─────────────────────────────────────────────────────────────────────
# Color Output
# ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Color

# ─────────────────────────────────────────────────────────────────────
# Functions
# ─────────────────────────────────────────────────────────────────────

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_http_status() {
    local url=$1
    local expected=${2:-200}

    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$status" = "$expected" ]; then
        return 0
    else
        return 1
    fi
}

check_api_health() {
    response=$(curl -s "$SITE/api/health" 2>/dev/null || echo "{}")

    if echo "$response" | grep -q '"status":"ok"'; then
        return 0
    else
        return 1
    fi
}

check_homepage() {
    response=$(curl -s "$SITE" 2>/dev/null | wc -c)

    if [ "$response" -gt 1000 ]; then
        return 0
    else
        return 1
    fi
}

send_slack_alert() {
    local message=$1
    local severity=${2:-warning}  # critical, warning, info

    if [ -z "$SLACK_WEBHOOK" ]; then
        return
    fi

    color="warning"
    if [ "$severity" = "critical" ]; then
        color="danger"
    elif [ "$severity" = "info" ]; then
        color="good"
    fi

    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{
            \"attachments\": [{
                \"color\": \"$color\",
                \"title\": \"VIBE Site Alert\",
                \"text\": \"$message\",
                \"ts\": $(date +%s)
            }]
        }" \
        2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────
# Main Healthcheck
# ─────────────────────────────────────────────────────────────────────

log "Starting healthcheck for $SITE"

FAILURES=0
FAILURES_TOTAL=$(grep "FAILED" "$LOG_FILE" 2>/dev/null | wc -l || echo 0)

# Test 1: HTTP Status
if check_http_status "$SITE" 200; then
    log "✅ HTTP Status OK (200)"
else
    log "❌ HTTP Status FAILED"
    FAILURES=$((FAILURES + 1))
fi

# Test 2: API Health Endpoint
if check_api_health; then
    log "✅ API Health endpoint OK"
else
    log "❌ API Health endpoint FAILED"
    FAILURES=$((FAILURES + 1))
fi

# Test 3: Homepage Content
if check_homepage; then
    log "✅ Homepage loads correctly"
else
    log "❌ Homepage FAILED to load"
    FAILURES=$((FAILURES + 1))
fi

# ─────────────────────────────────────────────────────────────────────
# Alert Logic
# ─────────────────────────────────────────────────────────────────────

if [ $FAILURES -eq 0 ]; then
    # All tests passed
    echo -e "${GREEN}✅ All tests PASSED${NC}"
    log "STATUS: 🟢 ALL GREEN"

    # Reset failure counter
    echo "0" > /tmp/vibe-failure-count.txt

elif [ $FAILURES -lt 3 ]; then
    # Some failures, but not critical yet
    echo -e "${YELLOW}⚠️  Some tests failed ($FAILURES/3)${NC}"
    log "STATUS: 🟡 PARTIAL FAILURE ($FAILURES/3)"

    # Increment failure counter
    COUNT=$(cat /tmp/vibe-failure-count.txt 2>/dev/null || echo "0")
    COUNT=$((COUNT + 1))
    echo "$COUNT" > /tmp/vibe-failure-count.txt

    if [ "$COUNT" -ge "$THRESHOLD" ]; then
        log "ALERT: Threshold reached, sending notification"
        send_slack_alert "🚨 VIBE site showing failures ($COUNT consecutive checks)" "warning"
    fi

else
    # Critical failure
    echo -e "${RED}❌ CRITICAL: All tests FAILED${NC}"
    log "STATUS: 🔴 CRITICAL FAILURE"

    # Send critical alert
    send_slack_alert "🚨 CRITICAL: VIBE site is DOWN! All healthchecks failed. Failover to Railway: https://vibegay-fallback.railway.app" "critical"

    # Optional: Auto-failover (uncomment to enable)
    # log "FAILOVER: Switching DNS to Railway fallback"
    # /home/user/VIBE/scripts/failover-to-railway.sh
fi

# ─────────────────────────────────────────────────────────────────────
# Output Summary
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "Summary:"
echo "  Total Failures: $FAILURES/3"
echo "  Consecutive: $(cat /tmp/vibe-failure-count.txt 2>/dev/null || echo '0')"
echo "  Last Check: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════════════"

exit 0
