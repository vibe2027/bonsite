# ⚡ QUICK DEPLOYMENT REFERENCE

**Status:** ✅ Production Ready  
**Time to Deploy:** 20 minutes  

---

## 1️⃣ Configure Vercel Dashboard (5 min)

**URL:** https://vercel.com/dashboard → VIBE Project → Settings

### Build Settings
```
Build Command:    npm run build
Output Directory: .
Install Command:  npm install
Node Version:     18.x
```

### Environment Variables (15+ required)
Copy from: `VERCEL-DEPLOYMENT-GUIDE.md`

Key ones:
- `SUPABASE_URL` → https://your-project.supabase.co
- `SUPABASE_KEY` → your-anon-key
- `SUPABASE_SERVICE_ROLE_KEY` → your-service-role-key
- `ELASTICSEARCH_URL` → your-elasticsearch
- `ELASTICSEARCH_USERNAME` → elastic
- `ELASTICSEARCH_PASSWORD` → your-password
- `OPENAI_API_KEY` → sk-...
- `TURN_SERVER_URL` → turn:...
- `TURN_USERNAME` → vibe-rtc
- `TURN_PASSWORD` → ...
- `STRIPE_PUBLIC_KEY` → pk_live_...
- `STRIPE_SECRET_KEY` → sk_live_...
- `STRIPE_WEBHOOK_SECRET` → whsec_...
- `SENDGRID_API_KEY` → SG...
- `NODE_ENV` → production

### Domains
- Add: `vibegay.ca`
- SSL: Auto (Vercel handles)

### Git
- Production Branch: `main`
- Auto Deploy: ✅ ON

---

## 2️⃣ Deploy (1 min)

```bash
git push origin main
```

✅ Vercel auto-deploys automatically

---

## 3️⃣ Monitor Build (5-10 min)

**Dashboard:** https://vercel.com → Deployments

Watch for:
```
✅ Installing dependencies...
✅ Running npm run build...
✅ Build complete
✅ Deployed to vibegay.ca
```

Status should be: 🟢 **Deployed**

---

## 4️⃣ Run Smoke Tests (5 min)

```bash
# Health check
curl https://vibegay.ca/api/health

# Salons API
curl https://vibegay.ca/api/salons

# Advanced search
curl -X POST https://vibegay.ca/api/search/full-text \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Stripe webhook test
# Create test payment in Stripe Dashboard
# Verify webhook in Vercel logs
```

---

## 5️⃣ First 24h Monitoring

| Time | Action |
|------|--------|
| Hour 1 | Check logs every 10 min |
| Hour 2-4 | Check every 30 min |
| Hour 5-24 | Check every 2 hours |

**Critical checks:**
- [ ] No 500 errors in logs
- [ ] Supabase connections OK
- [ ] Stripe webhooks received
- [ ] Email notifications sent
- [ ] Elasticsearch responding
- [ ] WebRTC video working

---

## 🚨 If Something Fails

**Build fails?**
```bash
# Check Vercel logs for exact error
# Reproduce locally:
npm install && npm run build && npm start

# Common issues:
# 1. Missing env var → Add to Dashboard
# 2. Module error → All code uses require() (verified ✅)
# 3. Port conflict → Vercel uses PORT env var
```

**500 error after deploy?**
```bash
# Check Vercel logs
# Common causes:
# 1. Supabase URL invalid → Verify SUPABASE_URL
# 2. API key expired → Refresh on Supabase Dashboard
# 3. TURN server unreachable → Check TURN_SERVER_URL
# 4. Elasticsearch down → Check ELASTICSEARCH_URL

# Rollback if needed:
# - Vercel Dashboard → Deployments → Click previous working deployment
# - Or switch production branch back to previous commit
```

---

## ✅ Success Criteria

- [ ] Build completes in <3 minutes
- [ ] No build errors or warnings
- [ ] Deployment status: 🟢 Deployed
- [ ] /api/health endpoint responds
- [ ] Database connections working
- [ ] No errors in logs after 1 hour
- [ ] Users can access vibegay.ca
- [ ] Phase 6 features functional

---

## 📞 Support Docs

- **Full Deployment:** VERCEL-DEPLOYMENT-GUIDE.md
- **Verification:** VERCEL-FINAL-CHECKLIST.md
- **Strategy:** DEPLOYMENT-PLAN-PHASE-6.md
- **Integration:** INTEGRATION-GUIDE-PHASE-6.md
- **Status:** DEPLOYMENT-STATUS.md

---

**Ready? Let's go! 🚀**

