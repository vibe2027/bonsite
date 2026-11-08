# VIBE Platform - Complete Setup Guide

## Overview
VIBE is a complete production-ready LGBTQ+ community platform with real-time chat, tribunal moderation, advertising system, and role-based admin dashboard.

## Prerequisites

```bash
# Install dependencies
npm install express cors supabase nodemailer stripe dotenv
```

## Environment Variables (.env)

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
STRIPE_PRICE_PREMIUM=price_xxx
STRIPE_PRICE_FOUNDER=price_yyy

# Email (Gmail SMTP)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

# Server
BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

## Database Setup

### 1. Execute Schema

Run the complete schema in your Supabase SQL editor:

```bash
cat sql/complete-schema.sql | psql
```

Or paste the contents of `/sql/complete-schema.sql` directly into Supabase dashboard.

### 2. Create Special Admin Accounts

#### Option A: Via Backend Script (Recommended)

```bash
node setup-admins.js
```

This creates:
- **Admin**: support@vibegay.ca (Full platform access)
- **Co-Founder**: admin@vibegay.ca (1000 billets/month, hidden access)

#### Option B: Manual Creation

Use Supabase Admin Panel or run these API calls:

**1. Create Admin Account:**
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "support@vibegay.ca",
    "password": "SecurePassword123!",
    "fullName": "VIBE Admin",
    "region": "Gaspésie"
  }'
```

**2. Create Co-Founder Account:**
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@vibegay.ca",
    "password": "SecurePassword456!",
    "fullName": "VIBE Co-Founder",
    "region": "Gaspésie"
  }'
```

## Server Startup

```bash
node server.js
```

Server will start on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login
- `POST /auth/verify-email` - Verify email
- `POST /auth/send-billets` - Send billets (co-founder/admin only)
- `POST /auth/tribunal-case` - Create tribunal case

### Admin Dashboard
All admin routes require `x-user-role: admin` header

- `GET /admin/stats` - Dashboard statistics
- `GET /admin/users` - List users (paginated)
- `PUT /admin/users/:userId/role` - Change user role
- `POST /admin/users/:userId/suspend` - Suspend user
- `GET /admin/tribunal` - List tribunal cases
- `PUT /admin/tribunal/:caseId/resolve` - Resolve case
- `GET /admin/tribunal/stats` - Tribunal statistics
- `GET /admin/pubs` - List pubs for approval
- `PUT /admin/pubs/:pubId/approve` - Approve pub
- `PUT /admin/pubs/:pubId/reject` - Reject pub
- `POST /admin/billets/:userId/adjust` - Adjust user billets
- `GET /admin/activity` - Activity log

### Realtime Chat
- Requires Supabase Realtime subscription to `salons_messages` table
- Salons: `flottant`, `voix`, `fantomes`, `tribunal`

## Frontend URLs

- **Login**: `http://localhost:3000/login.html`
- **Admin Dashboard**: `http://localhost:3000/admin-dashboard-ui.html` (admin only)
- **Co-Founder Dashboard**: `http://localhost:3000/co-founder-dashboard.html` (co-founder only)
- **Main App**: `http://localhost:3000/index.html` (users)

## Architecture

### Tables

1. **users** - User accounts with role-based access
2. **billets** - Currency/credits system with monthly limits
3. **billet_transactions** - Transaction history
4. **tribunal_cases** - Moderation cases
5. **tribunal_votes** - Community voting on cases
6. **salons_messages** - Real-time chat messages
7. **pubs** - Advertising/promotional content
8. **user_profiles** - User profile information
9. **email_logs** - Email sending history
10. **blocked_users** - User blocking relationships

### Features

#### Authentication
- Email/password signup
- Automatic role detection (admin/co_founder/user)
- Email verification
- Session management

#### Role Management
- **Admin** (support@vibegay.ca):
  - Full platform access
  - User management
  - Tribunal resolution
  - Pubs approval
  - Billets adjustment
  - Analytics access

- **Co-Founder** (admin@vibegay.ca):
  - Hidden from public (6-12 months)
  - 1000 billets/month maximum
  - Can send pubs
  - Direct admin connection
  - Co-founder dashboard access

- **User**:
  - Create tribunal cases
  - Send/receive billets
  - Create pubs (pending approval)
  - Chat in salons
  - Join community

#### Billets System
- Monthly limits per role
- Transaction history
- Hidden billets for co-founders
- Admin adjustment capability

#### Tribunal System
- Community case management
- Admin resolution
- Voting mechanism
- Email notifications

#### Real-time Chat
- 4 Salons: Flottant, Voix, Fantômes, Tribunal
- Live message updates via Supabase Realtime
- Message editing/deletion
- User mentions

#### Pubs/Advertising
- User-created promotional content
- Admin approval workflow
- Billing via billets
- Salon-specific targeting

#### Email System
- Account verification
- Role confirmation
- Tribunal notifications
- Pub approvals
- Automated via nodemailer + Gmail SMTP

## Security Features

### Row Level Security (RLS)
- Users see only own profile (except admins)
- Billets visibility restricted
- Co-founder billets hidden from public
- Tribunal cases filtered by status

### Authentication
- Supabase Auth service role
- Email verification required
- Session tokens for API

### Data Protection
- Stripe webhook signature verification (HMAC-SHA256)
- Environment variables for secrets
- Service role for admin operations

## Maintenance

### Daily Checks
- Monitor email delivery
- Check tribunal cases
- Verify payment webhooks

### Monthly Tasks
- Reset co-founder billets
- Archive old messages
- Review tribunal cases

### Security Updates
- Keep dependencies updated
- Rotate Stripe/Supabase keys quarterly
- Review access logs

## Troubleshooting

### Email Not Sending
- Verify Gmail app password (not regular password)
- Check SMTP credentials
- Enable "Less secure apps" if needed

### Stripe Webhook Issues
- Verify webhook secret in environment
- Check Stripe dashboard for signature verification
- Ensure raw body is used (not JSON parsed)

### Supabase Connection
- Verify URL and keys
- Check RLS policies
- Confirm service role has full access

### Session/Auth Issues
- Clear browser localStorage
- Verify JWT tokens
- Check user role in database

## Performance Notes

- Pagination: 50 users per page recommended
- Chat messages: Index on (salon, created_at) for fast queries
- Tribunal cases: Archive resolved cases monthly
- Billets: Reset schedule runs at UTC midnight

## Deployment

### Local Development
```bash
npm install
node server.js
# Visit http://localhost:3000/login.html
```

### Production (Heroku)
```bash
git push heroku main
heroku config:set VAR_NAME=value
```

### Production (Railway/Render)
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

## Support

For issues or questions:
- Check `/docs` folder for additional documentation
- Review error logs in server console
- Verify all environment variables are set

## License

VIBE Platform © 2026 - Avec Humilité et Respect 🌊

---

**Platform Philosophy**: Complete humility and respect for the LGBTQ+ community. Every feature designed with consent, privacy, and dignity in mind.
