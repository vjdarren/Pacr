import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { appConfig } from '../config/index.js';

export function initFcm(): void {
  if (getApps().length > 0 || !appConfig.fcmServerKey) return;
  try {
    initializeApp({ credential: cert(JSON.parse(appConfig.fcmServerKey)) });
  } catch {
    console.warn('[fcm] FCM_SERVER_KEY not set or invalid — push notifications disabled in this environment');
  }
}

export async function sendPush(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (getApps().length === 0) return;
  try {
    await getMessaging().send({ token: fcmToken, notification: { title, body }, data });
  } catch (err) {
    console.error('[fcm] send failed:', err);
  }
}
