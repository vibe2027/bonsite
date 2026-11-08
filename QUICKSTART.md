# VIBE Platform - Quick Start Guide

Get the VIBE platform up and running in 5 minutes.

## 1. Prerequisites

```bash
# Make sure you have Node.js installed
node --version  # Should be 16+
npm --version
```

## 2. Clone & Install

```bash
# Clone the repository (if not already done)
cd VIBE

# Install dependencies
npm install express cors supabase nodemailer stripe dotenv
```

## 3. Configure Environment

Create `.env` file in project root:

```env
# Supabase (get from dashboard.supabase.com)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Gmail SMTP (use app password, not regular password)
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# Stripe (get from dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PREMIUM=price_xxx
STRIPE_PRICE_FOUNDER=price_yyy

# Server
BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

## 4. Database Setup

### Option A: Supabase Dashboard (Recommended)

1. Go to [dashboard.supabase.com](https://dashboard.supabase.com)
2. Create new project (or use existing)
3. Go to SQL Editor
4. Open `/sql/complete-schema.sql`
5. Copy entire contents
6. Paste into Supabase SQL editor
7. Click "Run"

### Option B: Command Line

```bash
# If using Supabase CLI
supabase db push < sql/complete-schema.sql
```

## 5. Start Server

```bash
node server.js
```

Expected output:
```
🚀 VIBE Server running on port 3000
📍 Webhook endpoint: POST /api/webhooks/stripe
💳 Checkout endpoint: POST /api/checkout-session
✅ Health check: GET /health
```

## 6. Create Admin Accounts (Optional)

```bash
node setup-admins.js
```

This creates admin and special accounts.

Check your email inbox for verification emails.

## 7. Access Platform

Open your browser and visit:

**Login Page**: http://localhost:3000/login.html

**After Login**:
- Admin users → `/admin-dashboard-ui.html`
- Co-founder users → `/co-founder-dashboard.html`
- Regular users → `/index.html`

---

## Quick Test

### 1. Create Test Account

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "fullName": "Test User",
    "region": "Gaspésie"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### 3. Check Health

```bash
curl http://localhost:3000/health
```

---

## Troubleshooting

### Issue: "Cannot find module 'express'"

**Solution**:
```bash
npm install
```

### Issue: "SUPABASE_URL is undefined"

**Solution**:
1. Check `.env` file exists in project root
2. Verify all variables are set
3. Restart server (Ctrl+C, then `node server.js`)

### Issue: "Gmail authentication failed"

**Solution**:
1. Use Gmail app password (not regular password)
2. Enable 2FA on Gmail account
3. Generate app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### Issue: "RLS policy violation"

**Solution**:
1. Check Supabase Auth is configured
2. Verify service role key is correct
3. Check that RLS policies exist (run schema again)

### Issue: Emails not sending

**Solution**:
1. Verify `EMAIL_USER` and `EMAIL_PASSWORD` in .env
2. Check Gmail "Less secure apps" setting
3. Review console logs for email errors

---

## Architecture Overview

```
VIBE Platform
├── Frontend
│   ├── login.html (Authentication)
│   ├── admin-dashboard-ui.html (Admin only)
│   ├── co-founder-dashboard.html (Co-founder only)
│   ├── index.html (Regular users)
│   └── js/ (Chat, effects, haptic)
│
├── Backend
│   ├── server.js (Express server)
│   ├── auth/
│   │   ├── auth-service.js (Auth logic)
│   │   └── auth-routes.js (Auth endpoints)
│   ├── dashboard/
│   │   ├── admin-dashboard.js (Admin functions)
│   │   └── admin-routes.js (Admin endpoints)
│   └── pubs/
│       └── pubs-routes.js (Advertising)
│
├── Database
│   └── sql/complete-schema.sql (PostgreSQL)
│
└── Setup
    ├── setup-admins.js (Create special accounts)
    ├── SETUP.md (Detailed setup)
    └── QUICKSTART.md (This file)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express server entry point |
| `sql/complete-schema.sql` | Database schema (10 tables) |
| `auth/auth-service.js` | Authentication logic |
| `auth/auth-routes.js` | Auth API endpoints |
| `dashboard/admin-dashboard.js` | Admin functions |
| `dashboard/admin-routes.js` | Admin API endpoints |
| `pubs/pubs-routes.js` | Advertising system |
| `login.html` | Login/signup UI |
| `admin-dashboard-ui.html` | Admin panel UI |
| `co-founder-dashboard.html` | Co-founder panel UI |
| `setup-admins.js` | Setup script |
| `docs/MANUSCRIPT.md` | Complete documentation |

---

## Common Tasks

### Add New User

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123",
    "fullName": "New User",
    "region": "Montréal"
  }'
```

### Change User Role (Admin)

```bash
curl -X PUT http://localhost:3000/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "role": "co_founder"
  }'
```

### Send Billets (Co-founder)

```bash
curl -X POST http://localhost:3000/auth/send-billets \
  -H "Content-Type: application/json" \
  -H "x-user-role: co_founder" \
  -H "x-user-id: USER_ID" \
  -d '{
    "fromUserId": "USER_ID",
    "toEmail": "recipient@example.com",
    "amount": 100
  }'
```

### Create Tribunal Case

```bash
curl -X POST http://localhost:3000/auth/tribunal-case \
  -H "Content-Type: application/json" \
  -d '{
    "complainantId": "COMPLAINANT_ID",
    "defendantId": "DEFENDANT_ID",
    "caseType": "harassment",
    "description": "Incident description"
  }'
```

---

## Next Steps

1. **Customize**: Edit UI templates to match your branding
2. **Deploy**: Follow SETUP.md for production deployment
3. **Monitor**: Set up error logging and analytics
4. **Scale**: Optimize database queries as user base grows
5. **Document**: Add additional documentation for your team

---

## Support

- **Full Documentation**: See `/docs/MANUSCRIPT.md`
- **Setup Guide**: See `/SETUP.md`
- **Database Schema**: See `/sql/complete-schema.sql`

---

## Quick Commands

```bash
# Start server
npm install && node server.js

# Create admin accounts
node setup-admins.js

# Check server health
curl http://localhost:3000/health

# List tables
curl -X GET http://localhost:3000/admin/stats \
  -H "x-user-role: admin"

# View all users
curl -X GET http://localhost:3000/admin/users \
  -H "x-user-role: admin"
```

---

## Important Notes

⚠️ **Security**: Never commit `.env` file with real credentials  
⚠️ **Database**: Always backup before applying migrations  
⚠️ **Email**: Use Gmail app password, not regular password  
⚠️ **Admin**: Only share admin credentials securely  
⚠️ **Secrets**: Keep `SUPABASE_SERVICE_ROLE_KEY` secret  

---

**Ready to go!** 🚀

Visit http://localhost:3000/login.html and start exploring VIBE.

---

*Platform created with Humility and Respect* 🌊
