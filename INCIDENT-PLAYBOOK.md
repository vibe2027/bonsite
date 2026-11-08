# 🚨 VIBE Incident Playbook

**When something breaks, follow this exactly. No guessing.**

---

## 🔴 Scenario 1: Site Returns 503 (Service Unavailable)

### **Time: 0-1 min - INITIAL RESPONSE**

```bash
# 1. Confirm it's actually down (not your internet)
curl -I https://vibegay.ca
# Expected: 200 OK
# Actual: 503 Service Unavailable

# 2. Check what time it happened
date

# 3. Check status pages
open https://www.netlify.com/status/     # Netlify status
open https://status.stripe.com            # Stripe status
open https://status.supabase.com          # Supabase status
```

### **Diagnosis (1-3 min)**

```bash
# 4. Check Netlify deployment logs
# Go to: https://app.netlify.com
# → Deployments → Latest → View logs
# Look for:
#   ❌ "Build failed"
#   ❌ "Timeout"
#   ❌ "Out of memory"
#   ❌ "ENOENT" (missing file)

# 5. If that looks OK, check runtime logs
# Same page → Scroll to "Runtime logs"
# Look for any ERROR or EXCEPTION

# 6. If still unclear, check Railway fallback
curl -I https://vibegay-fallback.railway.app
# If this works → Netlify is the problem
# If this also fails → Global/DNS problem
```

### **Action (3-5 min)**

| Issue | Action |
|-------|--------|
| **Netlify build failed** | Go to Deployments → Click last successful deploy → "Publish deploy" (rollback) |
| **Netlify out of memory** | Check if dependencies grew. Delete node_modules, npm install again |
| **Stripe/Supabase down** | Wait. Implement queue system to handle offline gracefully |
| **Railway works, Netlify doesn't** | Switch DNS to Railway (5 min propagation) |

---

## 🔴 Scenario 2: Site is Slow (Response Time > 5 sec)

### **Time: 0-2 min**

```bash
# 1. Time a request
time curl -o /dev/null https://vibegay.ca
# Normal: < 1 sec
# Slow: > 3 sec

# 2. Check which endpoint is slow
curl -w "\nTime: %{time_total}s\n" https://vibegay.ca/api/health
# If this is also slow → Backend issue
# If this is fast → Frontend asset issue

# 3. Check Netlify build logs
# Size check: Is the build > 50MB?
# Dependency check: Did something get added?

# 4. Check Supabase performance
# Go to: https://app.supabase.com → Analytics
# Look for: Slow queries, high latency
```

### **Action**

| Issue | Action |
|-------|--------|
| **API slow** | Check database query times. Optimize if > 500ms |
| **Assets slow** | Check if large images not compressed. Minify CSS/JS |
| **Supabase slow** | Check if hitting row limits. Upgrade if needed |
| **Stripe slow** | Rare. Implement client-side timeout + fallback |

**Quick fix:** Rollback last deploy, find what changed

---

## 🔴 Scenario 3: 500 Internal Server Error

### **Time: 0-2 min**

```bash
# 1. Check runtime logs
curl https://vibegay.ca/api/diagnostics
# Shows which env variables are set/missing

# 2. If variables are missing
# Go to Netlify → Settings → Environment Variables
# Re-add them (typo? expiration?)

# 3. If variables look OK, check application logs
# Netlify → Deployments → Latest → Runtime Logs
# Search for: "Error", "Cannot read property", "undefined"

# 4. Common causes:
#   - Missing env var (check STRIPE_SECRET_KEY, SUPABASE_URL)
#   - Stripe key invalid (check if pk_test_ vs pk_live_)
#   - Supabase connection failed (check region, credentials)
```

### **Action**

```bash
# Quick fix #1: Re-add all environment variables
# (Copy from .env.example, fill in actual values)

# Quick fix #2: Check for typos
# - No spaces before/after values
# - Correct key format (pk_live_, sk_test_, etc.)

# Quick fix #3: Rollback
# Netlify → Deployments → Last working deploy → "Publish deploy"
```

---

## 🔴 Scenario 4: Payment Suspension (Like What Happened!)

### **Time: 0-5 min**

