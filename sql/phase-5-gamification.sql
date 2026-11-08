-- ═══════════════════════════════════════════════════════════════
-- VIBE Phase 5.4 — Gamification & Reputation Schema
-- ═══════════════════════════════════════════════════════════════

-- Table: user_points
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  month TEXT NOT NULL, -- Format: YYYY-MM
  breakdown JSONB DEFAULT '{
    "messages": 0,
    "helpful_moderator": 0,
    "pubs_created": 0,
    "community_help": 0,
    "other": 0
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user_id
  ON user_points(user_id);

CREATE INDEX IF NOT EXISTS idx_user_points_month
  ON user_points(month);

-- RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own points"
  ON user_points FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Table: user_achievements
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT,
  rarity TEXT CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  points_reward INT DEFAULT 0,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON user_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id
  ON user_achievements(achievement_id);

-- RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- Table: user_reputation
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  level TEXT DEFAULT 'novice' CHECK(level IN (
    'novice',
    'member',
    'trusted',
    'community_helper',
    'elder',
    'legend'
  )),
  verified BOOLEAN DEFAULT false,
  helpful_votes INT DEFAULT 0,
  reported_for_abuse INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_reputation_score
  ON user_reputation(score DESC);

CREATE INDEX IF NOT EXISTS idx_user_reputation_level
  ON user_reputation(level);

-- RLS
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reputation"
  ON user_reputation FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own reputation"
  ON user_reputation FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Table: leaderboards (cached view)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type TEXT NOT NULL CHECK(leaderboard_type IN (
    'global_points',
    'monthly_points',
    'salon_flottant',
    'salon_voix',
    'salon_fantomes',
    'reputation',
    'helpful_moderators'
  )),
  rank INT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL,
  period TEXT, -- For monthly: YYYY-MM
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leaderboards_type_rank
  ON leaderboards(leaderboard_type, rank);

CREATE INDEX IF NOT EXISTS idx_leaderboards_user_id
  ON leaderboards(user_id);

-- ─────────────────────────────────────────────────────────────
-- Table: point_transactions (audit trail)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN (
    'message_sent',
    'helpful_vote',
    'moderator_action',
    'achievement_unlocked',
    'monthly_reset',
    'admin_adjustment',
    'challenge_completed'
  )),
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id
  ON point_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_point_transactions_reason
  ON point_transactions(reason);

-- ─────────────────────────────────────────────────────────────
-- Auto-update triggers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_points_updated_at_trigger
BEFORE UPDATE ON user_points
FOR EACH ROW
EXECUTE FUNCTION update_user_points_updated_at();

CREATE OR REPLACE FUNCTION update_user_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_reputation_updated_at_trigger
BEFORE UPDATE ON user_reputation
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Views for Gamification
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW user_gamification_stats AS
SELECT
  u.id as user_id,
  u.full_name,
  COALESCE(ur.score, 0) as reputation_score,
  ur.level as reputation_level,
  COALESCE(up.points, 0) as current_month_points,
  COUNT(DISTINCT ua.achievement_id) as total_achievements,
  COUNT(DISTINCT ua.achievement_id) FILTER (WHERE ua.rarity = 'legendary') as legendary_count,
  MAX(ua.unlocked_at) as last_achievement_unlocked_at
FROM users u
LEFT JOIN user_reputation ur ON u.id = ur.user_id
LEFT JOIN user_points up ON u.id = up.user_id AND up.month = TO_CHAR(now(), 'YYYY-MM')
LEFT JOIN user_achievements ua ON u.id = ua.user_id
GROUP BY u.id, u.full_name, ur.score, ur.level, up.points;

CREATE OR REPLACE VIEW monthly_leaderboard AS
SELECT
  ROW_NUMBER() OVER (ORDER BY up.points DESC) as rank,
  up.user_id,
  u.full_name,
  up.points,
  COUNT(DISTINCT ua.achievement_id) as achievements
FROM user_points up
JOIN users u ON up.user_id = u.id
LEFT JOIN user_achievements ua ON u.id = ua.user_id
WHERE up.month = TO_CHAR(now(), 'YYYY-MM')
GROUP BY up.user_id, u.full_name, up.points
LIMIT 100;

CREATE OR REPLACE VIEW global_reputation_leaderboard AS
SELECT
  ROW_NUMBER() OVER (ORDER BY ur.score DESC) as rank,
  ur.user_id,
  u.full_name,
  ur.score,
  ur.level,
  ur.verified
FROM user_reputation ur
JOIN users u ON ur.user_id = u.id
WHERE ur.score > 0
ORDER BY ur.score DESC
LIMIT 100;
