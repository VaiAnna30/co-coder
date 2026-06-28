const { Kafka } = require('kafkajs');

let kafka, producer, consumer, admin;

if (process.env.KAFKA_BROKERS) {
  kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'cocode-backend',
    brokers: process.env.KAFKA_BROKERS.split(','),
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_USERNAME ? {
      mechanism: 'scram-sha-256', // Works with Upstash and Confluent
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
    } : undefined,
  });

  producer = kafka.producer();
  consumer = kafka.consumer({ groupId: 'email-group' });
  admin = kafka.admin();
}

const connectKafkaProducer = async () => {
  if (!producer) {
    console.log('Kafka explicitly disabled (no brokers provided). Falling back to Redis Pub/Sub.');
    return;
  }
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
