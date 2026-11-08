# 🌐 DNS Configuration Guide

**Pour vibegay.ca sur Namecheap**

---

## 📍 Accéder à Namecheap

1. Go to https://www.namecheap.com
2. Login → Dashboard
3. Domain List → vibegay.ca
4. Manage → Advanced DNS

---

## 1️⃣ **MX Records** (Email Routing)

**Pour Zoho Mail:**

### Add Record:
| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX | @ | mx.zoho.com | 10 |
| MX | @ | mx2.zoho.com | 20 |
| MX | @ | mx3.zoho.com | 50 |

⚠️ **IMPORTANT:** Add ALL 3 MX records!

---

## 2️⃣ **SPF Record** (SendGrid + Zoho)

**Add TXT Record:**

```
Type: TXT
Host: @
Value: v=spf1 sendgrid.net zoho.com ~all
```

⚠️ **Note:** This allows both SendGrid and Zoho to send emails

---

## 3️⃣ **DKIM Records** (Email Authentication)

### From SendGrid:
1. Login to SendGrid → Settings → Sender Authentication
2. Authenticate domain → vibegay.ca
3. SendGrid gives you DKIM records
4. Add to Namecheap:

```
Type: CNAME
Host: sendgrid._domainkey
Value: [SendGrid provided CNAME]
```

### From Zoho:
1. Login to Zoho Mail → Settings → Domain
2. Zoho gives you DKIM records
3. Add to Namecheap (usually automatic if using Zoho DNS)

---

## 4️⃣ **CNAME Record** (Vercel Hosting)

**For vibegay.ca on Vercel:**

```
Type: CNAME or Alias
Host: www
Value: cname.vercel-dns.com
```

Or if using `@` (root domain):
```
Type: A Record
Host: @
Value: 76.76.19.165
```

⚠️ **Choose ONE method** (not both)

---

## 5️⃣ **DMARC Record** (Email Security)

**Add TXT Record:**

```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:support@vibegay.ca
```

---

## ✅ Final DNS Records Checklist

```
@ (root)
├── MX → mx.zoho.com (10)
├── MX → mx2.zoho.com (20)
├── MX → mx3.zoho.com (50)
├── TXT → v=spf1 sendgrid.net zoho.com ~all
├── TXT → v=DMARC1; p=quarantine; rua=mailto:support@vibegay.ca
├── A (or CNAME www) → Vercel

sendgrid._domainkey
└── CNAME → [SendGrid provided]

_dmarc
└── TXT → v=DMARC1...
```

---

## 🧪 Verify Configuration

### 1. Test MX Records:
```bash
nslookup -type=MX vibegay.ca
# Should return: mx.zoho.com, mx2.zoho.com, mx3.zoho.com
```

### 2. Test SPF Record:
```bash
nslookup -type=TXT vibegay.ca
# Should show: v=spf1 sendgrid.net zoho.com ~all
```

### 3. Test Domain:
- Send test email to support@vibegay.ca
- Check if it arrives
- Check spam folder

### 4. Check DKIM:
- SendGrid Dashboard → Check "Authenticated"
- Zoho Mail → Check "Verified"

---

## ⏱️ Propagation Time

**DNS changes take time!**

| Service | Time |
|---------|------|
| MX Records | 1-24 hours |
| SPF/DKIM | 1-24 hours |
| Email delivery | After propagation |
| Website access | 5-30 minutes |

✅ **Verify after 2-4 hours**

---

## 🆘 Troubleshooting

**Emails going to spam?**
- [ ] Verify SPF record is set
- [ ] Verify DKIM is authenticated
- [ ] Add DMARC record
- [ ] Check sender reputation (SendGrid)

**Website not accessible?**
- [ ] Check A/CNAME record is correct
- [ ] Wait for propagation (DNS cache)
- [ ] Verify Vercel deployment is active
- [ ] Check browser cache (Ctrl+Shift+Del)

**Email not arriving?**
- [ ] Check MX records are correct
- [ ] Verify email account created in Zoho
- [ ] Check spam/junk folder
- [ ] Review SendGrid bounce logs

**DKIM fails?**
- [ ] Double-check CNAME value from SendGrid
- [ ] Ensure TXT record not duplicated
- [ ] Wait for DNS propagation
- [ ] Re-authenticate in SendGrid

---

## 📊 DNS Propagation Status

Check here: https://mxtoolbox.com/

Enter: `vibegay.ca`

Should show:
- ✅ MX Records valid
- ✅ SPF Record valid
- ✅ DKIM Record valid
- ✅ DMARC Record present

---

**Last Updated:** 2026-08-27  
**Domain:** vibegay.ca  
**Services:** Vercel + Zoho Mail + SendGrid
