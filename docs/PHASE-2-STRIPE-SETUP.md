# 🚀 VIBE Phase 2 — Stripe Payments Setup

**Objectif:** Intégrer Stripe pour monétiser VIBE avec:
- ✅ Sécurité HMAC-SHA256 (webhooks non-spoofables)
- ✅ Idempotence (webhooks réessayés = zéro duplication)
- ✅ Role assignment (premium après paiement)

---

## 📋 Checklist d'intégration

### ÉTAPE 1: Préparer Supabase (5 min)

```bash
# 1. Va sur https://app.supabase.com/project/fhksytcoyjtcrkmhnoyw
# 2. SQL Editor → New query
# 3. Copie-colle users_schema.sql ENTIÈREMENT
# 4. Clique Run → Attends ✅ Success
```

**Vérifications rapides:**
```sql
-- Test 1: Table existe
SELECT * FROM users LIMIT 1;

-- Test 2: Indexes existent
SELECT indexname FROM pg_indexes WHERE tablename = 'users';

-- Test 3: RLS activée
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'users';
```

---

### ÉTAPE 2: Stripe Configuration (10 min)

1. **Va sur https://dashboard.stripe.com**
2. **Développeurs → Clés API** → Copie:
   - `pk_live_...` (Public key)
   - `sk_live_...` (Secret key)

3. **Créer Produit:**
   - Produits → Ajouter produit
   - Nom: "VIBE Premium"
   - Prix: $9.99/month (ou what you want)
   - Copie le `price_xxx` ID

4. **Webhooks:**
   - Développeurs → Webhooks
   - Ajouter endpoint: `https://vibegay.ca/api/webhooks/stripe`
   - Events à écouter:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Copie le webhook secret: `whsec_xxx`

---

### ÉTAPE 3: Déployer Backend (15 min)

**Variables d'environnement (.env):**
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Supabase
SUPABASE_URL=https://fhksytcoyjtcrkmhnoyw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (copie depuis Supabase Settings → API)

# App
BASE_URL=https://vibegay.ca
```

**Installer dépendances:**
```bash
npm install stripe @supabase/supabase-js
```

**Intégrer webhook handler:**
```javascript
// server.js (ou whereever you handle routes)
const { handleWebhook } = require('./webhook-handler.js');

// IMPORTANT: Raw body parser BEFORE json middleware
app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

app.use(express.json());
```

**Intégrer checkout session endpoint:**
```javascript
// Copie la fonction createCheckoutSession du fichier checkout-session.js
// Elle crée les Stripe sessions avec metadata
```

---

### ÉTAPE 4: Intégrer Frontend (10 min)

**Ajouter bouton de paiement (index.html):**
```html
<button onclick="createCheckoutSession('premium')">
  💳 Upgrade to Premium
</button>

<script src="/js/checkout-session.js" defer></script>
```

**Flow utilisateur:**
1. User clique "Upgrade"
2. Frontend appelle `createCheckoutSession('premium')`
3. Backend crée Stripe session
4. Browser redirige vers Stripe Checkout
5. User paie
6. Webhook arrive: `payment_intent.succeeded`
7. Backend valide signature HMAC
8. Backend assigne `role = 'premium'`
9. User revient → Dashboard affiche "Premium ✅"

---

## 🔒 Sécurité — Pourquoi c'est immuable

### HMAC-SHA256 Signature Verification

```javascript
// ✅ Stripe PEUT signer (il connaît le WEBHOOK_SECRET)
stripe_signature = HMAC-SHA256(timestamp.body, WEBHOOK_SECRET)

