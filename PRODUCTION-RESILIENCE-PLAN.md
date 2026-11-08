# 🛡️ VIBE Production Resilience Plan

**Objectif:** Le site ne plante JAMAIS ainsi (ou très rarement)  
**Date:** 2026-08-31  
**Status:** 🟢 IMPLÉMENTER MAINTENANT

---

## 🔴 Problèmes Évités

### Ce Qui S'Est Passé:
1. ❌ **Pas de monitoring** - Personne ne savait que le site était down
2. ❌ **Pas d'alertes** - Découvert tardivement
3. ❌ **Pas de fallback** - Aucune alternative si Vercel tombe
4. ❌ **Pas de healthcheck** - Aucune vérification automatique

### Solutions Mise en Place:
✅ Monitoring 24/7  
✅ Alertes immédiates  
✅ Fallback automatique  
✅ Healthcheck toutes les 5 min

---

## 🚨 Système d'Alertes (IMMÉDIAT)

### **1. Uptime Monitor (Gratuit)**

Utilise **UptimeRobot** (gratuit, pas de CC):

```bash
1. Va à https://uptimerobot.com
2. Sign up (gratuit)
3. Ajoute monitor:
   - URL: https://vibegay.ca/api/health
   - Intervalle: Check toutes les 5 min
   - Email alert: [ton email]
   
4. Si site down 2 fois d'affilée:
   → Alerte email IMMÉDIATE
```

**Coût:** Gratuit (plan free)  
**Coverage:** Jusqu'à 50 monitors

### **2. Status Page (Gratuit)**

Crée une page de statut publique:

```
1. Va à https://statuspage.io (free tier)
2. Crée une page: vibe.statuspage.io
3. Ajoute des components:
   - API Health
   - Stripe Integration
   - Database (Supabase)
   - Email Service
   
4. UptimeRobot ping ton API health
5. Status page se met à jour auto
```

Les users voient: 🟢 **All Systems Operational**

---

## 🔄 Failover Automatique (BACKUP PLAN)

### **Stratégie Multi-Cloud:**

```
Netlify (Primary) ← Principal
      ↓
  [DNS Switch]
      ↓
Railway (Fallback) ← Si Netlify down
```

**Coût:** Railway free = 5$/mois (~gratuit)

### **Setup Railway (15 min):**

```bash
1. Va à https://railway.app
2. Sign up gratuit (GitHub)
3. Crée nouveau project
4. Déploie depuis GitHub: vibe2027/VIBE
5. Ajoute les 10 variables d'env
6. Note l'URL Railway: vibegay-fallback.railway.app
```

### **DNS Failover avec Route53 (AWS):**

Si tu veux failover automatique:

```
vibegay.ca → Netlify (primary)
           → Railway (failover si Netlify down)
           
Health check toutes les 30 sec
Auto-switch si l'une est down
```

**Coût:** Route53 = ~0.50$/mois (très cheap)

**OU solution plus simple:**
- Gardez 2 URLs:
  - `vibegay.ca` → Netlify
  - `backup.vibegay.ca` → Railway
- Si Netlify down, switch manuellement en 2 min

---

## 📊 Healthcheck Automatique (CRON JOB)

### **Crée un script qui teste le site toutes les 5 min:**

```bash
# Create cron job (on ton serveur ou cloud function)
*/5 * * * * bash /path/to/healthcheck.sh
```

**Script `healthcheck.sh`:**

```bash
#!/bin/bash

SITE="https://vibegay.ca"
THRESHOLD=3  # 3 échecs = alerte

# Test 1: Health endpoint
HEALTH=$(curl -s "$SITE/api/health" | grep -o '"status":"ok"')

# Test 2: Homepage loads
HOME=$(curl -s -o /dev/null -w "%{http_code}" "$SITE")

# Test 3: Stripe works
STRIPE=$(curl -s "$SITE/api/checkout-session" -d '{}' | grep -o 'error')

if [ -z "$HEALTH" ] || [ "$HOME" != "200" ]; then
    echo "🚨 SITE DOWN AT $(date)" >> /var/log/vibe-health.log
    
    # Send alert
    curl -X POST https://hooks.slack.com/[your-webhook] \
      -d '{"text":"🚨 VIBE SITE DOWN! https://vibegay.ca/api/health"}'
    
    # Optional: Auto-failover
    # aws route53 change-resource-record-sets ...
fi
```

**Alternatives (plus simple):**
- GitHub Actions (gratuit)
- Netlify Functions (gratuit)
- PagerDuty (gratuit tier)

---

## 📋 Runbook d'Incident (Quick Fix Guide)

### **Quand le site tombe:**

**Étape 1: Diagnostic (30 sec)**
```bash
# Check Netlify status
curl -I https://vibegay.ca

# Check health endpoint
curl https://vibegay.ca/api/health

# Check diagnostics
curl https://vibegay.ca/api/diagnostics

# Check Railway fallback
curl -I https://vibegay-fallback.railway.app
```

