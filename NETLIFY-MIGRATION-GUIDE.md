# 🚀 Migration VIBE vers Netlify (Gratuit)

**Date:** 2026-08-31  
**Raison:** Échapper à la suspension Vercel (solde impayé)  
**Coût:** Gratuit (plan free tier de Netlify)  
**Temps:** 5-10 minutes

---

## ✅ Étapes de Déploiement

### **Étape 1: Aller sur Netlify**
1. Va à: https://app.netlify.com
2. Clique **"Sign up"** ou **"Log in"**
3. Connecte-toi avec GitHub (si tu as un compte)

### **Étape 2: Créer un nouveau site**
1. Clique **"New site from Git"**
2. Choisir **GitHub**
3. Sélectionner le repo **vibe2027/VIBE**
4. Clique **"Connect"**

### **Étape 3: Configurer le Build**
Netlify devrait auto-détecter la config, mais vérifie:

```
Build command:     npm run build
Publish directory: .
Functions directory: netlify/functions
```

(C'est déjà configuré dans netlify.toml ✓)

### **Étape 4: Ajouter les Variables d'Environnement**
1. Va à **Site settings → Build & deploy → Environment**
2. Ajoute les mêmes 10 variables qu'avant:
   - `NODE_ENV` = `production`
   - `BASE_URL` = `https://vibegay.ca`
   - `SUPABASE_URL` = `https://fhksytcoyjtcrkmhnoyw.supabase.co`
   - `SUPABASE_ANON_KEY` = `[clé depuis Supabase]`
   - `SUPABASE_SERVICE_ROLE_KEY` = `[clé depuis Supabase]`
   - `STRIPE_PUBLIC_KEY` = `pk_live_...` ou `pk_test_...`
   - `STRIPE_SECRET_KEY` = `sk_live_...` ou `sk_test_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - `STRIPE_PRICE_PREMIUM` = `price_...`
   - `STRIPE_PRICE_FOUNDER` = `price_...`

3. Clique **"Save"**

### **Étape 5: Déclencher le Build**
Netlify devrait auto-déployer. Si non:
1. Va à **Deployments**
2. Clique **"Trigger deploy"** → **"Deploy site"**
3. Attends ~2-3 min (vert ✅)

### **Étape 6: Ajouter le Domaine vibegay.ca**
1. Va à **Domain settings**
2. Clique **"Add custom domain"**
3. Entre: `vibegay.ca`
4. Netlify te donne des instructions DNS

**Mettre à jour le DNS:**
- Va chez ton registraire (Namecheap, GoDaddy, etc.)
- Ajoute un record **CNAME** ou **A**:
  - **Type:** CNAME
  - **Host:** `@` (ou rien)
  - **Value:** `[Netlify te donne ce lien]`

(Propagation: 5-30 min)

---

## 🧪 Tests Après Déploiement

```bash
# Test 1: Site charge
curl -I https://vibegay.ca
# Response: HTTP/1.1 200 OK

# Test 2: API health
curl https://vibegay.ca/api/health
# Response: {"status":"ok",...}

# Test 3: Stripe fonctionne
# (Fais un paiement test)

# Test 4: Supabase accessible
# (Connecte-toi au dashboard)
```

---

## 🆓 Plan Gratuit Netlify - Limitations

| Feature | Limit |
|---------|-------|
| Sites | Illimité |
| Bandwidth | 300 GB/mois |
| Build minutes | 300 min/mois |
| Serverless Functions | 125 K invocations/mois |
| **Suffisant pour?** | ✅ Petit site, petite audience |

**Si tu atteins les limites:** upgrade à $19/mois (ou reste chez Vercel une fois que tu peux payer 💳)

---

## 📝 Fichiers Ajoutés pour Netlify

- ✅ `netlify.toml` - Configuration build & routes
- ✅ `netlify/functions/server.js` - Serverless handler
- ✅ `package.json` - Ajout `serverless-http`

---

## 🎯 Prochaines Étapes

1. **Commit & Push** (déjà fait ✓)
2. **Aller sur Netlify** (5 min)
3. **Connecter le repo** (1 min)
4. **Ajouter les variables** (2 min)
5. **Mettre à jour DNS** (1 min, propagation 5-30 min)
6. **Tester** (2 min)

**Total: ~15 minutes**

---

## ⚠️ Si ça Marche Pas

### Build fails?
```
Logs → Deployments → [latest] → Deploy log
```
Cherche l'erreur rouge. Généralement:
- Variables d'env manquantes → Ajoute-les
- `serverless-http` manquant → `npm install serverless-http`
- Erreur Node → Vérif la version (>= 18)

### Site charges mais API ne répond pas?
```
curl https://vibegay.ca/api/health
```
Si erreur 500:
- Vérif les variables d'env (surtout Stripe/Supabase)
- Regarde les **Function logs** (pas les build logs)

### DNS ne se propage pas?
- Attends 15-30 min
- Ou force le cache: `curl -I https://vibegay.ca` (plusieurs fois)

---

## 💡 Tips

- **Redéployer rapido:** Commit → Push → Netlify auto-déploie
- **Preview deploy:** Chaque PR a un lien preview automatique
- **Rollback:** Clique une ancienne build, puis "Publish deploy"
- **Monitoring:** Netlify Analytics (gratuit, basique)

---

**Créé:** 2026-08-31  
**Status:** 🟢 PRÊT À DÉPLOYER  
**Coût:** 💚 GRATUIT
