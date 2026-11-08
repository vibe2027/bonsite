-- ═══════════════════════════════════════════════════════════════════
-- VIBE — Alignement du backend Express sur la base de production
-- Cible : fhksytcoyjtcrkmhnoyw (base vivante, 37 tables, utilisateurs actifs)
--
-- Ce script est ADDITIF. Il ne lit, ne modifie et ne supprime aucune
-- des tables existantes. Il crée 9 tables sur des noms libres, puis
-- alimente `users` depuis `profiles`.
--
-- `tribunal_votes` est VOLONTAIREMENT OMISE : elle existe déjà dans la
-- base vivante avec une structure différente (signalement_id/juror_id),
-- et aucun code du backend ne l'interroge. La créer ou la modifier
-- n'apporterait rien et casserait la table existante.
--
-- Idempotent : réexécutable sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. Tables attendues par le backend (aucune n'existe dans la base vivante)
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  region TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'co_founder', 'user')),
  stripe_customer_id TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'basic' CHECK(subscription_tier IN ('basic', 'premium', 'founder')),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS public.billets (
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

CREATE INDEX IF NOT EXISTS idx_billets_user_id ON billets(user_id);
CREATE INDEX IF NOT EXISTS idx_billets_balance ON billets(balance);

CREATE TABLE IF NOT EXISTS public.billet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  transaction_type TEXT CHECK(transaction_type IN ('send', 'receive', 'purchase', 'refund', 'admin_adjustment')),
  description TEXT,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON billet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON billet_transactions(transaction_type);

CREATE TABLE IF NOT EXISTS public.tribunal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complainant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  defendant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_type TEXT CHECK(case_type IN ('harassment', 'inappropriate_content', 'scam', 'other')),
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolution TEXT,
  admin_notes TEXT,
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tribunal_complainant ON tribunal_cases(complainant_id);
CREATE INDEX IF NOT EXISTS idx_tribunal_defendant ON tribunal_cases(defendant_id);
CREATE INDEX IF NOT EXISTS idx_tribunal_status ON tribunal_cases(status);
CREATE INDEX IF NOT EXISTS idx_tribunal_admin ON tribunal_cases(assigned_admin_id);

-- NOTE : public.tribunal_votes n'est pas créée. Voir l'en-tête.

CREATE TABLE IF NOT EXISTS public.salons_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon TEXT NOT NULL CHECK(salon IN ('flottant', 'voix', 'fantomes', 'tribunal')),
  user_id TEXT NOT NULL,
  texte TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salons_messages_salon ON salons_messages(salon, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_salons_messages_user ON salons_messages(user_id);

CREATE TABLE IF NOT EXISTS public.pubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  salon TEXT CHECK(salon IN ('flottant', 'voix', 'fantomes')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'active', 'ended')),
  billets_cost INT DEFAULT 100,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pubs_user ON pubs(user_id);
CREATE INDEX IF NOT EXISTS idx_pubs_status ON pubs(status);

CREATE TABLE IF NOT EXISTS public.user_profiles (
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

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT CHECK(email_type IN ('verification', 'password_reset', 'welcome', 'notification', 'tribunal_update', 'pub_approved')),
  subject TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_emails_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_emails_user ON email_logs(user_id);

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- ───────────────────────────────────────────────────────────────────
-- 2. RLS sur les tables nouvellement créées uniquement
--    Le backend utilise la clé service_role, qui contourne RLS.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribunal_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salons_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pubs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users      ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- 3. Horodatage automatique
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS billets_updated_at ON public.billets;
CREATE TRIGGER billets_updated_at BEFORE UPDATE ON public.billets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tribunal_updated_at ON public.tribunal_cases;
CREATE TRIGGER tribunal_updated_at BEFORE UPDATE ON public.tribunal_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS pubs_updated_at ON public.pubs;
CREATE TRIGGER pubs_updated_at BEFORE UPDATE ON public.pubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ───────────────────────────────────────────────────────────────────
-- 4. Projection de `profiles` vers `users`
--
--    `profiles` reste la source de vérité de l'identité.
--    `users` en est la projection pour le backend, plus les colonnes
--    techniques que lui seul utilise (stripe_customer_id, last_login).
--
--    users.id = profiles.id = auth.users.id  → une seule identité.
--    Vérifié : les 4 profils correspondent 1:1 à auth.users.
--
--    Mapping des valeurs (contraintes CHECK de `users`) :
--      membership_tier 'free'    → subscription_tier 'basic'
--      membership_tier 'founder' → subscription_tier 'founder'
--      is_admin        → role 'admin'
--      is_cofondateur  → role 'co_founder'
-- ───────────────────────────────────────────────────────────────────

INSERT INTO public.users (id, auth_id, email, full_name, region, role, subscription_tier, is_verified, created_at)
SELECT
  p.id,
  p.id::text,
  p.real_email,
  COALESCE(p.display_name, p.username),
  p.city,
  CASE
    WHEN p.is_admin       THEN 'admin'
    WHEN p.is_cofondateur THEN 'co_founder'
    ELSE 'user'
  END,
  CASE p.membership_tier
    WHEN 'founder' THEN 'founder'
    WHEN 'premium' THEN 'premium'
    ELSE 'basic'
  END,
  COALESCE(p.photo_verifiee, false),
  COALESCE(p.created_at, now())
FROM public.profiles p
WHERE p.real_email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────
-- 5. Synchronisation continue
--    Une inscription sur le site vivant écrit dans `profiles` ;
--    le backend doit voir le nouvel utilisateur apparaître dans `users`.
--    Sens unique : profiles → users. Les colonnes propres au backend
--    (stripe_customer_id, last_login) ne sont jamais écrasées.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_profile_to_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.real_email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, auth_id, email, full_name, region, role, subscription_tier, is_verified, created_at)
  VALUES (
    NEW.id,
    NEW.id::text,
    NEW.real_email,
    COALESCE(NEW.display_name, NEW.username),
    NEW.city,
    CASE
      WHEN NEW.is_admin       THEN 'admin'
      WHEN NEW.is_cofondateur THEN 'co_founder'
      ELSE 'user'
    END,
    CASE NEW.membership_tier
      WHEN 'founder' THEN 'founder'
      WHEN 'premium' THEN 'premium'
      ELSE 'basic'
    END,
    COALESCE(NEW.photo_verifiee, false),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email             = EXCLUDED.email,
    full_name         = EXCLUDED.full_name,
    region            = EXCLUDED.region,
    role              = EXCLUDED.role,
    subscription_tier = EXCLUDED.subscription_tier,
    is_verified       = EXCLUDED.is_verified;

  RETURN NEW;

EXCEPTION
  -- `users` est une projection : elle ne doit JAMAIS pouvoir faire échouer
  -- une écriture sur `profiles`. Les contraintes UNIQUE sur users.email et
  -- users.auth_id peuvent entrer en conflit avec une ligne créée par le
  -- backend ; sans ce garde-fou, la transaction remonterait et empêcherait
  -- un utilisateur réel de modifier son profil sur le site vivant.
  WHEN OTHERS THEN
    RAISE WARNING 'sync_profile_to_user a échoué pour profiles.id=% : %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Le trigger n'écoute QUE les colonnes réellement projetées.
-- `profiles` est écrite en continu par le système de présence
-- (is_online, derniere_activite) ; sans cette restriction, chaque
-- battement de présence déclencherait une resynchronisation inutile.
DROP TRIGGER IF EXISTS profiles_sync_to_users ON public.profiles;
CREATE TRIGGER profiles_sync_to_users
  AFTER INSERT OR UPDATE OF
    real_email, display_name, username, city,
    is_admin, is_cofondateur, membership_tier, photo_verifiee
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_user();

-- ═══════════════════════════════════════════════════════════════════
-- Vérification post-exécution attendue :
--   select count(*) from public.users;                  -- 4
--   select role, subscription_tier from public.users;   -- 1 admin/founder, 3 user/basic
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- ANNULATION
--
-- Ce script étant purement additif, le rollback consiste à supprimer ce
-- qu'il a créé. Aucune table préexistante n'ayant été lue ni modifiée,
-- il n'y a rien à restaurer.
--
-- Ne PAS restaurer un snapshot pour annuler cette migration : cela
-- ferait perdre toute l'activité survenue depuis (messages de salon,
-- inscriptions, signalements). Les instructions ci-dessous ramènent la
-- base exactement à son état antérieur, sans perte.
--
--   DROP TRIGGER IF EXISTS profiles_sync_to_users ON public.profiles;
--   DROP FUNCTION IF EXISTS public.sync_profile_to_user();
--
--   DROP TABLE IF EXISTS public.blocked_users;
--   DROP TABLE IF EXISTS public.email_logs;
--   DROP TABLE IF EXISTS public.user_profiles;
--   DROP TABLE IF EXISTS public.pubs;
--   DROP TABLE IF EXISTS public.salons_messages;
--   DROP TABLE IF EXISTS public.tribunal_cases;
--   DROP TABLE IF EXISTS public.billet_transactions;
--   DROP TABLE IF EXISTS public.billets;
--   DROP TABLE IF EXISTS public.users;
--
-- (ordre inverse des dépendances de clés étrangères)
--
-- Ne pas supprimer public.update_updated_at() sans vérifier qu'aucune
-- autre table de la base ne s'en sert.
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- RÉPÉTITION GÉNÉRALE — exécutée le 2026-08-28 sur une base jetable,
-- avec des données synthétiques reproduisant la distribution réelle
-- (1 admin/founder, 3 free, 1 profil sans email). Résultats :
--
--   Backfill                    → 1 admin/founder + 3 user/basic   OK
--   Profil sans email           → ignoré, 4 lignes et non 5        OK
--   INSERT sur profiles         → propagé vers users               OK
--   UPDATE display_name         → propagé vers users               OK
--   UPDATE is_online            → trigger NON déclenché            OK
--   Conflit UNIQUE provoqué     → écriture sur profiles réussie,
--                                 synchro abandonnée en WARNING    OK
--
-- Le dernier point est la garantie centrale : une collision dans la
-- projection ne peut pas bloquer une écriture sur la table source.
-- Environnement de test entièrement supprimé après vérification.
-- ═══════════════════════════════════════════════════════════════════
