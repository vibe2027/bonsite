# 📋 COPY-PASTE COMPLETE SETUP GUIDE

**Ne réfléchis pas. Copie-colle exactement.**

---

## STEP 1: Get Your Secrets (5 min)

### From Supabase Dashboard (https://app.supabase.com)

1. Click: Settings → API
2. Copy these:
   - `Project URL` → Copy
   - `anon public key` → Copy  
   - `service_role key` → Copy

### From Stripe Dashboard (https://dashboard.stripe.com)

1. Click: Developers → API keys
2. Copy:
   - `Publishable key` (pk_live_... or pk_test_...)
   - `Secret key` (sk_live_... or sk_test_...)
3. Click: Webhooks
4. Find webhook: `...vibegay.ca/api/webhooks/stripe`
5. Copy `Signing secret` (whsec_...)
6. Click: Products
7. Find your 2 prices, copy their IDs (price_...)

---

## STEP 2: Netlify Deployment (10 min)

### Go to: https://app.netlify.com

**A) Authorize GitHub**
- Click: "Log in with GitHub"
- Click: "Authorize netlify"

**B) Create Site**
- Click: "New site from Git"
- Select: GitHub
- Find repo: `vibe2027/VIBE`
- Click: "Deploy site"

**C) Add Environment Variables**
- Wait 2 min (building...)
- Go to: Site settings → Build & deploy → Environment
- Click: "Edit variables"
- Add these 10 (COPY-PASTE from your Supabase/Stripe):

```
NODE_ENV = production
BASE_URL = https://vibegay.ca
SUPABASE_URL = [PASTE from Supabase Settings → API → Project URL]
SUPABASE_ANON_KEY = [PASTE from Supabase Settings → API → anon key]
SUPABASE_SERVICE_ROLE_KEY = [PASTE from Supabase Settings → API → service_role]
STRIPE_PUBLIC_KEY = [PASTE pk_live_ or pk_test_ from Stripe]
STRIPE_SECRET_KEY = [PASTE sk_live_ or sk_test_ from Stripe]
STRIPE_WEBHOOK_SECRET = [PASTE whsec_ from Stripe Webhooks]
STRIPE_PRICE_PREMIUM = [PASTE price_... from Stripe Products]
STRIPE_PRICE_FOUNDER = [PASTE price_... from Stripe Products]
```

- Click: "Save"
- Go back to: Deployments
- Click latest deploy → "Redeploy"
- Wait for green ✅ (2-3 min)

**D) Test It**
```bash
curl https://vibegay.ca/api/health
# Should return: {"status":"ok",...}
```

---

## STEP 3: UptimeRobot Monitoring (5 min)

### Go to: https://uptimerobot.com

**A) Create Account**
- Click: "Sign Up"
- Use any email
- Set password
- Click: "Create account"
- Verify email

**B) Add Monitor**
- Click: "Add New Monitor"
- Fill:
  ```
  Monitor Type: HTTPS
  URL: https://vibegay.ca/api/health
  Friendly Name: VIBE Health Check
  Check Interval: 5 minutes
  ```
- Click: "Create Monitor"

**C) Add Alert**
- Click on monitor → "Alerts"
- Click: "Add Alert Contact"
- Type: Email
- Email: [YOUR EMAIL]
- Click: "Save"

**D) Test Alert**
- You should receive email: "UptimeRobot Test"
- Response: Email received = ✅ Working

---

## STEP 4: Slack Alerts (5 min)

### A) Create Slack App

Go to: https://api.slack.com/apps

1. Click: "Create New App"
2. Choose: "From scratch"
3. App name: `VIBE Alerts`
4. Workspace: [SELECT YOUR WORKSPACE]
5. Click: "Create App"

### B) Enable Incoming Webhooks

1. Left sidebar → "Incoming Webhooks"
2. Toggle: "Activate Incoming Webhooks" → ON
3. Click: "Add New Webhook to Workspace"
4. Channel: [SELECT ANY CHANNEL]
5. Click: "Allow"
6. Copy the URL (starts with `https://hooks.slack.com/...`)

### C) Add to GitHub Secrets

Go to: https://github.com/vibe2027/VIBE/settings/secrets/actions

1. Click: "New repository secret"
2. Name: `SLACK_WEBHOOK_URL`
3. Value: [PASTE the webhook URL from Slack]
4. Click: "Add secret"

**D) Test It**
- Go to: GitHub repo → Actions
- Find: "🏥 VIBE Healthcheck" workflow
- Click: "Run workflow"
- Should get Slack message in 1 min

---

## STEP 5: Railway Fallback (15 min)

### Go to: https://railway.app

**A) Create Account**
1. Click: "Start Project"
2. Click: "Deploy from GitHub repo"
3. Login with GitHub
4. Authorize Railway
5. Select repo: `vibe2027/VIBE`
6. Click: "Deploy"

**B) Add Environment Variables**
1. Wait for build (2-3 min)
2. Go to: Project → Variables
3. Add same 10 variables as Netlify:
   ```
   NODE_ENV = production
   BASE_URL = https://vibegay.ca
   SUPABASE_URL = [same as Netlify]
   ... (all 10)
   ```
4. Click: "Save"

**C) Get Railway URL**
1. Go to: Deployments
2. Find active deployment
3. Click it
4. Copy URL (like: `vibegay-xxx.railway.app`)
5. Test:
   ```bash
   curl https://[railway-url]/api/health
   ```

**D) Save for Emergency**
- Write down: `https://[railway-url]`
- This is your backup if Netlify dies

---

## STEP 6: Verify Everything Works (5 min)

### Test Netlify

```bash
curl https://vibegay.ca
curl https://vibegay.ca/api/health
curl https://vibegay.ca/api/diagnostics
```

All should return 200 with JSON.

### Test Railway Fallback

```bash
curl https://[your-railway-url]/api/health
```

Should also return 200.

### Test UptimeRobot

- Wait 5 minutes
- Check email
- Should see: "VIBE Health Check is up"

### Test Slack

- Go to GitHub Actions
- Run "🏥 VIBE Healthcheck" manually
- Should get Slack message

---

## 🎉 DONE!

Your site now has:

✅ **Netlify** - Primary hosting (LIVE NOW)  
✅ **UptimeRobot** - Monitors every 5 min  
✅ **Slack Alerts** - Instant notifications  
✅ **Railway** - Fallback if Netlify dies  
✅ **GitHub Actions** - Automatic healthchecks  

**Total time: ~50 minutes**

---

## EMERGENCY: Site is Down

If site goes down:

1. Check UptimeRobot email (you'll get alert)
2. Read: INCIDENT-PLAYBOOK.md
3. If Netlify broken > 5 min:
   - Update DNS to point to Railway
   - Takes 5-10 min propagation
   - Site back up on Railway

---

## 🚨 Never forget:

- UptimeRobot = You know instantly if down
- Slack = Team gets alert  
- Railway = Backup always ready
- GitHub Actions = 24/7 monitoring

**You're never blind again.**

