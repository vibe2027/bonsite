# 🚀 VERCEL DEPLOYMENT — Quick Start Guide

**Status:** ✅ Code ready | ⏳ Awaiting manual Vercel setup

---

## 📋 Pre-Deployment Checklist

Before starting, you need:
- [ ] Vercel account (https://vercel.com)
- [ ] Supabase project URL & API keys
- [ ] Stripe live API keys
- [ ] SendGrid API key
- [ ] Domain vibegay.ca (or subdomain)

---

## ✅ STEP 1: Link Repository to Vercel

1. Go to **https://vercel.com/new**
2. Click **"Import from Git"**
3. Select **GitHub** → **vibe2027/VIBE**
4. In "Import Git Repository":
   - Owner: vibe2027
   - Repository: VIBE
   - Branch: **claude/vibe-v1-architecture-53i2dd**
5. Click **"Import"**

---

## ✅ STEP 2: Configure Build Settings

On the "Configure Project" screen:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Other (Node.js) |
| **Root Directory** | ./ (default) |
| **Build Command** | `npm run build` |
| **Output Directory** | ./ (default) |
| **Install Command** | `npm install` (auto) |

Then click **"Deploy"** (it will fail because env vars aren't set yet — this is normal)

---

## ✅ STEP 3: Add Environment Variables

After the failed deployment, go to:
**Project Settings → Environment Variables**

Add these variables for **Production**:

### Node Configuration
```
NODE_ENV=production
APP_URL=https://vibegay.ca
BASE_URL=https://vibegay.ca
PORT=3000
```

### Supabase Database
```
SUPABASE_URL=[your-project-url]
SUPABASE_KEY=[your-anon-public-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

**Where to find these:**
1. Go to https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy: Project URL, anon public key, service_role key

### Stripe Payments
```
STRIPE_PUBLIC_KEY=pk_live_[YOUR_KEY]
STRIPE_SECRET_KEY=sk_live_[YOUR_KEY]
STRIPE_WEBHOOK_SECRET=whsec_[YOUR_SECRET]
```

**Where to find these:**
1. Go to https://dashboard.stripe.com
2. Developers → API Keys
3. Copy live keys (NOT test keys)
4. Developers → Webhooks → Find webhook for `https://vibegay.ca/api/webhooks/stripe`
5. Copy signing secret

### SendGrid Email
```
SENDGRID_API_KEY=SG.[YOUR_KEY]
SENDGRID_FROM_EMAIL=noreply@vibegay.ca
```

**Where to find this:**
1. Go to https://app.sendgrid.com
2. Settings → API Keys
3. Create new key with "Full Access"
4. Copy the key

**IMPORTANT:** Click "Save" after each section!

---

## ✅ STEP 4: Configure Domain

In **Project Settings → Domains**:

1. Add domain: `vibegay.ca`
2. Vercel will show you DNS records to add

Go to **https://www.namecheap.com** → Advanced DNS for `vibegay.ca`

Add the CNAME record:
```
Type: CNAME
Host: www
Value: cname.vercel-dns.com
```

Wait 5-30 minutes for DNS to propagate.

---

## ✅ STEP 5: Redeploy After Variables Added

1. Go back to Vercel dashboard
2. Click **"Deployments"**
3. Find the failed deployment
4. Click **"Redeploy"**

Monitor the build:
- Should build in ~2-3 minutes
- Should show "✓ Ready" when complete

Test: Go to `https://vibegay.ca` (or your Vercel URL)

---

## ✅ STEP 6: Email Infrastructure Setup

### 6a. Create Support Email (Zoho Mail)

1. Go to https://mail.zoho.com/
2. Click **"Sign Up"** → **"Professional Email"**
3. Email: `support@vibegay.ca`
4. Password: [Create secure password]
5. Domain: `vibegay.ca`
6. Select: **Annual billing**

### 6b. Add Zoho MX Records to Namecheap

Zoho will give you 3 MX records. In Namecheap Advanced DNS:

```
Type   | Host | Value          | Priority
-------|------|----------------|----------
MX     | @    | mx.zoho.com    | 10
MX     | @    | mx2.zoho.com   | 20
MX     | @    | mx3.zoho.com   | 50
```

### 6c. Configure SendGrid Domain Authentication

1. Go to https://app.sendgrid.com
2. Settings → Sender Authentication
3. Authenticate Domain: `vibegay.ca`
4. SendGrid gives you CNAME records
5. Add to Namecheap DNS:
   ```
   Type: CNAME
   Host: sendgrid._domainkey
   Value: [SendGrid provided]
   ```

### 6d. Add SPF Record to Namecheap

```
Type: TXT
Host: @
Value: v=spf1 sendgrid.net zoho.com ~all
```

### 6e. Add DMARC Record to Namecheap

```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:support@vibegay.ca
```

Wait 24-48 hours for email propagation.

---

## 🧪 STEP 7: Test Everything

### Test 1: Contact Form
```
1. Visit: https://vibegay.ca/contact.html
2. Fill in test data
3. Submit
4. Check support@vibegay.ca for email
```

### Test 2: Static Pages
```
✓ https://vibegay.ca/contact.html
✓ https://vibegay.ca/conditions.html
✓ https://vibegay.ca/confidentialite.html
```

### Test 3: API Health Check
```bash
curl https://vibegay.ca/health
# Should return: {"status":"ok"}
```

### Test 4: Email Configuration
```bash
nslookup -type=MX vibegay.ca
# Should show: mx.zoho.com, mx2.zoho.com, mx3.zoho.com
```

---

## ✅ DEPLOYMENT COMPLETE

When all tests pass:
- [ ] Website accessible at vibegay.ca
- [ ] Contact form sends emails to support@vibegay.ca
- [ ] Static pages load correctly
- [ ] No personal information exposed
- [ ] Email infrastructure working
- [ ] All API endpoints responding

Monitor Vercel logs for 24 hours after deployment.

---

## 🆘 Troubleshooting

**Build fails?**
- Check environment variables are ALL set correctly
- Verify STRIPE_SECRET_KEY starts with `sk_live_` (not test key)
- Check SENDGRID_API_KEY is correct format

**Contact form not sending?**
- Verify SENDGRID_API_KEY in Vercel env vars
- Check SendGrid domain is authenticated
- Check spam folder

**DNS not working?**
- Use https://mxtoolbox.com/ to check DNS propagation
- Wait 24-48 hours for full propagation
- Verify all records added correctly

**Email not arriving?**
- Check Zoho Mail inbox/spam
- Verify MX records in DNS
- Wait 24-48 hours for propagation

---

**Branch:** claude/vibe-v1-architecture-53i2dd  
**Last Updated:** 2026-08-27  
**Status:** ✅ Ready for Vercel deployment