// ❌ Attacker CANNOT forger (il ne connaît pas le WEBHOOK_SECRET)
// Même avec accès à 1000 webhooks, il ne peut pas calculer le secret
// C'est mathématiquement impossible (preuve: cryptographie)
```

### Idempotence via UNIQUE constraint

```sql
-- Même webhook arrive 2x
stripe_customer_id TEXT UNIQUE
-- ↓
-- 1er arrive: INSERT OK
-- 2e arrive: UNIQUE violation → Transaction échoue
-- ↓
-- Zéro duplication, zéro crédit double
```

---

## 📊 Flow Complet

```
┌─────────────────────────────────────────────────────────┐
│ 1️⃣ USER CLICK "Upgrade"                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────▼──────────────┐
         │ 2️⃣ Frontend: getUser()   │
         │    Call /checkout-session│
         └────────────┬──────────────┘
                      │
    ┌─────────────────▼────────────────┐
    │ 3️⃣ Backend: Create Stripe       │
    │    Session (metadata=auth_id)   │
    └─────────────────┬────────────────┘
                      │
    ┌─────────────────▼────────────────┐
    │ 4️⃣ Stripe Checkout              │
    │    User enters card              │
    └─────────────────┬────────────────┘
                      │
        ┌─────────────▼────────────────┐
        │ 5️⃣ Payment Processing        │
        │    payment_intent.succeeded   │
        └─────────────┬────────────────┘
                      │
    ┌─────────────────▼─────────────────────┐
    │ 6️⃣ Webhook → Backend:                 │
    │    POST /webhooks/stripe               │
    │    stripe-signature: HMAC-SHA256      │
    └─────────────┬───────────────────────────┘
                  │
    ┌─────────────▼──────────────────────┐
    │ 7️⃣ Verify Signature (✅ passé)    │
    │    Extract metadata (auth_id)      │
    └─────────────┬──────────────────────┘
                  │
    ┌─────────────▼──────────────────────┐
    │ 8️⃣ DB: Update user role            │
    │    UPDATE users SET role='premium' │
    │    WHERE stripe_customer_id=...    │
    └─────────────┬──────────────────────┘
                  │
    ┌─────────────▼──────────────────────┐
    │ 9️⃣ User Dashboard                  │
    │    role='premium' → Features lock   │
    │    unlocked ✅                      │
    └──────────────────────────────────────┘
```

---

## 🧪 Test Local (Before Deploying)

### Test 1: Database Setup
```sql
-- Vérifier users table
SELECT * FROM users WHERE stripe_customer_id IS NOT NULL;
-- Doit retourner: (no rows) initialement

-- Vérifier indexes
\d users
```

### Test 2: Webhook Signature
```javascript
// Test HMAC generation
const crypto = require('crypto');
const secret = 'whsec_test_secret';
const timestamp = '1234567890';
const body = '{"id":"evt_test"}';

const signedContent = `${timestamp}.${body}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(signedContent)
  .digest('hex');

console.log('Expected signature:', signature);
// Stripe will send: stripe-signature: t=1234567890,v1=<signature>
```

### Test 3: Role Assignment
```javascript
// Simulating a webhook (after deployment)
const payload = {
  type: 'payment_intent.succeeded',
  data: {
    object: {
      customer: 'cus_abc123',
      metadata: { auth_id: 'user-uuid' }
    }
  }
};

// Mock webhook call (use Stripe CLI for real testing)
await assignPremiumRole('user-uuid', 'cus_abc123');

// Verify
const { data: user } = await supabase
  .from('users')
  .select('role, stripe_customer_id')
  .eq('auth_id', 'user-uuid');

console.log(user); // Should show role='premium'
```

---

## 🚀 Déploiement

### GitHub Actions (Recommended)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build
      - run: npm run deploy
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Stripe CLI (Local Testing)
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to local backend
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy webhook signing secret → .env
```

---

## ✅ Validation Checklist

- [ ] Supabase: users table créée + RLS OK
- [ ] Stripe: Produit créé + Clés copiées
- [ ] Backend: Variables .env définies
- [ ] Backend: webhook handler intégré
- [ ] Backend: checkout-session endpoint fonctionnel
- [ ] Frontend: Bouton "Upgrade" affiche
- [ ] Test: Webhook signature verification ✅
- [ ] Test: Role assignment après paiement ✅
- [ ] Test: Idempotence (webhook 2x = 1 update)
- [ ] Déploiement: CI/CD prêt

---

## 📞 Troubleshooting

| Problème | Cause | Fix |
|----------|-------|-----|
| Signature verification échoue | WEBHOOK_SECRET incorrect | Copie depuis Stripe Dashboard exactement |
| Payment ne crée pas user | auth_id manquant dans metadata | Vérifier createCheckoutSession envoie metadata |
| Role ne s'assigne pas | Service role key invalide | Copie depuis Supabase Settings → API |
| UNIQUE violation | Même customer_id lié 2x | C'est normal! Idempotence en action |
| Webhook ne reçoit pas | URL webhook mauvaise | Vérifier `BASE_URL` en .env |

---

**Prêt à déployer? Dis "Phase 2 GO" et on finalise!** 🎯
