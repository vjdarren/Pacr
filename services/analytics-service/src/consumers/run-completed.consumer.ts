import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { AnalyticsService } from '../services/analytics.service.js';

export async function startRunCompletedConsumer(
  kafka: Kafka,
  db: Pool,
  redis: Redis,
): Promise<void> {
  const consumer = kafka.consumer({ groupId: 'analytics-run-completed' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'run.completed', fromBeginning: false });

  const svc = new AnalyticsService(db, redis);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString()) as { userId?: string };
        if (event.userId) {
          await svc.invalidateCache(event.userId);
        }
      } catch (err) {
        console.error('Failed to process run.completed event:', err);
      }
    },
  });
}
