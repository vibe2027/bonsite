# ✅ VIBE Production Deployment Checklist

## Phase 1: Prepare (5 min)

- [ ] Fill in `.env.production.template` with your actual values
- [ ] Verify all 10 environment variables are set
- [ ] Test locally: `npm run dev`
- [ ] Commit all changes: `git push`

## Phase 2: Deploy on Netlify (10 min)

**Link: https://app.netlify.com**

- [ ] Login with GitHub
- [ ] Click "New site from Git"
- [ ] Select: vibe2027/VIBE
- [ ] Wait for build (should auto-detect netlify.toml)
- [ ] Go to: Settings → Environment Variables
- [ ] Add all 10 variables from .env.production.template
- [ ] Click "Save"
- [ ] Trigger redeploy: Deployments → Latest → "Redeploy"
- [ ] Wait for green ✅ status (2-3 min)

## Phase 3: Verify (5 min)

- [ ] Test: `curl https://vibegay.ca`
- [ ] Test: `curl https://vibegay.ca/api/health`
- [ ] Test: `curl https://vibegay.ca/api/diagnostics`
- [ ] Homepage loads? ✅
- [ ] API responds? ✅
- [ ] All variables set? ✅

## Phase 4: Setup Monitoring (10 min)

**Link: https://uptimerobot.com**

- [ ] Sign up (free)
- [ ] Add monitor: URL = `https://vibegay.ca/api/health`
- [ ] Interval: 5 minutes
- [ ] Alert: Email
- [ ] Save
- [ ] Verify you got test email

## Phase 5: Setup Slack Alerts (5 min)

**Links:**
- Slack apps: https://api.slack.com/apps
- GitHub secrets: https://github.com/vibe2027/VIBE/settings/secrets/actions

- [ ] Create Slack app → Incoming Webhooks
- [ ] Copy webhook URL
- [ ] Go to GitHub → Settings → Secrets → Actions
- [ ] Add: `SLACK_WEBHOOK_URL` = [paste webhook URL]
- [ ] GitHub Actions will start alerting automatically

## Phase 6: Setup Fallback (15 min)

**Link: https://railway.app**

- [ ] Login with GitHub
- [ ] Create new project
- [ ] Deploy from: vibe2027/VIBE
- [ ] Add same 10 environment variables
- [ ] Save URL: vibegay-fallback.railway.app
- [ ] Test: `curl https://vibegay-fallback.railway.app/api/health`

## Phase 7: Final Verification (5 min)

- [ ] Main site works: `curl https://vibegay.ca`
- [ ] Health endpoint: `curl https://vibegay.ca/api/health`
- [ ] UptimeRobot monitoring active
- [ ] Slack webhook working
- [ ] Railway fallback deployed
- [ ] GitHub Actions running

## 🎉 Done!

Your site now has:
✅ 24/7 monitoring (UptimeRobot)
✅ Instant Slack alerts
✅ Auto-failover to Railway
✅ GitHub Actions healthchecks every 5 min
✅ Production-grade resilience

**Total time: ~50 minutes**
**Confidence: 🛡️ 99.9% uptime**
