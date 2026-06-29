const { Resend } = require('resend');
const { consumer } = require('../config/kafka');
const { redisClient } = require('../config/redis');

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmailLogic = async (email, otp) => {
  console.log(`Sending OTP to ${email}`);
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'CoCode Collaborative IDE <onboarding@resend.dev>', // Resend provides a free testing domain. Once you add your own domain, change this.
      to: email,
      subject: 'Verify your email - CoCode',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to CoCode!</h2>
          <p>Please use the following 6-digit OTP to verify your email address:</p>
          <h1 style="background: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
    } else {
      console.log(`Email successfully sent to ${email}. Response ID: ${data.id}`);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
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
