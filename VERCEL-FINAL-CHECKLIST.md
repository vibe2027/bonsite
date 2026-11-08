# ✅ VERCEL FINAL CHECKLIST
## Avant de Déployer sur vibegay.ca

---

## 🔍 Vérifications Pré-Déploiement (À Faire en Local)

### **1. Module System (CommonJS vs ES Modules)**

- [x] **package.json:** Pas de `"type": "module"` (utilise CommonJS)
- [x] **Tous les require():** Utilisent `require()` pas `import`
- [x] **Tous les exports:** Utilisent `module.exports` pas `export default`

**Commandes de vérification:**
```bash
# Vérifier pas d'ES modules
grep '"type"' package.json  # Ne doit rien retourner

# Vérifier imports CommonJS
grep -r "^import " . --include="*.js" | grep -v node_modules  # Ne doit rien retourner
```

✅ **Résultat:** Tous les fichiers utilisent CommonJS (correct)

---

### **2. Build & Start Scripts**

- [x] **build:** `"true"` (validation uniquement, pas de build réel)
- [x] **start:** `"node server.js"` (démarre le serveur)
- [x] **dev:** `"nodemon server.js"` (développement)

**Vérification:**
```bash
npm run build   # Doit exit 0 silencieusement
npm start       # Doit démarrer sur localhost:3000 sans erreur
```

✅ **Résultat:** Build passe, serveur démarre

---

### **3. Dependencies Vérification**

- [x] Toutes les dépendances Phase 6 dans `package.json`:
  - `@supabase/supabase-js` ✅
  - `@elastic/elasticsearch` ✅
  - `axios` ✅
  - `express` ✅
  - `stripe` ✅

**Vérification:**
```bash
npm install       # Doit complétter sans erreur
npm list          # Doit lister toutes les dépendances
```

✅ **Résultat:** Toutes les dépendances OK

---

### **4. Configuration Vercel**

- [x] **vercel.json:**
  ```json
  {
    "outputDirectory": ".",
    "cleanUrls": true
  }
  ```

- [x] **.vercelignore:** Scripts/tests exclus
- [x] **package.json:** Node 18+, npm 9+

**Vérification:**
```bash
cat vercel.json           # Doit avoir outputDirectory: "."
grep '"node"' package.json  # Doit avoir >=18.0.0
```

✅ **Résultat:** Config OK

---

### **5. Environment Variables**

- [x] Aucune variable d'environnement sensible en hardcoded
- [x] Toutes les clés utilisent `process.env.VAR_NAME`
- [x] `.env.production` ne pas en git (dans .gitignore)

**Vérification:**
```bash
grep -r "sk_live_\|pk_live_\|password" . --include="*.js" | grep -v node_modules  # Ne doit rien retourner
```

✅ **Résultat:** Pas d'env vars en dur

---

### **6. Server Startup**

- [x] Server démarre sans erreur
- [x] Server écoute sur port `process.env.PORT || 3000`
- [x] Routes API répondent

**Vérification:**
```bash
npm start
# Dans un autre terminal:
curl http://localhost:3000/api/health
# Doit retourner JSON
```

✅ **Résultat:** Serveur répond

---

## 🚀 Checkpoints Vercel Dashboard

Avant de déployer, **IMMÉDIATEMENT** sur Dashboard:

### **General & Build Settings**
- [ ] **Build Command:** `npm run build`
- [ ] **Output Directory:** `.` (un point, pas "public")
- [ ] **Install Command:** `npm install`
- [ ] **Node Version:** 18.x (auto ou explicite)

### **Environment Variables (15+)**
- [ ] SUPABASE_URL
- [ ] SUPABASE_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] ELASTICSEARCH_URL
- [ ] ELASTICSEARCH_USERNAME
- [ ] ELASTICSEARCH_PASSWORD
- [ ] OPENAI_API_KEY
- [ ] TURN_SERVER_URL
- [ ] TURN_USERNAME
- [ ] TURN_PASSWORD
- [ ] STRIPE_PUBLIC_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] SENDGRID_API_KEY
- [ ] NODE_ENV=production

### **Domains**
- [ ] `vibegay.ca` ajouté
- [ ] SSL auto-configured

### **Git**
- [ ] Production Branch: `main` (ou ta branche)
- [ ] Auto-deploy: **ENABLED**

---

## 🎯 Déploiement Final

### **Local (Last Checks)**

```bash
# 1. Clean start
rm -rf node_modules && npm install

# 2. Build test
npm run build

# 3. Server test
npm start
# Vérifier aucune erreur dans les logs

# 4. API test
curl http://localhost:3000/api/health
curl http://localhost:3000/api/salons
# Doivent répondre

# 5. Push
git push origin main  # Ou ta branche
```

### **Vercel Dashboard**

1. Va sur **Deployments**
2. Attends que le build lance
3. Observe les logs:
   ```
   ✅ Installing dependencies...
   ✅ Running "npm run build"
   ✅ Build complete
   ✅ Deployed to vibegay.ca
   ```

4. Status doit être **🟢 Deployed**
5. Clique **Visit** pour tester

---

## ✅ Validation Post-Déploiement

### **Endpoints Critiques (Smoke Tests)**

```bash
# 1. Health
curl https://vibegay.ca/api/health
# Résultat: {"status": "ok"}

# 2. Salons
curl https://vibegay.ca/api/salons
# Résultat: [...]

# 3. Search (Phase 6)
curl -X POST https://vibegay.ca/api/search/full-text \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
# Résultat: {results: [...]}

# 4. Webhooks (Stripe)
# Vérifier Dashboard Stripe: Webhooks → Events reçus

# 5. Database (Supabase)
# Vérifier Dashboard Supabase: Tables accessible
```

---

## 🚨 Si Ça Échoue

### **Build Fails**
1. Lire les logs Vercel (Dashboard → Deployments → voir erreur)
2. Reproduire localement: `npm install && npm run build`
3. Fixer et repush

### **500 Error après Deployed**
1. Vérifier env vars sur Dashboard (toutes remplies?)
2. Vérifier logs: `curl https://vibegay.ca/api/health`
3. Vérifier Supabase access (credentials correctes?)
4. Vérifier Elasticsearch/OpenAI access

### **Endpoints 404**
1. Vérifier routes dans server.js
2. Vérifier Phase 6 routes chargées
3. Vérifier `vercel.json` a `outputDirectory: "."`

---

## 📊 Résumé

| Check | Local | Vercel | Status |
|-------|-------|--------|--------|
| CommonJS (require) | ✅ | N/A | ✅ |
| Build script | ✅ | ✅ | ✅ |
| Output directory | ✅ | `.` | ✅ |
| Dependencies | ✅ | npm install | ✅ |
| Env vars | ✅ | Dashboard | ⏳ |
| Server startup | ✅ | N/A | ✅ |
| Deployments | ✅ | Go! | ⏳ |

---

**Tout est prêt ! Déploie avec confiance ! 🚀🔥**

Voir aussi:
- VERCEL-DEPLOYMENT-GUIDE.md (steps complets)
- DEPLOYMENT-PLAN-PHASE-6.md (plan complet)
