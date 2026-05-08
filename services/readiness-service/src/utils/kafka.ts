import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { randomUUID } from 'crypto';
import { appConfig } from '../config';
import { ReadinessCalculatedEvent, ComponentScores } from '../types';

let kafka: Kafka;
let producer: Producer;

export const initKafkaProducer = async (): Promise<Producer> => {
  kafka = new Kafka({
    clientId: appConfig.kafkaClientId,
    brokers: appConfig.kafkaBrokers,
    retry: {
      retries: 5,
      initialRetryTime: 300,
      multiplier: 2,
    },
  });

  producer = kafka.producer();
  await producer.connect();

  console.log('Kafka producer connected');
  return producer;
};

export const getProducer = (): Producer => {
  if (!producer) {
    throw new Error('Kafka producer not initialized. Call initKafkaProducer() first.');
  }
  return producer;
};

export const closeKafkaProducer = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
  }
};

export const publishReadinessCalculated = async (
  userId: string,
  score: number,
  overtraining_flag: boolean,
  component_scores: ComponentScores,
  computed_at: string
): Promise<void> => {
  const event: ReadinessCalculatedEvent = {
    eventId: randomUUID(),
    eventType: 'readiness.calculated',
    timestamp: new Date().toISOString(),
    userId,
    payload: { score, overtraining_flag, component_scores, computed_at },
    metadata: { service: 'readiness-service', version: '1.0' },
  };

  const record: ProducerRecord = {
    topic: 'readiness.calculated',
    messages: [
      {
        key: userId,
        value: JSON.stringify(event),
        headers: {
          'event-type': 'readiness.calculated',
          'event-id': event.eventId,
        },
      },
    ],
  };

  try {
    await getProducer().send(record);
  } catch (error) {
    // Don't fail the request if Kafka is unavailable
    console.error('Failed to publish readiness.calculated event:', error);
  }
};

export const getKafkaInstance = (): Kafka => {
  if (!kafka) {
    kafka = new Kafka({
      clientId: appConfig.kafkaClientId,
      brokers: appConfig.kafkaBrokers,
      retry: { retries: 5, initialRetryTime: 300, multiplier: 2 },
    });
  }
  return kafka;
};
