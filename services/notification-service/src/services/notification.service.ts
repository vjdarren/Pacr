import { Pool } from 'pg';
import { sendPush } from '../providers/fcm.provider.js';

export class NotificationService {
  constructor(private db: Pool) {}

  private async getFcmToken(userId: string): Promise<string | null> {
    const res = await this.db.query(
      `SELECT fcm_token FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0]?.fcm_token ?? null;
  }

  private async persist(userId: string, type: string, title: string, body: string): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_history (user_id, notification_type, title, body, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, type, title, body],
    );
  }

  async sendSessionReminder(userId: string, sessionType: string, scheduledDate: string): Promise<void> {
    const token = await this.getFcmToken(userId);
    const title = "Today's run is ready";
    const body = `You have a ${sessionType} session scheduled for today.`;
    await this.persist(userId, 'session_reminder', title, body);
    if (token) await sendPush(token, title, body, { sessionDate: scheduledDate });
  }

  async sendOvertrainingAlert(userId: string, readinessScore: number): Promise<void> {
    const token = await this.getFcmToken(userId);
    const title = 'Rest day recommended';
    const body = `Your readiness score is ${readinessScore}. Take it easy today.`;
    await this.persist(userId, 'overtraining_alert', title, body);
    if (token) await sendPush(token, title, body);
  }

  async sendPlanAdapted(userId: string, reason: string): Promise<void> {
    const token = await this.getFcmToken(userId);
    const title = 'Your training plan was updated';
    const body = `Plan adapted: ${reason}`;
    await this.persist(userId, 'plan_adapted', title, body);
    if (token) await sendPush(token, title, body);
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_preferences (user_id, fcm_token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET fcm_token = $2, updated_at = NOW()`,
      [userId, fcmToken],
    );
  }
}
