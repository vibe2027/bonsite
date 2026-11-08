-- ========================================
-- PHASE 6 Database Migrations
-- Real-time Collaboration, Search, Recommendations, WebRTC, Moderation
-- ========================================

-- 1. REALTIME COLLABORATION TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS operation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL,
  operation_type VARCHAR(20) NOT NULL, -- 'insert', 'delete', 'update'
  position INTEGER NOT NULL,
  length INTEGER,
  content TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  timestamp_millis BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id, version)
);

CREATE INDEX idx_operation_history_document ON operation_history(document_id);
CREATE INDEX idx_operation_history_timestamp ON operation_history(created_at);

CREATE TABLE IF NOT EXISTS document_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. ADVANCED SEARCH TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  query_type VARCHAR(20) NOT NULL, -- 'full_text', 'semantic', 'hybrid'
  results_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_created ON search_logs(created_at);

CREATE TABLE IF NOT EXISTS search_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL UNIQUE,
  frequency INTEGER DEFAULT 1,
  salon_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. RECOMMENDATION ENGINE TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  interaction_type VARCHAR(20) NOT NULL, -- 'view', 'like', 'reply', 'share'
  rating INTEGER, -- 1-5 for favorites
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_content ON user_interactions(content_id);
CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);

CREATE TABLE IF NOT EXISTS recommendation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm VARCHAR(50) NOT NULL, -- 'collaborative', 'content_based', 'hybrid'
  recommendations JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recommendation_logs_user ON recommendation_logs(user_id);
CREATE INDEX idx_recommendation_logs_algorithm ON recommendation_logs(algorithm);

-- 4. WEBRTC VIDEO CHAT TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  callee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ringing', -- 'ringing', 'connected', 'ended', 'missed'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_video_calls_caller ON video_calls(caller_id);
CREATE INDEX idx_video_calls_callee ON video_calls(callee_id);
CREATE INDEX idx_video_calls_status ON video_calls(status);
CREATE INDEX idx_video_calls_created ON video_calls(created_at);

CREATE TABLE IF NOT EXISTS call_signaling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'offer', 'answer', 'ice-candidate'
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_call_signaling_call ON call_signaling(call_id);

CREATE TABLE IF NOT EXISTS video_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  duration_seconds INTEGER,
  bucket_name VARCHAR(255) DEFAULT 'video-recordings',
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_video_recordings_call ON video_recordings(call_id);

-- 5. NLP MODERATION TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type VARCHAR(50) NOT NULL, -- 'message', 'pub', 'profile'
  content TEXT NOT NULL,
  salon_id TEXT,
  moderation_result JSONB NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'approve', 'review', 'reject', 'approve_with_warning'
  severity VARCHAR(20) NOT NULL, -- 'critical', 'high', 'medium', 'low'
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_moderation_logs_user ON moderation_logs(user_id);
CREATE INDEX idx_moderation_logs_action ON moderation_logs(action);
CREATE INDEX idx_moderation_logs_severity ON moderation_logs(severity);
CREATE INDEX idx_moderation_logs_timestamp ON moderation_logs(timestamp);

CREATE TABLE IF NOT EXISTS moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  salon_id TEXT,
  moderation_flags JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMP,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_created ON moderation_queue(created_at);

CREATE TABLE IF NOT EXISTS tribunal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complainant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  case_type VARCHAR(50) NOT NULL, -- 'moderation_appeal', 'user_complaint'
  description TEXT NOT NULL,
  referenced_content_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'in_review', 'closed', 'resolved'
  resolution TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX idx_tribunal_cases_complainant ON tribunal_cases(complainant_id);
CREATE INDEX idx_tribunal_cases_status ON tribunal_cases(status);
CREATE INDEX idx_tribunal_cases_created ON tribunal_cases(created_at);

-- 6. SECURITY POLICIES (RLS)
-- ========================================

-- Enable RLS on all Phase 6 tables
ALTER TABLE operation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signaling ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tribunal_cases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own search logs
CREATE POLICY "search_logs_user_access" ON search_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can see their own interactions
CREATE POLICY "user_interactions_user_access" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can see their own recommendations
CREATE POLICY "recommendation_logs_user_access" ON recommendation_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only see calls involving them
CREATE POLICY "video_calls_user_access" ON video_calls
  FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Users can see signaling for their calls
CREATE POLICY "call_signaling_user_access" ON call_signaling
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM video_calls
      WHERE video_calls.id = call_signaling.call_id
      AND (video_calls.caller_id = auth.uid() OR video_calls.callee_id = auth.uid())
    )
  );

-- Users can see recordings of their calls
CREATE POLICY "video_recordings_user_access" ON video_recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM video_calls
      WHERE video_calls.id = video_recordings.call_id
      AND (video_calls.caller_id = auth.uid() OR video_calls.callee_id = auth.uid())
    )
  );

-- Moderators can access moderation queue
CREATE POLICY "moderation_queue_moderator_access" ON moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    )
  );

-- Users can see appeals they filed
CREATE POLICY "tribunal_cases_user_access" ON tribunal_cases
  FOR SELECT USING (auth.uid() = complainant_id OR auth.jwt()->>'role' = 'admin');

-- ========================================
-- Done
-- ========================================
