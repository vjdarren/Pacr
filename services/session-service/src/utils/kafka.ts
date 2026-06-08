import { Kafka, Producer, Consumer, ProducerRecord } from 'kafkajs';
import { randomUUID } from 'crypto';
import { appConfig } from '../config';
import type { SessionCompletedEvent } from '../types';

let kafka: Kafka;
let producer: Producer;
let planGeneratedConsumer: Consumer;
let runCompletedConsumer: Consumer;

const getKafka = (): Kafka => {
  if (!kafka) {
    kafka = new Kafka({
      clientId: appConfig.kafkaClientId,
      brokers: appConfig.kafkaBrokers,
      retry: { retries: 5, initialRetryTime: 300, multiplier: 2 },
    });
  }
  return kafka;
};

export const initKafkaProducer = async (): Promise<Producer> => {
  producer = getKafka().producer();
  await producer.connect();
  console.log('Kafka producer connected');
  return producer;
};

export const getProducer = (): Producer => {
  if (!producer) throw new Error('Kafka producer not initialized');
  return producer;
};

export const closeKafkaProducer = async (): Promise<void> => {
  if (producer) await producer.disconnect();
};

export const publishSessionCompleted = async (
  userId: string,
  sessionId: string,
  sessionType: string,
  runId?: string
): Promise<void> => {
  const event: SessionCompletedEvent = {
    eventId: randomUUID(),
    eventType: 'session.completed',
    timestamp: new Date().toISOString(),
    userId,
    payload: { sessionId, runId: runId ?? null, sessionType },
    metadata: { service: 'session-service', version: '1.0' },
  };

  const record: ProducerRecord = {
    topic: 'session.completed',
    messages: [{ key: userId, value: JSON.stringify(event) }],
  };

  try {
    await getProducer().send(record);
  } catch (error) {
    console.error('Failed to publish session.completed event:', error);
  }
};

// plan.generated consumer — sessions are already written to DB by plan-service;
// we just acknowledge receipt.
export const startPlanGeneratedConsumer = async (): Promise<void> => {
  planGeneratedConsumer = getKafka().consumer({ groupId: `${appConfig.kafkaGroupId}-plan` });
  await planGeneratedConsumer.connect();
  await planGeneratedConsumer.subscribe({ topic: 'plan.generated', fromBeginning: false });

  await planGeneratedConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value?.toString() ?? '{}') as { userId?: string };
        console.log(`[session-service] plan.generated received for user ${payload.userId ?? 'unknown'}`);
      } catch (err) {
        console.error('Error processing plan.generated event:', err);
      }
    },
  });
};

export const closePlanGeneratedConsumer = async (): Promise<void> => {
  if (planGeneratedConsumer) await planGeneratedConsumer.disconnect();
};

// run.completed consumer — marks the linked training_session as completed.
// Handler injected to avoid circular dependency with database module.
export const startRunCompletedConsumer = async (
  onRunCompleted: (sessionId: string, runId: string) => Promise<void>
): Promise<void> => {
  runCompletedConsumer = getKafka().consumer({ groupId: `${appConfig.kafkaGroupId}-run` });
  await runCompletedConsumer.connect();
  await runCompletedConsumer.subscribe({ topic: 'run.completed', fromBeginning: false });

  await runCompletedConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value?.toString() ?? '{}') as {
          payload?: { sessionId?: string; runId?: string };
        };
        const { sessionId, runId } = event.payload ?? {};
        if (sessionId && runId) {
          await onRunCompleted(sessionId, runId);
        }
      } catch (err) {
        console.error('Error processing run.completed event:', err);
      }
    },
  });
};

export const closeRunCompletedConsumer = async (): Promise<void> => {
  if (runCompletedConsumer) await runCompletedConsumer.disconnect();
};
