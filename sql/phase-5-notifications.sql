-- ═══════════════════════════════════════════════════════════════
-- VIBE Phase 5.0 — Notifications Schema
-- ═══════════════════════════════════════════════════════════════

-- Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN (
    'new_message',
    'tribunal_case',
    'pub_approval',
    'billet_transfer',
    'account_security',
    'announcement'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id)
  WHERE read_at IS NULL;

-- Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage notifications"
  ON notifications FOR ALL
  TO service_role
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- Table: notification_preferences
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_on_message BOOLEAN DEFAULT true,
  push_on_message BOOLEAN DEFAULT true,
  email_on_tribunal BOOLEAN DEFAULT true,
  push_on_tribunal BOOLEAN DEFAULT true,
  email_on_pubs BOOLEAN DEFAULT true,
  push_on_pubs BOOLEAN DEFAULT true,
  email_on_billets BOOLEAN DEFAULT true,
  push_on_billets BOOLEAN DEFAULT true,
  email_on_security BOOLEAN DEFAULT true,
  push_on_security BOOLEAN DEFAULT false,
  email_on_announcements BOOLEAN DEFAULT true,
  push_on_announcements BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
  ON notification_preferences(user_id);

-- Row Level Security
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read/update their own preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Table: notification_audit_log
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('created', 'sent', 'read', 'archived')),
  channel TEXT NOT NULL CHECK(channel IN ('in_app', 'email', 'push')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_notification_id
  ON notification_audit_log(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_audit_log_created
  ON notification_audit_log(created_at DESC);

-- Row Level Security
ALTER TABLE notification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit logs"
  ON notification_audit_log FOR ALL
  TO service_role
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- Auto-update triggers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_preferences_updated_at_trigger
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Views for analytics
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW notification_stats AS
SELECT
  DATE_TRUNC('day', n.created_at) as day,
  n.type,
  COUNT(*) as total,
  COUNT(CASE WHEN n.read_at IS NOT NULL THEN 1 END) as read_count,
  COUNT(CASE WHEN n.read_at IS NULL THEN 1 END) as unread_count
FROM notifications n
GROUP BY DATE_TRUNC('day', n.created_at), n.type
ORDER BY day DESC;

CREATE OR REPLACE VIEW user_notification_stats AS
SELECT
  user_id,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_notifications,
  MAX(created_at) as last_notification_at,
  AVG(EXTRACT(EPOCH FROM (COALESCE(read_at, now()) - created_at))) as avg_read_time_seconds
FROM notifications
GROUP BY user_id;
