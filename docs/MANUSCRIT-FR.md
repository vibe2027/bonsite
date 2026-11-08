# Plateforme VIBE — Manuscrit complet

**Plateforme** : VIBE — Connexion authentique pour la communauté LGBTQ+
**Version** : 1.0.0
**Rédigé le** : 27 août 2026
**Statut** : Prêt pour la production

---

> ## ⚠️ Note de mise à jour — 28 août 2026
>
> Ce manuscrit décrit l'architecture telle que conçue le 27 août. Trois éléments
> ont changé depuis. Ils sont signalés à leur emplacement dans le texte, et
> résumés ici :
>
> | Décrit dans le manuscrit | Réalité aujourd'hui |
> |---|---|
> | Courriels par Gmail SMTP (Nodemailer) | **Resend**, domaine vibegay.ca vérifié |
> | Paiements par Stripe, « prêt » | **Compte Stripe fermé le 17 août.** Paiements par virement Interac uniquement |
> | Déploiement Heroku / Railway / Render | **Vercel**, à vibegay.ca |
>
> Le reste du document — schéma de base de données, authentification, tableaux de
> bord, Tribunal, billets, publicités, API, sécurité — demeure exact.

---

## Table des matières

1. [Résumé](#résumé)
2. [Architecture de la plateforme](#architecture-de-la-plateforme)
3. [Schéma de base de données](#schéma-de-base-de-données)
4. [Système d'authentification](#système-dauthentification)
5. [Tableau de bord administrateur](#tableau-de-bord-administrateur)
6. [Système cofondateur](#système-cofondateur)
7. [Fonctionnalités membres](#fonctionnalités-membres)
8. [Communication en temps réel](#communication-en-temps-réel)
9. [Système du Tribunal](#système-du-tribunal)
10. [Facturation et billets](#facturation-et-billets)
11. [Système publicitaire](#système-publicitaire)
12. [Système de courriels](#système-de-courriels)
13. [Référence de l'API](#référence-de-lapi)
14. [Sécurité](#sécurité)
15. [Déploiement](#déploiement)

---

## Résumé

VIBE est une plateforme web complète, prête pour la production, conçue
spécifiquement pour la communauté LGBTQ+. Elle réunit en un seul ensemble
cohérent la communication en temps réel (salons de discussion), la modération
communautaire (Tribunal), la diffusion publicitaire (pubs) et un système de
facturation interne original (billets).

### Valeurs fondatrices

- **Humilité totale** : une humilité complète dans toutes les interactions
- **Respect** : un respect profond des membres de la communauté
- **Sécurité** : modération et Tribunal au service de la sécurité
- **Transparence** : des règles claires, une communication ouverte
- **Authenticité** : de vraies connexions, dans un espace accueillant

### Rôles administratifs particuliers

**Compte administrateur**

- Courriel : `support@vibegay.ca`
- Accès complet à la plateforme
- Tableau de bord : `/admin-dashboard-ui.html`
- Pouvoirs : gestion des membres, résolution des dossiers du Tribunal,
  approbation des pubs, ajustement des billets

**Compte cofondateur**

- Courriel : `admin@vibegay.ca`
- Maximum de 1 000 billets par mois
- Accès discret (non visible du public pendant 6 à 12 mois)
- Peut diffuser des pubs
- Tableau de bord : `/co-founder-dashboard.html`
- Courriel de confirmation particulier, détaillant les accès

---

## Architecture de la plateforme

### Pile technologique

**Côté serveur**

- Node.js + Express.js (API REST)
- Supabase (base PostgreSQL + authentification + temps réel)
- ~~Nodemailer (Gmail SMTP)~~ → **Resend** (voir la note de mise à jour)
- ~~Stripe (traitement des paiements)~~ → **virement Interac** (compte Stripe fermé)

**Côté client**

- HTML5 + CSS3 (design glassmorphisme)
- JavaScript natif
- Client JS Supabase (abonnements temps réel)
- LocalStorage (persistance de session)

**Infrastructure**

- Environnement : développement local ou infonuagique — **en production : Vercel**
- Base de données : PostgreSQL avec sécurité au niveau des lignes (RLS)
- Authentification : Supabase Auth (courriel / mot de passe)
- Temps réel : canaux Supabase Realtime

### Parcours du système

```
Inscription du membre
    ↓
Vérification du courriel
    ↓
Attribution du rôle (membre / cofondateur / administrateur)
    ↓
Accès au tableau de bord correspondant
    ↓
Utilisation des fonctionnalités
```

---

## Schéma de base de données

### 1. Table `users` (membres)

Stocke les comptes avec contrôle d'accès par rôle.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  region TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'co_founder', 'user')),
  stripe_customer_id TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'basic',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);
```

**Champs déterminants** :

- `auth_id` : lien vers Supabase Auth
- `role` : détermine le niveau d'accès
- `is_verified` : état de la vérification du courriel
- `stripe_customer_id` : intégration Stripe

### 2. Table `billets`

Monnaie interne, avec plafonds mensuels.

```sql
CREATE TABLE billets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  balance INT DEFAULT 0,
  monthly_limit INT DEFAULT 1000,
  is_co_founder_hidden BOOLEAN DEFAULT false,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Champs déterminants** :

- `balance` : solde courant de billets
- `monthly_limit` : maximum mensuel
- `is_co_founder_hidden` : masque les billets du cofondateur au public

### 3. Table `billet_transactions`

Historique des mouvements et piste de vérification.

```sql
CREATE TABLE billet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  transaction_type TEXT CHECK(transaction_type IN (
    'send', 'receive', 'purchase', 'refund', 'admin_adjustment'
  )),
  description TEXT,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 4. Table `tribunal_cases` (dossiers du Tribunal)

Système de modération communautaire pour le règlement des différends.

```sql
CREATE TABLE tribunal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complainant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  defendant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_type TEXT CHECK(case_type IN (
    'harassment', 'inappropriate_content', 'scam', 'other'
  )),
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'open' CHECK(status IN (
    'open', 'under_review', 'resolved', 'dismissed'
  )),
  resolution TEXT,
  admin_notes TEXT,
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 5. Table `tribunal_votes`

Vote de la communauté sur les dossiers (fonction facultative).

```sql
CREATE TABLE tribunal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT CHECK(vote IN ('support_complainant', 'support_defendant', 'abstain')),
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(case_id, voter_id)
);
```

### 6. Table `salons_messages`

Messages de clavardage en temps réel, dans quatre salons.

```sql
CREATE TABLE salons_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon TEXT NOT NULL CHECK(salon IN (
    'flottant', 'voix', 'fantomes', 'tribunal'
  )),
  user_id TEXT NOT NULL,
  texte TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Les quatre salons** :

- **Flottant** : conversation générale, à la dérive
- **Voix** : espace de discussion vocale et audio
- **Fantômes** : messages privés ou effacés
- **Tribunal** : échanges liés à la modération

### 7. Table `pubs` (publicités)

Système de contenu promotionnel.

```sql
CREATE TABLE pubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  salon TEXT CHECK(salon IN ('flottant', 'voix', 'fantomes')),
  status TEXT DEFAULT 'pending' CHECK(status IN (
    'pending', 'approved', 'rejected', 'active', 'ended'
  )),
  billets_cost INT DEFAULT 100,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 8. Table `user_profiles`

Informations de profil étendues.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  profile_photo_url TEXT,
  city TEXT,
  region TEXT,
  pronouns TEXT,
  interests TEXT[],
  is_verified_lgbtq BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 9. Table `email_logs`

Piste de vérification de tous les courriels envoyés.

```sql
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT CHECK(email_type IN (
    'verification', 'password_reset', 'welcome', 'notification',
    'tribunal_update', 'pub_approved'
  )),
  subject TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMP WITH TIME ZONE
);
```

### 10. Table `blocked_users`

Relations de blocage entre membres, au service de la sécurité.

```sql
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
```

---

## Système d'authentification

### Parcours d'inscription

**Point d'entrée** : `POST /auth/signup`

**Entrée** :

```json
{
  "email": "membre@exemple.com",
  "password": "MotDePasseSolide123",
  "fullName": "Nom du membre",
  "region": "Gaspésie"
}
```

**Traitement** :

1. Valider l'entrée (courriel, mot de passe et nom complet obligatoires)
2. Détecter le rôle automatiquement d'après le courriel :
   - `support@vibegay.ca` → rôle `admin`
   - `admin@vibegay.ca` → rôle `co_founder`
   - tout autre → rôle `user`
3. Créer l'utilisateur dans Supabase Auth
4. Créer l'enregistrement dans la base
5. Créer l'enregistrement de billets (sauf pour l'administrateur)
   - `is_co_founder_hidden = true` si cofondateur
   - `monthly_limit = 1000` si cofondateur
6. Créer le profil
7. Envoyer le courriel de vérification
8. Envoyer le courriel de confirmation de rôle (administrateur et cofondateur)

**Réponse** :

```json
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "role": "..." },
  "message": "Compte créé avec le rôle [rôle]. Veuillez vérifier votre courriel."
}
```

### Parcours de connexion

**Point d'entrée** : `POST /auth/login`

**Traitement** :

1. Authentifier auprès de Supabase Auth
2. Mettre à jour l'horodatage `last_login`
3. Retourner le jeton de session et les données du membre

**Réponse** :

```json
{
  "success": true,
  "session": { "access_token": "..." },
  "user": { "id": "uuid", "email": "...", "role": "..." }
}
```

### Vérification du courriel

**Point d'entrée** : `POST /auth/verify-email`

**Traitement** :

1. Passer `is_verified` à `true`
2. Confirmer le courriel auprès de Supabase Auth
3. Mettre à jour l'horodatage `verified_at`

---

## Tableau de bord administrateur

### Adresse : `/admin-dashboard-ui.html`

### Onglet Tableau de bord

- Nombre total de membres
- Nombre de membres vérifiés
- Nombre de membres premium
- Nombre de dossiers du Tribunal ouverts
- Nombre de pubs actives

### Onglet Gestion des membres

- Liste de tous les membres (paginée)
- Recherche et filtrage par courriel
- Changement de rôle (membre → cofondateur → administrateur)
- Suspension d'un membre (retrait de l'accès)

### Onglet Tribunal

- Consultation des dossiers par état (ouvert, en examen, résolu, rejeté)
- Coordonnées du plaignant et du défendeur
- Résolution d'un dossier avec notes explicatives
- Type de dossier et date de création

### Onglet Pubs

- Consultation des pubs en attente
- Approbation d'une pub (passage à l'état actif)
- Rejet d'une pub, avec motif

### Onglet Billets

- Recherche d'un membre par courriel
- Ajustement du solde (en plus ou en moins)
- Motif de l'ajustement
- Création automatique d'un enregistrement de transaction

### Onglet Activité

- Journal d'activité des courriels (7 derniers jours)
- Filtrage par type (vérification, Tribunal, etc.)
- Nombre de courriels envoyés

### Sécurité

- Exige l'en-tête `x-user-role: admin`
- Vérification du rôle à chaque requête
- Réponse 403 si le rôle n'est pas administrateur

---

## Système cofondateur

### Adresse : `/co-founder-dashboard.html`

### Restrictions particulières

1. **Plafond mensuel** : 1 000 billets par mois maximum
2. **Accès discret** : compte invisible du public pendant 6 à 12 mois
3. **Pas d'accès administrateur** : les fonctions du tableau de bord
   administrateur lui sont fermées
4. **Pouvoirs limités** : envoi de billets et création de pubs uniquement

### Fonctionnalités

**Tableau de bord** — taille de la communauté (membres vérifiés), total des
membres, nombre de pubs actives, résumé des restrictions.

**Gestion des billets** — envoi de billets aux membres, application du plafond
de 1 000 par mois, historique des transactions, solde restant.

**Création de pubs** — création pour un salon donné (flottant, voix, fantômes),
définition du coût en billets, soumission à l'approbation de l'administrateur.

### Particularités techniques

**Indicateur `is_co_founder_hidden`** — stocké dans la table `billets`, il
empêche l'affichage public des billets du cofondateur tout en laissant
l'administrateur les voir (via le rôle de service). Mis en œuvre par la sécurité
au niveau des lignes (RLS).

**Réinitialisation mensuelle** — les billets se réinitialisent à minuit UTC au
début de chaque mois, par tâche planifiée ou déclencheur. L'usage est suivi par
l'historique des transactions.

---

## Fonctionnalités membres

**Création de compte** — inscription par courriel et mot de passe, vérification
du courriel obligatoire, profil à compléter, sélection de la région.

**Communication** — accès aux quatre salons (flottant, voix, fantômes,
tribunal), envoi et réception de messages en temps réel, modification de ses
messages, suppression douce (indicateur `is_deleted`).

**Facturation** — réception de billets de la part du cofondateur ou de
l'administrateur, envoi de billets à d'autres membres, ouverture de dossiers au
Tribunal (possiblement au coût de billets).

**Sécurité** — dépôt d'un dossier au Tribunal en cas de harcèlement, blocage
d'un membre, signalement de contenu inapproprié.

**Publicité** — création de pubs soumises à l'approbation de l'administrateur,
payées en billets et ciblées sur un salon précis.

---

## Communication en temps réel

### Le système de salons

Quatre canaux indépendants, aux vocations distinctes.

**1. Flottant** — conversation communautaire générale, sans sujet imposé,
ouverte à tous les membres vérifiés.

**2. Voix** — discussion de sujets sérieux ou importants, annonces
communautaires, modération plus étroite.

**3. Fantômes** — messages privés ou quasi anonymes, faiblement attribués à leur
auteur, effaçables.

**4. Tribunal** — échanges autour des dossiers de modération.

### Mise en œuvre

**Technologie** : canaux Supabase Realtime.

**Code côté client** (`js/salons.js`) :

```javascript
// S'abonner aux messages d'un salon
const subscription = supabase
  .channel(`salons:${salonName}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'salons_messages' },
    (payload) => {
      // Traiter le nouveau message
      renderMessage(payload.new);
    }
  )
  .subscribe();
```

**Structure d'un message** :

```json
{
  "id": "uuid",
  "salon": "flottant",
  "user_id": "uuid-du-membre",
  "texte": "Contenu du message",
  "is_edited": false,
  "is_deleted": false,
  "created_at": "2026-08-27T12:00:00Z"
}
```

### Opérations sur les messages

**Envoyer** :

```javascript
await supabase.from('salons_messages').insert({
  salon: 'flottant',
  user_id: currentUserId,
  texte: 'Texte du message'
});
```

**Modifier** :

```javascript
await supabase.from('salons_messages')
  .update({ texte: 'Texte modifié', is_edited: true })
  .eq('id', messageId);
```

**Supprimer** (suppression douce) :

```javascript
await supabase.from('salons_messages')
  .update({ is_deleted: true })
  .eq('id', messageId);
```

---

## Messagerie privée et traduction automatique

> **Ajout au manuscrit d'origine** — cette section était absente de la version
> anglaise, alors que la fonction est en service dans le site public. Elle est
> documentée ici d'après le code réellement déployé (`index.html`, fonctions
> `ouvrirPrive`, `chargerPrive`, `envoyerPrive`, `envoyerPhotoPrive`).

### Le chuchotement

Dans le salon, le nom de l'auteur de chaque message est cliquable. Un clic ouvre
une conversation privée avec cette personne. C'est le geste central du produit :
on entend l'ambiance de la pièce, puis on prend quelqu'un à part.

**Table** : `messages_prives`

| Champ | Rôle |
|---|---|
| `expediteur` | Identifiant de l'auteur |
| `destinataire` | Identifiant du destinataire |
| `expediteur_pseudo` | Prénom affiché de l'auteur |
| `contenu` | Texte du message |
| `contenu_traduit` | Traduction, si la langue du destinataire diffère |
| `langue_cible` | Langue du destinataire |
| `photo_path` | Chemin de la photo dans le stockage, le cas échéant |
| `created_at` | Horodatage |

**Ouverture d'une conversation** — `ouvrirPrive(uid, nom)` exige une session
active, refuse l'auto-conversation, charge les 80 derniers messages échangés
entre les deux personnes par ordre chronologique, puis ouvre un canal temps réel
`mp_<uid>` filtré sur les seuls messages concernant les deux parties.

### Photos : floutage par défaut

Les photos sont téléversées dans le compartiment de stockage `messages-photos`
et référencées par `photo_path`. Leur affichage obéit à trois règles.

**1. Floutage à l'arrivée.** Une photo reçue s'affiche derrière un flou de 22 px,
recouverte de l'invite « 👁 Maintiens le doigt pour révéler ». Aucune image ne se
dévoile d'elle-même.

**2. Révélation par maintien du doigt.** La photo n'est nette que tant que le
pointeur reste enfoncé. Au relâchement, à la sortie du cadre ou à l'interruption
du geste, le flou revient immédiatement. Il est donc impossible de laisser une
photo explicite affichée à l'écran.

```javascript
const devoiler   = e => { e.preventDefault(); img.style.filter = ''; hint.style.display = 'none'; };
const refloutter = ()  => { img.style.filter = 'blur(22px)'; hint.style.display = 'flex'; };

box.addEventListener('pointerdown',   devoiler);
box.addEventListener('pointerup',     refloutter);
box.addEventListener('pointerleave',  refloutter);
box.addEventListener('pointercancel', refloutter);
box.addEventListener('contextmenu', e => e.preventDefault());
```

**3. Refloutage au passage en arrière-plan.** Dès que la page perd le premier
plan — bascule d'application, changement d'onglet, verrouillage de l'écran —
toutes les photos privées sont refloutées. La plupart des captures et des
enregistrements d'écran passent par cet état.

```javascript
function floutterPhotosPrivees() {
  document.querySelectorAll('#prive-msgs img[data-floutable]').forEach(img => {
    img.style.filter = 'blur(22px)';
    const hint = img.parentElement && img.parentElement.querySelector('.reveal-hint');
    if (hint) hint.style.display = 'flex';
  });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) floutterPhotosPrivees(); });
window.addEventListener('blur', floutterPhotosPrivees);
```

**4. Dévoilement non conservé.** Aucun état n'est enregistré. À la réouverture de
la conversation, `chargerPrive()` reconstruit l'affichage et la photo est de
nouveau floutée.

**5. Lien signé à durée limitée.** Les photos ne sont jamais servies par une
adresse publique. Chaque affichage demande une URL signée valable **une heure**,
après quoi elle expire. Une photo ne peut donc pas circuler hors de la
conversation par simple partage du lien.

```javascript
_supa.storage.from('messages-photos').createSignedUrl(m.photo_path, 3600)
```

**6. Enregistrement local entravé.** `-webkit-touch-callout:none` supprime le
menu « Enregistrer l'image » sur iOS et Android, `contextmenu` est intercepté,
`draggable="false"` et `-webkit-user-drag:none` empêchent le glisser-déposer, et
`user-select:none` bloque la sélection.

### Limite à connaître : les captures d'écran

**Un navigateur web ne peut pas empêcher une capture d'écran.** Aucune API ne
l'autorise, sur aucun site. Les mesures ci-dessus rendent la manœuvre difficile —
il faut maintenir un doigt sur l'image tout en déclenchant la capture, et le
passage au premier plan d'une autre application refloute tout — mais elles ne la
rendent pas impossible.

Le blocage effectif exigerait une application native (`FLAG_SECURE` sur Android).
Aucune communication destinée aux membres ne doit promettre qu'une photo ne peut
pas être capturée.

### Règles d'accès

Deux restrictions sont appliquées par le code, et non seulement par la politique.

**Mode Fantôme** — un membre en Mode Fantôme s'affiche sous la mention
« 👻 Fantôme » plutôt que sous son nom, et son nom n'est pas cliquable : il ne
peut pas être abordé en privé. Il participe sans être sollicitable.

**Verdict du Tribunal** — avant tout envoi, le champ
`profiles.lecture_seule_jusqu` est vérifié. Si la date est encore à venir,
l'envoi est refusé et le membre reçoit la date de fin de sa restriction ainsi
que la marche à suivre pour le pardon (25 $ CAD par virement Interac).

### Traduction automatique

La plateforme prend en charge dix langues. À chaque envoi d'un message privé :

1. La langue du destinataire est obtenue par la fonction
   `obtenir_langue_membre(p_id)`
2. Elle est comparée à la langue de l'expéditeur (`profiles.langue`, `fr` par
   défaut)
3. Si elles diffèrent, la fonction Edge `translate-message` est appelée
4. La traduction est stockée dans `contenu_traduit`, à côté du texte d'origine

```javascript
const { data: langueDest } = await _supa.rpc('obtenir_langue_membre', { p_id: priveAvec });
const mesLangue = monProfil?.langue || 'fr';
langue_cible = langueDest || 'fr';

if (langue_cible && langue_cible !== mesLangue) {
  const { data: tr } = await _supa.functions.invoke('translate-message',
    { body: { texte: txt, langue_cible } });
  if (tr?.traduit) contenu_traduit = tr.traduit;
}
```

**Dégradation contrôlée** — l'appel de traduction est encadré par un `try/catch`
qui n'interrompt rien. Si le service est indisponible, le message part dans sa
langue d'origine. Une panne de traduction n'empêche jamais une conversation
d'avoir lieu.

---

## Système du Tribunal

### Raison d'être

Modération communautaire et règlement des différends, par un processus
transparent de traitement des conflits.

### Types de dossiers

- **Harcèlement** — comportement importun ou menaçant
- **Contenu inapproprié** — manquement aux normes de la communauté
- **Fraude** — escroquerie financière ou sentimentale
- **Autre** — cas divers

### Déroulement d'un dossier

```
1. Un membre ouvre un dossier
   └─ Fournit : défendeur, type, description, liens vers les preuves

2. Le système envoie les avis
   └─ Plaignant : dossier ouvert
   └─ Défendeur : vous faites l'objet d'un signalement
   └─ Administrateur : un dossier demande un examen

3. L'administrateur examine
   └─ Consulte les preuves
   └─ Vérifie l'historique
   └─ Décide

4. L'administrateur tranche
   └─ Fixe l'état de résolution
   └─ Ajoute ses notes
   └─ Ferme le dossier

5. Les deux parties sont avisées
   └─ La résolution leur est communiquée
   └─ Un appel demeure possible
```

### Points d'entrée de l'API

**Ouvrir un dossier** : `POST /auth/tribunal-case`

```json
{
  "complainantId": "uuid",
  "defendantId": "uuid",
  "caseType": "harassment",
  "description": "Description détaillée de l'incident"
}
```

**Résoudre un dossier** : `PUT /admin/tribunal/:caseId/resolve`

```json
{
  "resolution": "Dossier rejeté faute de preuves suffisantes",
  "adminId": "uuid-administrateur"
}
```

**Consulter les dossiers** : `GET /admin/tribunal?status=open`

**Statistiques** : `GET /admin/tribunal/stats`

### Avis par courriel

**À l'ouverture** — envoyé au plaignant et au défendeur, avec le type de dossier,
la description et un lien vers les détails.

**À la résolution** — envoyé aux deux parties, avec la résolution et les notes
sur l'issue.

---

## Facturation et billets

### Le système de billets

Les **billets** sont la monnaie interne de la plateforme.

**Usages** :

1. Créer et diffuser des pubs
2. Accéder à des fonctions premium
3. En envoyer à d'autres membres
4. Récompenser la participation

### Plafonds mensuels

| Rôle | Plafond mensuel | Masqué | Réinitialisation |
|---|---|---|---|
| Administrateur | Illimité | Non | Aucune |
| Cofondateur | 1 000 | Oui | Mensuelle |
| Membre | Variable | Non | Aucune |

### Opérations

**Envoyer des billets** : `POST /auth/send-billets`

```json
{
  "fromUserId": "uuid",
  "toEmail": "membre@exemple.com",
  "amount": 100
}
```

**Ajuster (administrateur)** : `POST /admin/billets/:userId/adjust`

```json
{
  "amount": 50,
  "reason": "Compensation pour un incident"
}
```

### Suivi des transactions

Tout mouvement est consigné dans `billet_transactions` : le type (envoi,
réception, achat, remboursement, ajustement administratif), le lien vers
l'expéditeur et le destinataire, un indicateur de confidentialité pour les
opérations sensibles, et un champ de description.

---

## Système publicitaire

### Vue d'ensemble

Les **pubs** sont des contenus promotionnels que les membres peuvent créer.

### Déroulement

```
1. Un membre crée une pub
   └─ Titre, description, image, lien
   └─ Choix du salon ciblé
   └─ Coût en billets

2. État : en attente
   └─ Transmise à l'administrateur
   └─ Visible dans le tableau de bord du membre

3. L'administrateur approuve ou rejette
   └─ Approbation → état actif, date de début fixée
   └─ Rejet → état rejeté, motif conservé

4. Pubs actives
   └─ Affichées dans le salon ciblé
   └─ Coût déduit des billets du membre
   └─ Diffusion jusqu'à la date de fin

5. Archivage
   └─ Passage à l'état terminé
   └─ Consultable dans l'historique
```

### Structure d'une pub

| Champ | Rôle |
|---|---|
| `title` | Titre de la pub (obligatoire) |
| `description` | Texte descriptif complet |
| `image_url` | Adresse de l'image |
| `link_url` | Destination du lien |
| `salon` | Salon ciblé (flottant, voix, fantomes) |
| `billets_cost` | Coût de diffusion (100 par défaut) |
| `status` | État courant |

### Points d'entrée de l'API

**Pubs à approuver** : `GET /admin/pubs`

**Approuver** : `PUT /admin/pubs/:pubId/approve` — passe l'état à actif,
inscrit l'administrateur approbateur et fixe la date de début.

**Rejeter** : `PUT /admin/pubs/:pubId/reject`

```json
{ "reason": "Contenu inapproprié" }
```

---

## Système de courriels

> **Mise à jour** — cette section décrit la configuration Gmail SMTP d'origine.
> La plateforme utilise désormais **Resend**, avec le domaine vibegay.ca vérifié
> pour l'envoi. La variable d'environnement est `RESEND_API_KEY`, et l'adresse
> d'expédition `CONTACT_FROM_EMAIL`. Les types de courriels et les modèles
> décrits ci-dessous demeurent valides.

### Configuration d'origine

**Fournisseur** : Gmail SMTP
**Transport** : nodemailer
**Variables d'environnement** : `EMAIL_USER`, `EMAIL_PASSWORD` (mot de passe
d'application, jamais le mot de passe du compte)

### Types de courriels

1. **Courriel de vérification** — envoyé à l'inscription, contient le lien de
   vérification sur lequel le membre doit cliquer.

2. **Confirmation de rôle** — réservé à l'administrateur et au cofondateur.
   Explique le rôle et les pouvoirs, inclut le lien vers le tableau de bord, et
   comporte un message particulier sur l'accès discret du cofondateur.

3. **Avis du Tribunal** — envoyé à l'ouverture et à la résolution d'un dossier,
   avec les détails et les liens d'action.

4. **Approbation de pub** — envoyé quand une pub est approuvée, avec ses détails
   et sa date de mise en ligne.

5. **Avis de billets** (facultatif) — quand un membre reçoit des billets, avec
   le montant et l'expéditeur.

### Modèles

Tous les courriels utilisent des modèles HTML : style glassmorphisme, rappel des
valeurs de la communauté, pied de page « Avec Humilité et Respect », conception
adaptative, et identité visuelle VIBE (or `#D4AF37`).

### Fonctions d'envoi

`sendVerificationEmail(email, authId)`, `sendRoleConfirmation(email, role)`,
`sendTribunalNotification(email, caseInfo)`.

Toutes consignent l'envoi dans `email_logs`, interceptent et journalisent les
erreurs, et ne lèvent jamais d'erreur fatale.

---

## Référence de l'API

### Routes d'authentification

#### `POST /auth/signup`

Crée un compte, avec détection automatique du rôle.

**En-têtes** : `Content-Type: application/json`

**Corps** :

```json
{
  "email": "membre@exemple.com",
  "password": "MotDePasseSolide123",
  "fullName": "Nom du membre",
  "region": "Gaspésie"
}
```

#### `POST /auth/login`

Authentifie un membre et retourne une session.

#### `POST /auth/verify-email`

Vérifie l'adresse courriel d'un membre.

#### `POST /auth/send-billets`

Envoie des billets à un autre membre. Réservé au cofondateur et à
l'administrateur.

**En-têtes** : `x-user-role: co_founder|admin`

**Validation** : cofondateur, 1 000 maximum par mois ; administrateur, illimité.

#### `POST /auth/tribunal-case`

Ouvre un dossier au Tribunal.

```json
{
  "complainantId": "uuid",
  "defendantId": "uuid",
  "caseType": "harassment|inappropriate_content|scam|other",
  "description": "Description détaillée de l'incident"
}
```

### Routes administrateur

Toutes exigent l'en-tête `x-user-role: admin`.

| Route | Fonction |
|---|---|
| `GET /admin/stats` | Statistiques du tableau de bord |
| `GET /admin/users` | Liste paginée des membres (`page`, `limit`) |
| `PUT /admin/users/:userId/role` | Changer le rôle d'un membre |
| `POST /admin/users/:userId/suspend` | Suspendre un compte, avec motif |
| `GET /admin/tribunal` | Dossiers, filtrables par `status` |
| `PUT /admin/tribunal/:caseId/resolve` | Résoudre un dossier |
| `GET /admin/tribunal/stats` | Statistiques du Tribunal |
| `GET /admin/pubs` | Pubs en attente d'approbation |
| `PUT /admin/pubs/:pubId/approve` | Approuver une pub |
| `PUT /admin/pubs/:pubId/reject` | Rejeter une pub, avec motif |
| `POST /admin/billets/:userId/adjust` | Ajuster le solde d'un membre |
| `GET /admin/activity` | Journal des courriels (`days`) |

**Exemple — `GET /admin/stats`** :

```json
{
  "totalUsers": 150,
  "verifiedUsers": 120,
  "premiumUsers": 30,
  "openTribunalCases": 2,
  "activePubs": 5
}
```

---

## Sécurité

### Authentification et autorisation

**Supabase Auth** — inscription par courriel et mot de passe, jetons JWT pour
les sessions, rôle de service pour les opérations administratives, vérification
du rôle administrateur sur toutes les routes concernées.

**Sécurité au niveau des lignes (RLS)** :

- Membres : chacun voit son profil ; l'administrateur voit tout
- Billets : masqués aux tiers, sauf pour l'administrateur
- Billets du cofondateur : masqués aux non-administrateurs quand
  `is_co_founder_hidden = true`
- Tribunal : les dossiers rejetés sont invisibles aux non-administrateurs

### Protection des données

**Variables d'environnement** — `SUPABASE_SERVICE_ROLE_KEY` n'est jamais exposée
au client ; le mot de passe de messagerie est un mot de passe d'application ;
`STRIPE_WEBHOOK_SECRET` sert à la vérification HMAC.

**Vérification des webhooks Stripe** — signature HMAC-SHA256, comparaison à
temps constant, corps brut obligatoire (jamais analysé en JSON au préalable).

**Mots de passe** — six caractères minimum, stockés de façon sécurisée par
Supabase Auth, jamais journalisés ni exposés.

### Sécurité de la base de données

**Contraintes** — unicité sur `email`, `auth_id` et `stripe_customer_id` ;
unicité du couple (bloqueur, bloqué) ; unicité du couple (dossier, votant) ;
contraintes de validation sur les champs à valeurs contrôlées.

**Index** — sur les champs fréquemment interrogés (courriel, rôle, état), sur
les champs de jointure (clés étrangères) et sur les champs temporels.

**Déclencheurs** — mise à jour automatique de `updated_at` à chaque
modification, ce qui empêche toute falsification manuelle des horodatages.

### Sécurité côté client

**LocalStorage** — conserve le jeton d'authentification, l'identifiant, le
courriel et le rôle. Vidé à la déconnexion. Aucune donnée sensible n'y est
stockée.

**HTTPS** en production — TLS imposé sur tout le trafic, témoins sécurisés,
en-têtes HSTS.

---

## Déploiement

> **Mise à jour** — la plateforme est déployée sur **Vercel**, à vibegay.ca, et
> non sur Heroku. Les instructions Heroku ci-dessous sont conservées à titre de
> référence. Sur Vercel, les variables d'environnement se règlent dans
> Réglages → Environment Variables, et **un redéploiement manuel est nécessaire**
> après toute modification : elles ne sont pas prises en compte automatiquement.

### L'adresse du site

Le site en service est à **https://www.vibegay.ca**

C'est la seule adresse à utiliser pour consulter la plateforme, depuis
n'importe quel appareil.

> ⚠️ **`localhost` n'est pas une adresse de site.** Le mot signifie « cet
> appareil-ci ». Ouvrir `localhost:3000` dans un navigateur ne donnera jamais
> accès à VIBE : le navigateur cherche un serveur sur la machine où il tourne, et
> répond `ERR_CONNECTION_REFUSED` s'il n'y en a pas.
>
> Les adresses `localhost` de la section suivante ne servent qu'à un développeur
> qui exécute le code sur son propre ordinateur. **Elles ne sont pas cliquables
> utilement.**

### Développement local — réservé aux développeurs

Cette procédure ne concerne que quelqu'un qui installe le code sur sa machine.
Elle n'est d'aucune utilité pour consulter le site.

```bash
# 1. Préparer l'environnement
cp .env.example .env
# Renseigner les identifiants Supabase, courriel et paiement

# 2. Installer les dépendances
npm install

# 3. Appliquer le schéma de base de données
# Par le tableau de bord Supabase, ou : psql < sql/complete-schema.sql

# 4. Créer les comptes administrateurs (facultatif)
node setup-admins.js

# 5. Démarrer le serveur
node server.js

# 6. Ouvrir la page de connexion servie par CE serveur local :
#    localhost:3000/login.html
#    (adresse valable uniquement sur la machine qui exécute la commande ci-dessus)
```

### Déploiement en production (Heroku — référence historique)

```bash
heroku create vibe-platform
heroku addons:create heroku-postgresql:standard-0
heroku config:set SUPABASE_URL=...
heroku config:set SUPABASE_SERVICE_ROLE_KEY=...
git push heroku main
heroku logs --tail
```

### Migrations de base de données

```bash
# 1. Tester la migration en local
psql < sql/complete-schema.sql

# 2. Sauvegarder la base de production avant d'appliquer
# Tableau de bord Supabase → Database → Backups

# 3. Appliquer dans l'éditeur SQL de Supabase

# 4. Vérifier que toutes les tables sont créées
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

### Supervision

**Contrôle de santé** : `GET /health` — retourne l'état, l'horodatage et la
présence de chaque variable de configuration, sous forme de booléens et sans
jamais exposer de valeur.

**Journalisation des erreurs** — toutes les erreurs sont journalisées et
consultables dans le tableau de bord de l'hébergeur.

**Performance** — temps de réponse de l'API, requêtes de base de données via le
tableau de bord Supabase, connexions temps réel via Supabase Realtime.

---

## Synthèse

VIBE est une plateforme complète, prête pour la production, qui réunit en un
seul système le clavardage communautaire, la modération, la publicité et la
facturation — conçue avec humilité et respect pour la communauté LGBTQ+.

**Composants livrés** :

- ✅ Schéma de base de données complet, dix tables
- ✅ Authentification par rôle (administrateur, cofondateur, membre)
- ✅ Clavardage en temps réel dans quatre salons
- ✅ Système de modération par Tribunal
- ✅ Chaîne de traitement des publicités
- ✅ Monnaie interne en billets, avec plafonds mensuels
- ✅ Tableau de bord administrateur complet
- ✅ Tableau de bord cofondateur, avec restrictions particulières
- ✅ Automatisation des courriels
- ⚠️ Paiements — **hors service**, compte Stripe fermé le 17 août 2026.
  Les adhésions passent par virement Interac.

**Particularités** :

- Accès discret du cofondateur (6 à 12 mois)
- 1 000 billets par mois pour le cofondateur
- Lien direct entre l'administrateur et le cofondateur
- Interface au design glassmorphisme
- Mises à jour en temps réel par Supabase
- Avis par courriel sur l'ensemble du parcours

**Sécurité** :

- Supabase Auth et sécurité au niveau des lignes
- Vérification HMAC-SHA256 des webhooks
- Protection par variables d'environnement
- Contraintes et index en base de données
- Gestion des jetons de session

**Prêt pour** :

- Le développement local
- Le déploiement en production
- Une montée en charge au-delà de 10 000 membres
- Une exploitation continue

---

**Version de la plateforme** : 1.0.0
**Rédigé le** : 27 août 2026 · **Traduit et mis à jour le** : 28 août 2026

**Philosophie** : « Avec Humilité et Respect » 🌊
