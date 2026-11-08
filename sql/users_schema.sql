-- VIBE Users v1 — Stripe Integration
-- Copie-colle ce script ENTIÈREMENT dans Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- TABLE: users
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  role TEXT DEFAULT 'basic' CHECK(role IN ('basic', 'premium', 'founder')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ─ Indexes ─
CREATE INDEX IF NOT EXISTS idx_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customer_id_not_null
  ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_role ON users(role);

-- ═══════════════════════════════════════════════════════════════
-- RLS: Row Level Security
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own profile
CREATE POLICY "Lire son profil"
ON users FOR SELECT
TO authenticated
USING (auth_id = auth.uid()::text);

-- Policy 2: Users cannot update their own profile (only backend can via webhook)
CREATE POLICY "Pas d'auto-modification"
ON users FOR UPDATE
TO authenticated
USING (false);

-- Policy 3: Service role (backend) can do everything
-- (This assumes your backend connects with service_role key)
-- No policy needed for service_role — it bypasses RLS by default

-- Policy 4: Anonymous can read public profiles (optional, for discovery)
-- CREATE POLICY "Lecture publique (anon)"
-- ON users FOR SELECT
-- TO anon
-- USING (true);  -- Uncomment if needed for discovery

-- ═══════════════════════════════════════════════════════════════
-- Trigger: Auto-update updated_at on modify
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