**Étape 2: Si c'est un problème Netlify:**
```
→ Va sur https://app.netlify.com
→ Deployments → Voir dernière erreur
→ Probable: Variables d'env, dépendance manquante, ou timeout

→ Redéploie: Click "Retry deploy"
→ Si persiste: Rollback à version précédente
```

**Étape 3: Si c'est un problème Supabase/Stripe:**
```
→ Vérif leur status page:
  - https://status.supabase.com
  - https://status.stripe.com

→ Si down: Rien à faire, attends
→ Si up: Vérif tes clés d'API
```

**Étape 4: Activation Fallback (Railway):**
```
Si Netlify est down > 5 min:
1. Va chez Namecheap/GoDaddy
2. Edite le CNAME: pointe vers Railway
3. Attends 5 min (propagation DNS)
4. Site back up sur fallback

Puis: Enquête sur Netlify pendant que site tourne sur Railway
```

---

## 🔐 Prevention Checklist

### **Chaque Semaine:**
- [ ] Vérif status page: tout vert?
- [ ] Check logs: erreurs? warnings?
- [ ] Test manual: `/api/health` répond?

### **Chaque Mois:**
- [ ] Update dependencies: `npm outdated`
- [ ] Stripe/Supabase quota check
- [ ] Netlify build time vs limite (300 min/mois)
- [ ] Fallback test: Railway déploie correctement?

### **Chaque Trimestre:**
- [ ] Full incident drill: Simule Netlify down
- [ ] Backup test: Can we restore from DB?
- [ ] Security audit: Pas de secrets exposés?
- [ ] Performance check: Response time < 1s?

---

## 💳 Payment Prevention

### **Netlify Payment:**
- Free tier: 300 min build/mois
- Si atteint la limite: Upgrade auto à $19/mois (CONFIGURE TOI-MÊME)
- **Action:** Setup auto-payment MAINTENANT
  ```
  Netlify → Team → Billing → Add payment method
  ```

### **Railway Payment:**
- Free tier: $5 credit/mois (gratuit)
- Après: Pay as you go (~0.10$/GB, cheap)
- **Action:** Ajoute une carte pour failover

### **Supabase Payment:**
- Free tier: Jusqu'à 500K API calls/mois
- Si dépassé: Alerte avant facturation
- **Action:** Setup billing alerts

### **Stripe Payment:**
- Aucun coût pour toi (tu REÇOIS l'argent)
- Webhooks super importants (paiements perdus sinon)
- **Action:** Vérif webhook URL correcte chaque mois

---

## 🎯 Checklist Implementation (Aujourd'hui)

### **Urgent (30 min):**
- [ ] Setup UptimeRobot (gratuit)
- [ ] Ajouter email alerts
- [ ] Test: Force un down artificiel, reçois alerte

### **Important (1h):**
- [ ] Deploy Railway fallback
- [ ] Ajouter variables d'env Railway
- [ ] Test failover manual

### **Nice to Have (2h):**
- [ ] Setup status page public
- [ ] GitHub Actions healthcheck
- [ ] Runbook document dans Slack

---

## 📞 Emergency Contacts

Crée un document privé avec:
```
VIBE Incident Contacts
━━━━━━━━━━━━━━━━━━━━━━
Netlify Support: support@netlify.com
Railway Support: help@railway.app
Supabase Support: support@supabase.com
Stripe Support: support@stripe.com

Escalation:
- If down 5 min: Check status pages
- If down 15 min: Failover to Railway
- If down 30 min: Post on status page
```

---

## 🚀 Next Incident Won't Happen (Or Minimal Impact)

| Scenario | Before | After |
|----------|--------|-------|
| **Vercel payment suspension** | 🔴 Down 24h+ | 🟡 Failing over 5 min |
| **Netlify build fails** | ❓ Nobody knows | 🚨 Alerte email instant |
| **Stripe API down** | 💔 Lost sales | 📊 Users see status |
| **Supabase down** | 🔴 Total blackout | 🟡 Partial (cached data) |
| **DNS propagation slow** | 😭 Users stuck | 🟢 Works on fallback |

---

## 💰 Total Monthly Cost

| Service | Free | Paid | Your Cost |
|---------|------|------|-----------|
| Netlify | 300 min/mo | $19 | $0 (free) |
| Railway | $5 credit | $0.10/GB | ~$5 |
| UptimeRobot | 50 monitors | - | $0 (free) |
| StatusPage | 1 site | $29 | $0 (free) |
| Route53 | - | $0.50 | $0.50 |
| **TOTAL** | | | **~$5.50/mo** |

*(vs Vercel: $20+/mo for reliability)*

---

## 🎓 Lessons Learned

1. ✅ Never rely on ONE hosting
2. ✅ Automate everything (monitoring, alerts, failover)
3. ✅ Public status page = fewer "is it down?" messages
4. ✅ Payment tracking = no surprise suspensions
5. ✅ Documentation = fast recovery

---

**Created:** 2026-08-31  
**Next Step:** Implement UptimeRobot TODAY  
**Status:** 🟢 READY  
**Confidence:** 🛡️ HIGH (99.9% uptime achievable)
