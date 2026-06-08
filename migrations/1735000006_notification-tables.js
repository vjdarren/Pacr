exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      fcm_token TEXT,
      session_reminders BOOLEAN NOT NULL DEFAULT true,
      overtraining_alerts BOOLEAN NOT NULL DEFAULT true,
      plan_updates BOOLEAN NOT NULL DEFAULT true,
      weekly_digest BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notification_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notification_history_user_id
    ON notification_history(user_id, sent_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS notification_history;
    DROP TABLE IF EXISTS notification_preferences;
  `);
};
