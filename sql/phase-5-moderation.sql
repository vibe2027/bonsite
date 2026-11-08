-- ═══════════════════════════════════════════════════════════════
-- VIBE Phase 5.1 — Advanced Moderation Schema
-- ═══════════════════════════════════════════════════════════════

-- Table: tribunal_appeals
CREATE TABLE IF NOT EXISTS tribunal_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  appellant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  attachments JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
    'pending',
    'under_review',
    'approved',
    'rejected'
  )),
  resolution TEXT,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tribunal_appeals_case_id
  ON tribunal_appeals(case_id);

CREATE INDEX IF NOT EXISTS idx_tribunal_appeals_status
  ON tribunal_appeals(status);

CREATE INDEX IF NOT EXISTS idx_tribunal_appeals_created
  ON tribunal_appeals(created_at DESC);

-- RLS
ALTER TABLE tribunal_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own appeals"
  ON tribunal_appeals FOR SELECT
  TO authenticated
  USING (appellant_id = auth.uid() OR EXISTS (
    SELECT 1 FROM tribunal_cases tc WHERE tc.id = case_id AND tc.defendant_id = auth.uid()
  ));

CREATE POLICY "Admins can manage appeals"
  ON tribunal_appeals FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Table: judge_assignments
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS judge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'assigned' CHECK(status IN (
    'assigned',
    'reviewing',
    'ready_to_vote',
    'completed'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_id
  ON judge_assignments(judge_id);

CREATE INDEX IF NOT EXISTS idx_judge_assignments_status
  ON judge_assignments(status);

-- RLS
ALTER TABLE judge_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Judges can view their assignments"
  ON judge_assignments FOR SELECT
  TO authenticated
  USING (judge_id = auth.uid() OR (
    SELECT role FROM users WHERE id = auth.uid()
  ) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Table: tribunal_audit_log
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tribunal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN (
    'case_created',
    'case_resolved',
    'vote_added',
    'vote_changed',
    'appeal_filed',
    'appeal_resolved',
    'judge_assigned',
    'judge_removed',
    'notes_added'
  )),
  actor_id UUID NOT NULL REFERENCES users(id),
  old_value JSONB,
  new_value JSONB,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tribunal_audit_log_case_id
  ON tribunal_audit_log(case_id);

CREATE INDEX IF NOT EXISTS idx_tribunal_audit_log_actor_id
  ON tribunal_audit_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_tribunal_audit_log_created
  ON tribunal_audit_log(created_at DESC);

-- RLS
ALTER TABLE tribunal_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON tribunal_audit_log FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Table: tribunal_analytics_cache
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tribunal_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK(metric_type IN (
    'case_stats',
    'judge_performance',
    'appeal_stats',
    'resolution_time'
  )),
  metric_date DATE NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(metric_type, metric_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tribunal_analytics_cache_date
  ON tribunal_analytics_cache(metric_date DESC);

-- ─────────────────────────────────────────────────────────────
-- Views for Moderation Analytics
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW tribunal_case_stats AS
SELECT
  COUNT(*) as total_cases,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_cases,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases,
  COUNT(CASE WHEN status = 'appealed' THEN 1 END) as appealed_cases,
  AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, now()) - created_at)) / 3600) as avg_resolution_hours,
  DATE_TRUNC('day', now()) as report_date
FROM tribunal_cases;

CREATE OR REPLACE VIEW judge_performance AS
SELECT
  ja.judge_id,
  COUNT(ja.case_id) as cases_assigned,
  COUNT(CASE WHEN tc.status = 'resolved' THEN 1 END) as cases_resolved,
  AVG(EXTRACT(EPOCH FROM (tc.resolved_at - tc.created_at)) / 3600) as avg_resolution_hours,
  COUNT(ta.id) FILTER (WHERE ta.action = 'appeal_filed') as appeals_filed
FROM judge_assignments ja
LEFT JOIN tribunal_cases tc ON tc.id = ja.case_id
LEFT JOIN tribunal_audit_log ta ON ta.case_id = tc.id
GROUP BY ja.judge_id;

CREATE OR REPLACE VIEW appeal_resolution_stats AS
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
FROM tribunal_appeals
WHERE resolved_at IS NOT NULL
GROUP BY status;
