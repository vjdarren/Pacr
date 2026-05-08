import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { randomUUID } from 'crypto';
import { appConfig } from '../config';
import { HealthIngestedEvent, MetricType } from '../types';

let kafka: Kafka;
let producer: Producer;

export const initKafka = async (): Promise<Producer> => {
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
    throw new Error('Kafka producer not initialized. Call initKafka() first.');
  }
  return producer;
};

export const closeKafka = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
  }
};

/**
 * Publish health.ingested event to Kafka
 */
export const publishHealthIngestedEvent = async (
  userId: string,
  metricsCount: number,
  anomaliesCount: number,
  metricTypes: MetricType[],
  timeRange: { start: string; end: string }
): Promise<void> => {
  const event: HealthIngestedEvent = {
    eventId: randomUUID(),
    eventType: 'health.ingested',
    timestamp: new Date().toISOString(),
    userId,
    payload: {
      metricsCount,
      anomaliesCount,
      metricTypes: Array.from(new Set(metricTypes)), // Unique metric types
      timeRange,
    },
    metadata: {
      service: 'health-ingestion',
      version: '1.0',
    },
  };

  const record: ProducerRecord = {
    topic: 'health.ingested',
    messages: [
      {
        key: userId,
        value: JSON.stringify(event),
        headers: {
          'event-type': 'health.ingested',
          'event-id': event.eventId,
        },
      },
    ],
  };

  try {
    await getProducer().send(record);
    console.log(`Published health.ingested event for user ${userId}`);
  } catch (error) {
    console.error('Failed to publish Kafka event:', error);
    // Don't throw - we don't want to fail the request if Kafka is down
  }
};
