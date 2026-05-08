import { Consumer } from 'kafkajs';
import { appConfig } from '../config';
import { getKafkaInstance } from '../utils/kafka';
import { invalidateAndRecompute } from '../services/readiness.service';
import { HealthIngestedEvent } from '../types';

let consumer: Consumer;

export const startHealthIngestedConsumer = async (): Promise<void> => {
  const kafka = getKafkaInstance();

  consumer = kafka.consumer({ groupId: appConfig.kafkaGroupId });

  await consumer.connect();
  await consumer.subscribe({ topic: 'health.ingested', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: HealthIngestedEvent;
      try {
        event = JSON.parse(message.value.toString()) as HealthIngestedEvent;
      } catch {
        console.error('Failed to parse health.ingested message');
        return;
      }

      const { userId } = event;
      if (!userId) {
        console.warn('health.ingested event missing userId, skipping');
        return;
      }

      console.log(`health.ingested received for user ${userId} — invalidating readiness cache`);
      await invalidateAndRecompute(userId);
    },
  });

  console.log('health.ingested consumer started');
};

export const closeHealthIngestedConsumer = async (): Promise<void> => {
  if (consumer) {
    await consumer.disconnect();
  }
};
