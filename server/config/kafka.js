const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'cocode-backend',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'scram-sha-256', // Works with Upstash and Confluent
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined,
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'email-group' });
const admin = kafka.admin();

const connectKafkaProducer = async () => {
  await producer.connect();
  console.log('Kafka Producer Connected');

  // Create the topic if it doesn't exist
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: 'auth-events', numPartitions: 1 }],
  });
  await admin.disconnect();
};

module.exports = {
  kafka,
  producer,
  consumer,
  connectKafkaProducer
};
