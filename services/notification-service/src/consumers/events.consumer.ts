import { Kafka } from 'kafkajs';
import { NotificationService } from '../services/notification.service.js';
import { Pool } from 'pg';

export async function startEventsConsumer(kafka: Kafka, db: Pool): Promise<void> {
  const consumer = kafka.consumer({ groupId: 'notification-events' });
  await consumer.connect();
  await consumer.subscribe({
    topics: ['session.scheduled', 'readiness.calculated', 'plan.adapted'],
    fromBeginning: false,
  });

  const svc = new NotificationService(db);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString()) as Record<string, unknown>;

        if (topic === 'session.scheduled' && event.userId && event.sessionType) {
          await svc.sendSessionReminder(
            event.userId as string,
            event.sessionType as string,
            (event.scheduledDate as string) ?? '',
          );
        } else if (
          topic === 'readiness.calculated' &&
          event.userId &&
          typeof event.score === 'number' &&
          event.score < 30
        ) {
          await svc.sendOvertrainingAlert(event.userId as string, event.score);
        } else if (topic === 'plan.adapted' && event.userId && event.reason) {
          await svc.sendPlanAdapted(event.userId as string, event.reason as string);
        }
      } catch (err) {
        console.error(`[notification] Failed to process ${topic} event:`, err);
      }
    },
  });
}
