-- VIBE Complete Platform Schema v1.0
-- Production-Ready Database with Auth, Roles, Billets, Tribunal
-- Created: 2026-08-27

-- ═════════════════════════════════════════════════════════════════
-- 1. USERS TABLE (Auth + Roles)
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_role ON users(role);

-- ═════════════════════════════════════════════════════════════════
-- 2. BILLETS SYSTEM (Credits/Tokens)
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_billets_user_id ON billets(user_id);
CREATE INDEX idx_billets_balance ON billets(balance);

-- ═════════════════════════════════════════════════════════════════
-- 3. BILLETS TRANSACTIONS LOG
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_transactions_user_id ON billet_transactions(user_id);
CREATE INDEX idx_transactions_type ON billet_transactions(transaction_type);

-- ═════════════════════════════════════════════════════════════════
-- 4. TRIBUNAL SALON (Moderation)
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_tribunal_complainant ON tribunal_cases(complainant_id);
CREATE INDEX idx_tribunal_defendant ON tribunal_cases(defendant_id);
CREATE INDEX idx_tribunal_status ON tribunal_cases(status);
CREATE INDEX idx_tribunal_admin ON tribunal_cases(assigned_admin_id);

-- ═════════════════════════════════════════════════════════════════
-- 5. TRIBUNAL VOTES (Community Voting)
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tribunal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT CHECK(vote IN ('support_complainant', 'support_defendant', 'abstain')),
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(case_id, voter_id)
);

CREATE INDEX idx_votes_case_id ON tribunal_votes(case_id);

-- ═════════════════════════════════════════════════════════════════
-- 6. SALONS MESSAGES (Real-time Chat)
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_salon_messages ON salons_messages(salon, created_at DESC);
CREATE INDEX idx_salon_user ON salons_messages(user_id);

-- ═════════════════════════════════════════════════════════════════
-- 7. PUBS SYSTEM (Advertising)
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_pubs_user ON pubs(user_id);
CREATE INDEX idx_pubs_status ON pubs(status);

-- ═════════════════════════════════════════════════════════════════
-- 8. USER PROFILES
-- ═════════════════════════════════════════════════════════════════

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

-- ═════════════════════════════════════════════════════════════════
-- 9. EMAIL LOGS
-- ═════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_emails_recipient ON email_logs(recipient_email);
CREATE INDEX idx_emails_user ON email_logs(user_id);

-- ═════════════════════════════════════════════════════════════════
-- 10. BLOCKED USERS
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- ═════════════════════════════════════════════════════════════════
-- 11. ROW LEVEL SECURITY (RLS)
-- ═════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE billets ENABLE ROW LEVEL SECURITY;
ALTER TABLE billet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tribunal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tribunal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users: Own profile visible, admin sees all
CREATE POLICY "Users can see own profile" ON users FOR SELECT
  TO authenticated USING (auth_id = auth.uid()::text OR auth.jwt()->>'role' = 'admin');

-- Billets: Hidden from non-admins if co_founder_hidden
CREATE POLICY "View billets" ON billets FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()::uuid OR
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->>'role' = 'co_founder' AND is_co_founder_hidden = false)
  );

-- Tribunal: Everyone sees cases (except dismissed ones for non-admins)
CREATE POLICY "View tribunal cases" ON tribunal_cases FOR SELECT
  TO authenticated USING (status != 'dismissed' OR auth.jwt()->>'role' = 'admin');

-- ═════════════════════════════════════════════════════════════════
-- 12. REALTIME SETUP
-- ═════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE salons_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tribunal_cases;

-- ═════════════════════════════════════════════════════════════════
-- 13. TRIGGERS FOR TIMESTAMPS
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER billets_updated_at BEFORE UPDATE ON billets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tribunal_updated_at BEFORE UPDATE ON tribunal_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pubs_updated_at BEFORE UPDATE ON pubs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═════════════════════════════════════════════════════════════════
-- 14. INITIAL DATA (Admin Users)
-- ═════════════════════════════════════════════════════════════════

-- This will be populated via backend signup flow
-- But structure is ready for immediate use
