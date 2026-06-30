const { consumer } = require('../config/kafka');
const { redisClient } = require('../config/redis');

const sendEmailLogic = async (email, otp) => {
  console.log(`Sending OTP to ${email}`);
  
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { 
          name: 'CoCode Collaborative IDE',
          email: process.env.BREVO_SENDER_EMAIL // E.g., your verified Gmail address
        },
        to: [{ email: email }],
        subject: 'Verify your email - CoCode',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to CoCode!</h2>
            <p>Please use the following 6-digit OTP to verify your email address:</p>
            <h1 style="background: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in 10 minutes.</p>
          </div>
        `
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API Error:', data);
    } else {
      console.log(`Email successfully sent to ${email}. Message ID: ${data.messageId}`);
    }
  } catch (error) {
    console.error('Failed to send email via Brevo:', error);
  }
};

const startEmailWorker = async () => {
  try {
    if (!consumer) return; // Kafka is disabled
    await consumer.connect();
    console.log('Kafka Consumer Connected');
    await consumer.subscribe({ topic: 'auth-events', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());

          if (event.type === 'USER_REGISTERED') {
            await sendEmailLogic(event.email, event.otp);
          }
        } catch (err) {
          console.error('Error processing Kafka message:', err);
        }
      },
    });
  } catch (err) {
    console.error('Error starting Email Worker:', err);
  }
};

const startRedisEmailWorker = async () => {
  try {
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    console.log('Redis Email Worker Subscribed');

    await subscriber.subscribe('auth-events', async (message) => {
      try {
        const event = JSON.parse(message);
        if (event.type === 'USER_REGISTERED') {
          await sendEmailLogic(event.email, event.otp);
        }
      } catch (err) {
        console.error('Error processing Redis message:', err);
      }
    });
  } catch (error) {
    console.error('Error starting Redis Email Worker:', error);
  }
};

module.exports = { startEmailWorker, startRedisEmailWorker };
