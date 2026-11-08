# 📧 Zoho Mail Setup — support@vibegay.ca

**Email setup pour Phase 6 deployment**

---

## Step 1: Create Zoho Account

1. Go to https://mail.zoho.com/
2. Click "Sign Up"
3. Choose: **Professional Email** (not Free)
4. Email: `support@vibegay.ca`
5. Password: [Create STRONG password]
6. Select: **Annual billing** (cheaper)

---

## Step 2: Verify Domain Ownership

Zoho will ask you to verify `vibegay.ca`:

### Option A: Add TXT Record (Recommended)
1. Zoho gives you a **TXT verification code**
2. Go to Namecheap → Advanced DNS
3. Add TXT record:
   - Host: `@`
   - Value: `[Zoho verification code]`
4. Wait 10-15 minutes
5. Click "Verify" in Zoho

### Option B: Add CNAME Record
If TXT doesn't work, Zoho provides CNAME alternative.

⏳ **Wait for verification:** 10-30 minutes

---

## Step 3: Add MX Records

After verification, Zoho gives you **3 MX records**:

**Add to Namecheap DNS:**

| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX | @ | mx.zoho.com | 10 |
| MX | @ | mx2.zoho.com | 20 |
| MX | @ | mx3.zoho.com | 50 |

⚠️ **IMPORTANT:** Add ALL 3 in order of priority!

---

## Step 4: Setup DKIM (SPF Alternative)

For better email deliverability:

1. Zoho Dashboard → Settings → Domain → DKIM
2. Zoho generates DKIM keys
3. Add CNAME record to Namecheap (usually optional if using Zoho nameservers)

---

## Step 5: Create Support Mailbox

1. Zoho Dashboard → Settings → Users
2. Click "Add User"
3. Email: `support@vibegay.ca`
4. First Name: `Support`
5. Last Name: `VIBE`
6. Set password
7. Assign role: **Admin** (can manage settings)

---

## Step 6: Email Forwarding (Optional)

Forward support emails to your personal email:

1. Zoho Dashboard → Settings → Forwarding
2. Add forwarding rule:
   - **From:** `support@vibegay.ca`
   - **To:** `vibeqbc2026@hotmail.com` (or your email)

Now you'll get all support emails in your personal inbox!

---

## Step 7: Configure for SendGrid Integration

In your Vercel environment:

```
SENDGRID_API_KEY=SG.your_key
SENDGRID_FROM_EMAIL=noreply@vibegay.ca
```

**Zoho acts as the RECEIVING mailbox** (support@vibegay.ca)  
**SendGrid sends emails FROM your domain**

---

## 🧪 Test Email Setup

### 1. Test MX Records:
```bash
nslookup -type=MX vibegay.ca
# Should show: mx.zoho.com, mx2.zoho.com, mx3.zoho.com
```

### 2. Send Test Email:
Send from Gmail/Outlook to: `support@vibegay.ca`

Check if it arrives in Zoho Mail.

### 3. Send FROM support@vibegay.ca:
1. Zoho Dashboard → Compose
2. Send test email to yourself
3. Verify it arrives

---

## ✅ Deployment Checklist

- [ ] Zoho account created
- [ ] Domain verified with Zoho
- [ ] MX records added to Namecheap
- [ ] DKIM configured (if needed)
- [ ] support@vibegay.ca mailbox active
- [ ] Test email received successfully
- [ ] SendGrid configured (SENDGRID_API_KEY in Vercel)
- [ ] Forwarding setup (optional)

---

## 📋 Credentials to Save

**Store these SECURELY (not in git):**

```
Zoho Mail Login:
- Email: support@vibegay.ca
- Password: [YOUR_PASSWORD]
- Account: https://mail.zoho.com/

2FA/Recovery Email: vibeqbc2026@hotmail.com
```

---

## 🆘 Troubleshooting

**Emails not arriving?**
- [ ] Check MX records in Namecheap (all 3 added?)
- [ ] Wait 24 hours for DNS propagation
- [ ] Check Zoho spam folder
- [ ] Verify domain ownership completed

**Can't log into Zoho?**
- [ ] Use `support@vibegay.ca` as username
- [ ] Check Caps Lock
- [ ] Reset password if needed
- [ ] Try different browser

**SendGrid integration not working?**
- [ ] Verify SENDGRID_API_KEY in Vercel
- [ ] Check SendGrid domain is authenticated
- [ ] Verify SENDGRID_FROM_EMAIL=noreply@vibegay.ca
- [ ] Check SendGrid bounce logs

**Emails going to spam?**
- [ ] Add DKIM records
- [ ] Add SPF record (v=spf1 sendgrid.net zoho.com ~all)
- [ ] Warm up domain (send gradually)
- [ ] Check sender reputation (SendGrid)

---

## 📊 After Setup

**Check these regularly:**

1. **Zoho Mail Dashboard** → Monitor incoming emails
2. **SendGrid Logs** → Check email delivery
3. **Vercel Logs** → Check form submissions
4. **DNS Health** → Use MXToolbox.com

---

## 🚀 Go Live Checklist

- [ ] Zoho Mail working
- [ ] Contact form sending emails
- [ ] Emails arriving in support@vibegay.ca
- [ ] No spam folder issues
- [ ] DNS fully propagated
- [ ] SendGrid authenticated
- [ ] Backup email forwarding working

---

**Last Updated:** 2026-08-27  
**Email:** support@vibegay.ca  
**Status:** Ready for production
