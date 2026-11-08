# 🚀 Guide Déploiement VIBE sur Vercel
## Configuration Dashboard pour vibegay.ca

---

## 📋 Configuration Vercel Dashboard (CRITIQUE)

**URL:** https://vercel.com/dashboard → Ton projet VIBE

### **1. Settings → General & Build Settings**

| Paramètre | Valeur | Remarque |
|-----------|--------|----------|
| **Framework Preset** | Node.js | Auto-détecté |
| **Build Command** | `npm run build` | Exécute `true` (validation uniquement) |
| **Output Directory** | `.` | Point = racine du projet |
| **Install Command** | `npm install` | Standard |
| **Node Version** | 18.x ou 20.x | >=18.0.0 |

✅ **Important:** Le Output Directory **doit être `.`** (un simple point), pas "public" ou vide.

### **2. Settings → Environment Variables**

Ajoute **EXACTEMENT** ces variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# Elasticsearch
ELASTICSEARCH_URL=https://elasticsearch.yourdomain.com:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your-secure-password

# OpenAI (Phase 6 Moderation)
OPENAI_API_KEY=sk-...your-openai-key...

# TURN Server (Phase 6 WebRTC)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=vibe-rtc
TURN_PASSWORD=your-secure-password

# Stripe (Payments)
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SendGrid (Email)
SENDGRID_API_KEY=SG...

# Feature Flags (Phase 6)
FEATURE_FLAG_REALTIME_COLLAB=true
FEATURE_FLAG_ADVANCED_SEARCH=true
FEATURE_FLAG_RECOMMENDATIONS=true
FEATURE_FLAG_MOBILE_APP=true
FEATURE_FLAG_WEBRTC_VIDEO=true
FEATURE_FLAG_NLP_MODERATION=true

# Logging
NODE_ENV=production
LOG_LEVEL=info
```

✅ **Point crucial:** Ces variables **doivent être définiés sur le Dashboard Vercel**, pas dans .env (qui n'est pas poussé).

### **3. Settings → Domains**

- ✅ Ajouter `vibegay.ca` comme domaine principal
- ✅ Configurer DNS Records si nécessaire
- ✅ SSL auto (Vercel le gère)

### **4. Settings → Git**

- ✅ Connected Repository: `vibe2027/VIBE`
- ✅ Production Branch: `main` (ou `claude/vibe-v1-architecture-53i2dd` pour test)
- ✅ Auto Deploy: **Enabled**
- ✅ Preview Deployments: **Enabled**

---

## 🔍 Vérification Avant Déploiement

### Localement (avant push)

```bash
# 1. Vérifier structure
ls -la vercel.json  # Doit exister
cat vercel.json     # Doit avoir "outputDirectory": "."

# 2. Vérifier build
npm run build       # Doit exit avec code 0

# 3. Vérifier serveur démarre
npm start           # Doit écouter sur localhost:3000

# 4. Valider pré-requis
node scripts/pre-deployment-check.js
```

### Sur Vercel Dashboard

**Après chaque push:**

1. Va sur **Deployments** tab
2. Attends le build (5-10 min)
3. Vérifie les logs:
   - ✅ `npm install` réussi
   - ✅ `npm run build` = `true` (exit 0)
   - ✅ Pas d'erreurs JavaScript
   - ✅ Pas d'erreurs réseau

4. Une fois **Deployed**, clique **Visit** pour tester

---

## ⚠️ Problèmes Courants & Solutions

### "No Output Directory named public found"
**Cause:** Output Directory mal configuré  
**Fix:** Dashboard Settings → Output Directory = `.` (un point)

### Build timeout (> 15 min)
**Cause:** Script de build trop lourd  
**Fix:** Vérifier que `npm run build` = `true` (ne rien faire)

### "Cannot find module 'X'"
**Cause:** Dépendance manquante  
**Fix:** Vérifier package.json + `npm install` local

### WebRTC/Elasticsearch ne répond pas
**Cause:** Env vars manquantes  
**Fix:** Dashboard → Environment Variables → Ajouter toutes les clés

### Feature 404 après déploiement
**Cause:** Routes Phase 6 non reconnues  
**Fix:** Vérifier server.js charge bien les routes Phase 6

---

## 🚀 Déploiement Pas à Pas

### **Step 1: Préparer (Local)**
```bash
git status              # Working tree clean?
npm run build           # Build réussit?
npm start               # Serveur démarre?
```

### **Step 2: Configurer (Vercel Dashboard)**
```
Settings → General: Output Directory = "."
Settings → Environment: Ajouter 15+ variables
Settings → Domains: Ajouter vibegay.ca
Settings → Git: Production Branch = main
```

### **Step 3: Déployer**
```bash
git push origin main    # Ou ta branche
# Vercel redéploie automatiquement
```

### **Step 4: Valider (Vercel Dashboard)**
- ✅ Deployments → Status = "Deployed" (vert)
- ✅ Logs = pas d'erreur
- ✅ Visit → Page charge
- ✅ `/api/health` → `{ "status": "ok" }`

### **Step 5: Smoke Tests (Production)**
```bash
# Via navigateur ou curl
curl https://vibegay.ca/api/health
curl https://vibegay.ca/api/salons
curl https://vibegay.ca/api/search/full-text
# Etc...
```

---

## 📊 Checklist Final

- [ ] vercel.json existe & configuré
- [ ] package.json build = `true`
- [ ] Dépendances installées (`npm install`)
- [ ] Node 18+ configuré
- [ ] Env vars sur Dashboard (15+)
- [ ] Domaine vibegay.ca configuré
- [ ] Auto-deploy activé
- [ ] Git branch = main
- [ ] Branche poussée & build lancé
- [ ] Logs Vercel = vert (Deployed)
- [ ] Site accessible sur vibegay.ca
- [ ] Smoke tests (5 endpoints) OK
- [ ] Feature flags activés
- [ ] Monitoring alertes configurées

---

## 🎯 Après Go-Live

### Premier 24h (Vigilance Max)
- Vérifier logs **toutes les heures**
- Tester endpoints critiques
- Vérifier Supabase, Stripe webhooks, Email
- Monitorer CPU/Memory sur Dashboard

### Première Semaine
- Réduire à 2x par jour
- Recueillir feedback utilisateurs
- Valider feature flags

### Ongoing
- Logs via Sentry (si configuré)
- Monitoring via Datadog (si configuré)
- Weekly health check

---

## 🔗 Ressources

- **Vercel Docs:** https://vercel.com/docs
- **Node.js on Vercel:** https://vercel.com/docs/concepts/nodejs
- **Environment Variables:** https://vercel.com/docs/concepts/projects/environment-variables
- **Deployments:** https://vercel.com/docs/concepts/deployments/overview

---

**Deployment Guide v1.0** | Phase 6 Complete | 2026-08-27