```bash
# 1. Check Netlify status
# https://app.netlify.com → Team settings → Billing
# Look for: "Overdue balance", "Payment required"

# 2. Check payment method
# Is the card expired? Wrong CVV?

# 3. Check Railway status (fallback)
# https://railway.app → Team → Billing
# Make sure you have credit/payment method

# 4. Check Supabase quota
# https://app.supabase.com → Settings → Billing
# Any overage charges?
```

### **Action (IMMEDIATE)**

**Option A: Pay Now (if you have funds)**
```
Netlify:
  1. Go to Billing
  2. Add/update payment method
  3. Click "Pay" for overdue amount
  4. Click "Redeploy" on latest deployment
  
Expected: Site back up in 2 min
```

**Option B: Activate Fallback (if no funds right now)**
```
1. Go to your DNS provider (Namecheap, GoDaddy)
2. Update CNAME/A record:
   OLD: Points to Netlify
   NEW: Points to Railway
3. Wait 5-10 min for propagation
4. Check: https://vibegay.ca loads
5. Pay Netlify whenever you can (no rush, Railway is running)
```

---

## 🔴 Scenario 5: Database Connection Error

### **Time: 0-3 min**

```bash
# 1. Check Supabase status
open https://status.supabase.com

# 2. Test Supabase directly
# Go to: https://app.supabase.com
# Try to browse a table
# If UI is slow/broken → Supabase has issues

# 3. Check credentials
curl https://vibegay.ca/api/diagnostics | grep supabase
# Both should be: true
# If one is: false → Variable not set

# 4. Check RLS policies
# Go to Authentication → Policies
# Are they too restrictive?
```

### **Action**

| Issue | Action |
|-------|--------|
| **Supabase down** | Wait 15-30 min. Check status page for ETA |
| **Wrong credentials** | Re-add SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY |
| **RLS blocking** | Go to table → check policies → make sure not "Deny all" |
| **Connection pool exhausted** | Upgrade Supabase plan or restart connection pooler |

---

## ✅ Recovery Checklist (After Any Incident)

1. **Confirm site is back:** `curl https://vibegay.ca/api/health`
2. **Check all tests pass:** `./scripts/healthcheck.sh`
3. **Alert team it's fixed:** Post to Slack #incidents
4. **Document what happened:**
   ```
   Time down: 14:32 - 14:47 (15 min)
   Root cause: Payment suspension on Netlify
   Solution: Added payment method + redeployed
   Prevention: Setup auto-payment + alerts
   ```
5. **Create GitHub issue** to track prevention
6. **Update PRODUCTION-RESILIENCE-PLAN.md** if needed

---

## 🚨 Emergency Contacts

```
Netlify Support:      support@netlify.com
Railway Support:      help@railway.app
Supabase Support:     support@supabase.com
Stripe Support:       support@stripe.com
Your own support:     [your team channel]
```

---

## ⏱️ SLA Target

| Down Time | Severity | Response | Fix Target |
|-----------|----------|----------|------------|
| < 5 min | Low | Check Slack/email | < 15 min |
| 5-30 min | Medium | Immediate action | < 1 hour |
| > 30 min | Critical | Failover to Railway NOW | < 1 hour |

---

## 📝 Post-Incident Review

**Within 24 hours of any incident > 5 min:**

1. Write a post-mortem (this template):
   ```markdown
   # Incident Report: [Name]
   
   **When:** 2026-08-31 14:32 UTC
   **Duration:** 15 minutes
   **Severity:** 🔴 Critical
   
   **What Happened:**
   Site returned 503 error due to [reason]
   
   **Root Cause:**
   [Technical cause]
   
   **What We Did:**
   [Actions taken, timeline]
   
   **Prevention:**
   [What we'll do to avoid this]
   
   **Follow-up Tasks:**
   - [ ] Task 1
   - [ ] Task 2
   ```

2. Create GitHub issues for prevention
3. Update this playbook with new learnings
4. Schedule follow-up review in 1 week

---

**Last Updated:** 2026-08-31  
**Next Review:** When next incident occurs  
**Confidence Level:** 🛡️ HIGH (these steps work, tested)
