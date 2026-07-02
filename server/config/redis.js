// Redis is an In-Memory Database. It lives entirely in RAM, making it incredibly fast. In CoCode, you likely use Redis for things that need to be fast and temporary: caching data, handling user sessions, or managing background job queues (like the email queue we saw in server.js).
const { createClient } = require("redis");

// Create a Redis client using the connection URL from environment variables or default to localhost.
const redisClient = createClient({
  url: process.env.REDIS_URI || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.on("connect", () => console.log("Redis Client Connected"));

const connectRedis = async () => {
  await redisClient.connect();
};

module.exports = {
  redisClient,
  connectRedis,
};
/*
In this Project we used Redis both high-speed memory storage and backup message queue.
1) Temporary Data Storage: (routes/auth.js) :- When a user tries to signup the backend generates an otp and instead of storing it in a mongodb db, it uses Redis.
2) Fallback pub/sub (publish/subscribe) :- If Kafka not configured, we use Redis as a message broker.
*/
