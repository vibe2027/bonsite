# 🔑 API Keys & Configuration Guide

**Pour Phase 6 Deployment sur Vercel**

---

## 1️⃣ **SUPABASE** (Database)

### Obtenir les clés:
1. Go to https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy these keys:

```
SUPABASE_URL = [Your project URL]
SUPABASE_KEY = [anon public key]
SUPABASE_SERVICE_ROLE_KEY = [service_role key - SECRET!]
```

⚠️ **IMPORTANT:** 
- `SUPABASE_KEY` = public (ok to expose)
- `SUPABASE_SERVICE_ROLE_KEY` = SECRET (never commit!)

---

## 2️⃣ **STRIPE** (Payments)

### Setup:
1. Go to https://dashboard.stripe.com
2. Développers → API Keys
3. Use **LIVE keys** (not test keys)

### Keys to get:
```
STRIPE_PUBLIC_KEY = pk_live_... (public, ok to expose)
STRIPE_SECRET_KEY = sk_live_... (SECRET!)
STRIPE_WEBHOOK_SECRET = whsec_... (for webhooks)
```

### Configure Webhook Endpoint:
1. Developers → Webhooks
2. Add endpoint: `https://vibegay.ca/api/webhooks/stripe`
3. Select event: `payment_intent.succeeded`
4. Copy webhook secret

⚠️ **TEST FIRST:** Use test keys before going live!

---

## 3️⃣ **SENDGRID** (Email)

### Setup:
1. Go to https://app.sendgrid.com
2. Settings → API Keys
3. Create new API key (Full Access)

### Keys to get:
```
SENDGRID_API_KEY = SG..... (SECRET!)
SENDGRID_FROM_EMAIL = noreply@vibegay.ca
```

### Verify Domain:
1. Settings → Sender Authentication
2. Authenticate your domain (vibegay.ca)
3. Add DNS records (TXT, CNAME)
4. Verify

⚠️ **IMPORTANT:** Domain must be verified for emails to send!

---

## 4️⃣ **ZOHO MAIL** (Support Email)

### Create Account:
1. Go to https://mail.zoho.com/
2. Sign up with vibegay.ca domain
3. Create email: **support@vibegay.ca**

### DNS Configuration:
Zoho will give you:
- **MX Records** (Mail servers)
- **DKIM Records** (Security)
- **SPF Records** (Authentication)

Add these to Namecheap DNS settings.

⚠️ **Wait 24-48 hours** for DNS propagation!

---

## 5️⃣ **VERCEL** (Hosting)

### Setup:
1. Go to https://vercel.com
2. Import GitHub repo
3. Settings → Environment Variables
4. Add ALL keys from above

### Environment Variables to Add:
```
NODE_ENV=production
APP_URL=https://vibegay.ca
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_PUBLIC_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=noreply@vibegay.ca
BASE_URL=https://vibegay.ca
```

---

## 🔐 Security Checklist

- [ ] All SECRET keys stored in Vercel env vars (NOT in code)
- [ ] service_role key NOT exposed publicly
- [ ] stripe sk_live key NOT exposed publicly
- [ ] sendgrid api key NOT exposed publicly
- [ ] No .env files committed to git
- [ ] .gitignore includes .env, .env.local, .env.*.local

---

## ⚡ Quick Reference

| Service | Purpose | Public? | Vercel Var |
|---------|---------|---------|-----------|
| Supabase | Database | Anon key: YES | SUPABASE_URL, SUPABASE_KEY |
| Stripe | Payments | Public key: YES | STRIPE_PUBLIC_KEY |
| Stripe | Payments | Secret key: NO ⚠️ | STRIPE_SECRET_KEY |
| SendGrid | Email | API key: NO ⚠️ | SENDGRID_API_KEY |
| Zoho | Email | N/A | (separate account) |

---

## 🆘 Troubleshooting

**Emails not sending?**
- [ ] Check SENDGRID_API_KEY is correct
- [ ] Verify domain in SendGrid dashboard
- [ ] Check DNS records are propagated
- [ ] Check spam folder

**Stripe webhook not working?**
- [ ] Verify webhook secret in Vercel env
- [ ] Check webhook endpoint URL is correct
- [ ] Monitor Stripe webhook logs

**Database connection fails?**
- [ ] Verify SUPABASE_URL format
- [ ] Check SUPABASE_SERVICE_ROLE_KEY is correct
- [ ] Verify RLS policies allow access

---

**Last Updated:** 2026-08-27
