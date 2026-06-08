import { Kafka } from 'kafkajs';
import { appConfig } from '../config';

let kafka: Kafka;

export const getKafkaInstance = (): Kafka => {
  if (!kafka) {
    kafka = new Kafka({
      clientId: appConfig.kafkaClientId,
      brokers: appConfig.kafkaBrokers,
      retry: {
        retries: 5,
        initialRetryTime: 300,
        multiplier: 2,
      },
    });
  }
  return kafka;
};
