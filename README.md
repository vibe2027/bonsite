# VIBE 🏳️‍🌈

**VIBE** — Réseau LGBTQ+ canadien nouvelle génération, né à Québec.

Une plateforme communautaire sécurisée conçue pour les personnes LGBTQ+ au Canada, combinant:
- 🎙️ **Salons à voix** — Écoute avant de voir
- 🛡️ **Mode Ange Gardien** — Protection active avec alerte SOS en 3 taps
- 💬 **Salons privés** — Communautés par villes et thèmes
- 👑 **Accès Fondateurs** — Plan d'édition limitée
- ⚖️ **Tribunal Communautaire** — Modération par la communauté

---

## 🚀 Déployer sur Vercel (Phase 6)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvibe2027%2FVIBE&project-name=vibe&repository-name=vibe&branch=claude%2Fvibe-v1-architecture-53i2dd&env=NODE_ENV,APP_URL,SUPABASE_URL,SUPABASE_KEY,SUPABASE_SERVICE_ROLE_KEY,STRIPE_PUBLIC_KEY,STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET,SENDGRID_API_KEY,SENDGRID_FROM_EMAIL&envDescription=API%20keys%20required%20for%20deployment&envLink=https%3A%2F%2Fgithub.com%2Fvibe2027%2FVIBE%2Fblob%2Fclaude%2Fvibe-v1-architecture-53i2dd%2FVERCEL_DEPLOYMENT_STEPS.md)

**Après le déploiement :** Voir [**VERCEL_DEPLOYMENT_STEPS.md**](./VERCEL_DEPLOYMENT_STEPS.md) pour configurer les variables d'environnement et les DNS.

---

## 🚀 Stack Technique

- **Frontend:** un seul fichier `index.html` (HTML5, CSS3, JavaScript vanilla — pas de framework, pas de build)
- **Backend:** Supabase (PostgreSQL + Realtime + Auth)
- **Auth:** Supabase Auth (Email/Password)
- **Paiements:** Stripe (Payment Link), PayPal, virement Interac — activation manuelle du statut Fondateur, aucune réconciliation automatique pour l'instant
- **Hosting:** GitHub Pages
- **Domain:** vibegay.ca (DNS via Namecheap)

## 📁 Structure du Projet

```
VIBE/
├── index.html              # Page principale (tout le site : HTML/CSS/JS)
├── bande-annonce.html       # Page bande-annonce
├── conditions.html          # Conditions d'utilisation
├── confidentialite.html     # Politique de confidentialité (Loi 25 / LPRPDE)
├── manifest.json            # Manifest PWA
├── sw.js                    # Service worker PWA
├── _redirects                # Config de redirection
├── CNAME                    # Domaine custom (GitHub Pages)
├── bg.png, icon-*.png       # Ressources visuelles
├── js/                      # Scripts statiques et placeholders de code mort
│   ├── config.js           # Placeholder désactivé
│   ├── salons.js           # Placeholder désactivé chargé pour compat
│   ├── stripe-config.js
│   ├── ui-salons.js        # Placeholder désactivé
│   ├── vibe-fix.js
│   ├── vibe-fixes.js
│   └── vibe-live.js
└── README.md
```

> ℹ️ `index.html` charge directement `/js/stripe-config.js`, `/js/salons.js`,
> `/js/vibe-live.js` et `/js/vibe-fix.js`. Les fichiers `config.js`,
> `salons.js` et `ui-salons.js` sont conservés comme placeholders désactivés.

## 🔧 Déploiement

Le site est un fichier statique servi par **GitHub Pages** (repo `vibe2027/VIBE`, branche `main`).
Pousser sur `main` déploie automatiquement.

Les credentials Supabase (URL + clé anon) sont codés en dur dans `index.html` (c'est
normal et attendu pour la clé **anon** de Supabase — la sécurité repose sur les
règles RLS côté base de données, pas sur le secret de cette clé).

## 💳 Paiements — état actuel

Le plan Fondateur (99 $CAD/an) propose 3 méthodes : Stripe (lien de paiement direct),
PayPal, et virement Interac. **Aucune de ces méthodes ne met à jour automatiquement**
le statut dans la table `landing_inscriptions` — la réconciliation entre paiement
reçu et statut Fondateur confirmé se fait manuellement.

## 🔐 Sécurité & RLS

Les tables Supabase utilisent Row Level Security (RLS). Un audit de sécurité a corrigé :
GPS exposé dans les alertes SOS, emails exposés dans les inscriptions, permissions
UPDATE ouvertes, exécution anonyme de fonctions privilégiées, et une politique RLS
récursive sur `profiles`.

## 📝 Licence

VIBE est propriétaire. © 2026 VIBE Network.

## 📞 Support

support@vibegay.ca

---

**Mise à jour:** 25 juillet 2026
