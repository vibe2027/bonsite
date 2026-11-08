# VIBE — État du déploiement

Constaté sur la production et les bases de données le 2026-08-28.
Aucune affirmation ici n'est déduite : chaque ligne a été vérifiée.

## Fait

- Le serveur Express tourne en production (`/health` → 200).
- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont présentes dans Vercel
  (injectées par l'intégration Vercel–Supabase). `/health` le confirme :
  `config.supabase_service_role: true`.
- Le formulaire de contact utilise Resend, dont le domaine `vibegay.ca`
  est vérifié pour l'envoi. SendGrid a été retiré du code.
- Le schéma attendu par le backend est appliqué sur `fhksytcoyjtcrkmhnoyw`
  (9 tables, `users` alimentée depuis `profiles`, trigger de synchro actif).
  Vérifié après exécution : les 7 métriques du site vivant sont inchangées,
  0 requête en erreur, 500 codes fondateurs intacts.

## À faire — variables Vercel

https://vercel.com/vibe2026applis-projects/project-ne5p9/settings/environment-variables

| Variable | État | Effet |
|---|---|---|
| `RESEND_API_KEY` | absente | le formulaire de contact renvoie 503 |
| `STRIPE_SECRET_KEY` | absente | `/health` → `stripe: false` |
| `STRIPE_PUBLIC_KEY` | absente | idem |
| `SUPABASE_URL` | pointe sur le projet vide | le backend n'atteint pas les vraies données |

Pour `SUPABASE_URL` : c'est l'intégration Vercel–Supabase qui gère cette
variable. La déconnecter du projet `vdqamjtzksiifnsnztki` avant de la
modifier, sinon elle réécrira la valeur au prochain déploiement.

⚠️ Ne pas supprimer les tables du projet `vdqamjtzksiifnsnztki` tant que
le repointage n'est pas fait : la production les interroge actuellement.

## Ce qui ne marchera PAS, même une fois ces variables réglées

Ces points sont hors du périmètre traité aujourd'hui. Les nommer évite de
croire le système complet alors qu'il ne l'est pas.

**1. Les messages de salon sont dans deux tables distinctes.**

| | table | contenu |
|---|---|---|
| Site vivant (`js/vibe-live.js`, `index.html`) | `salon_messages` | 2 messages réels |
| Backend (`analytics/analytics-service.js`, phase-6) | `salons_messages` | vide |

Le backend lira une table vide pendant que les vrais messages arrivent dans
l'autre. Ses statistiques d'activité afficheront zéro. À trancher : adapter
le backend vers `salon_messages`, ou migrer les messages.

**2. Deux systèmes de modération en parallèle.**

Le site vivant écrit dans `tribunal_signalements` (1 dossier). Le backend
lit `tribunal_cases` (vide). Mêmes conséquences.

**3. Les clés Stripe sont en mode test.**

`sk_test_` / `pk_test_` : aucun paiement réel ne peut être encaissé.
Il faut basculer le dashboard Stripe en mode Live et reprendre les clés
`sk_live_` / `pk_live_`.

**4. `js/supabase-config.js` référence un projet inexistant.**

`depblhxmrzjqnvkszbbl` n'appartient à aucun projet du compte. Le fichier
semble inutilisé — les pages vivantes référencent `fhksytcoyjtcrkmhnoyw`
directement — mais il devrait être corrigé ou supprimé.

## Vérification

    GET https://www.vibegay.ca/health

Le bloc `config` donne un booléen par variable, sans exposer de valeur.
`sql/verify-after-migration.sql` compare la base à la ligne de base
capturée avant migration.
