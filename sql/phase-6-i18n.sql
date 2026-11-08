-- ═══════════════════════════════════════════════════════════════
-- VIBE Phase 6 Bonus — i18n (Internationalization) & Translation
-- Multi-language support for LGBTQ+ global community
-- ═══════════════════════════════════════════════════════════════

-- Table: user_language_preferences
CREATE TABLE IF NOT EXISTS user_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  primary_language TEXT NOT NULL DEFAULT 'en',  -- User's native language
  interface_language TEXT NOT NULL DEFAULT 'en',  -- UI language
  auto_translate BOOLEAN DEFAULT false,  -- Auto-translate messages in chat
  translate_to_languages TEXT[] DEFAULT ARRAY[]::TEXT[],  -- Languages to auto-translate to
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_language_preferences_user_id
  ON user_language_preferences(user_id);

-- RLS
ALTER TABLE user_language_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read/update own language preferences"
  ON user_language_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Table: message_translations
-- Store translated versions of salon messages
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),  -- User who requested translation
  source_language TEXT NOT NULL DEFAULT 'auto',
  target_language TEXT NOT NULL,
  original_content TEXT NOT NULL,
  translated_content TEXT NOT NULL,
  provider TEXT DEFAULT 'libretranslate',  -- Which translation service was used
  confidence_score FLOAT,  -- Translation quality (0.0-1.0)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_translations_message_id
  ON message_translations(message_id);

CREATE INDEX IF NOT EXISTS idx_message_translations_user_id
  ON message_translations(user_id);

CREATE INDEX IF NOT EXISTS idx_message_translations_languages
  ON message_translations(source_language, target_language);

-- RLS
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read message translations"
  ON message_translations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own translations"
  ON message_translations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Table: salon_translations
-- Translated salon names and descriptions
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS salon_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(salon_id, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salon_translations_salon_id
  ON salon_translations(salon_id);

CREATE INDEX IF NOT EXISTS idx_salon_translations_language
  ON salon_translations(language);

-- ─────────────────────────────────────────────────────────────
-- Table: translation_cache
-- Cache frequently translated phrases (performance optimization)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'auto',
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider TEXT DEFAULT 'libretranslate',
  hit_count INT DEFAULT 0,  -- How many times this translation was used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(source_text, source_language, target_language, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_translation_cache_languages
  ON translation_cache(source_language, target_language);

CREATE INDEX IF NOT EXISTS idx_translation_cache_hit_count
  ON translation_cache(hit_count DESC);

-- ─────────────────────────────────────────────────────────────
-- Table: language_detection_log
-- Log language detection for analytics
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS language_detection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  content TEXT,
  detected_language TEXT,
  confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_language_detection_user_id
  ON language_detection_log(user_id);

CREATE INDEX IF NOT EXISTS idx_language_detection_detected_language
  ON language_detection_log(detected_language);

-- ─────────────────────────────────────────────────────────────
-- Table: translation_statistics
-- Analytics on translation usage
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS translation_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translation_count INT DEFAULT 0,
  avg_confidence FLOAT,
  provider TEXT DEFAULT 'libretranslate',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(date, source_language, target_language, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_translation_statistics_date
  ON translation_statistics(date DESC);

CREATE INDEX IF NOT EXISTS idx_translation_statistics_languages
  ON translation_statistics(source_language, target_language);

-- ─────────────────────────────────────────────────────────────
-- Auto-update triggers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_language_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_language_preferences_updated_at_trigger
BEFORE UPDATE ON user_language_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_language_preferences_updated_at();

CREATE OR REPLACE FUNCTION update_translation_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.hit_count = NEW.hit_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_cache_updated_at_trigger
BEFORE UPDATE ON translation_cache
FOR EACH ROW
EXECUTE FUNCTION update_translation_cache_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Views for analytics
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW user_multilingual_stats AS
SELECT
  u.id as user_id,
  u.full_name,
  ulp.primary_language,
  ulp.interface_language,
  ulp.auto_translate,
  COUNT(DISTINCT mt.id) as translations_requested,
  COUNT(DISTINCT mt.target_language) as languages_translated_to,
  MAX(mt.created_at) as last_translation_at
FROM users u
LEFT JOIN user_language_preferences ulp ON u.id = ulp.user_id
LEFT JOIN message_translations mt ON u.id = mt.user_id
GROUP BY u.id, u.full_name, ulp.primary_language, ulp.interface_language, ulp.auto_translate;

CREATE OR REPLACE VIEW translation_popularity AS
SELECT
  source_language,
  target_language,
  COUNT(*) as total_translations,
  AVG(confidence_score) as avg_confidence,
  MAX(created_at) as last_used
FROM message_translations
GROUP BY source_language, target_language
ORDER BY total_translations DESC;

CREATE OR REPLACE VIEW multilingual_salons AS
SELECT
  s.id as salon_id,
  s.name as salon_name,
  s.language as primary_language,
  COUNT(DISTINCT st.language) as translated_languages,
  COUNT(DISTINCT st.id) as total_translations,
  STRING_AGG(DISTINCT st.language, ', ') as available_languages
FROM salons s
LEFT JOIN salon_translations st ON s.id = st.salon_id
GROUP BY s.id, s.name, s.language;

CREATE OR REPLACE VIEW translation_cache_performance AS
SELECT
  provider,
  COUNT(*) as cached_phrases,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_phrase,
  MAX(hit_count) as max_hits,
  ROUND(SUM(hit_count) * 100.0 / NULLIF(
    (SELECT SUM(hit_count) FROM translation_cache),
    0
  ), 2) as percentage_of_total_hits
FROM translation_cache
GROUP BY provider;
