import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { randomUUID } from 'crypto';
import { appConfig } from '../config';
import type { RunCompletedEvent } from '../types';

let kafka: Kafka;
let producer: Producer;

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

export const closeKafkaProducer = async (): Promise<void> => {
  if (producer) await producer.disconnect();
};

export const publishRunCompleted = async (
  userId: string,
  runId: string,
  sessionId: string | null,
  distanceKm: number,
  durationSec: number,
  avgPaceSecKm: number
): Promise<void> => {
  const event: RunCompletedEvent = {
    eventId: randomUUID(),
    eventType: 'run.completed',
    timestamp: new Date().toISOString(),
    userId,
    payload: { runId, sessionId, distanceKm, durationSec, avgPaceSecKm },
    metadata: { service: 'run-tracker', version: '1.0' },
  };

  const record: ProducerRecord = {
    topic: 'run.completed',
    messages: [{ key: userId, value: JSON.stringify(event) }],
  };

  try {
    await producer.send(record);
  } catch (error) {
    console.error('Failed to publish run.completed event:', error);
  }
};
