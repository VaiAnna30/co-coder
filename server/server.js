/**
 * CoCode — Real-time Collaborative Development Workspace
 */

// reads the .env file and sets environment variables accordingly i.e. load its content into process.env,
// so that we can access them via process.env.VARIABLE_NAME in our code.
require("dotenv").config();

// Express -> Framework used to handle HTTP requests, define routes, and manage middleware in our server application.
// http -> Node.js’s native, built-in network module. We need it to create an HTTP server that can be used with Socket.io for real-time communication.
// cors -> Middleware to enable Cross-Origin Resource Sharing, allowing our frontend (which may be served from a different origin) to make requests to our backend API without being blocked by the browser’s same-origin policy {i.e. It prevents your browser from blocking requests when your React frontend (e.g., port 5173) tries to talk to your Node backend (port 5000).}
const express = require("express");
const http = require("http");
const cors = require("cors");


const connectDB = require("./config/db");
const initSocket = require("./socket/index");
const { connectRedis } = require("./config/redis");
const { connectKafkaProducer } = require("./config/kafka");
const { startEmailWorker, startRedisEmailWorker } = require("./workers/emailWorker");

// Route modules
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const codeRoutes = require("./routes/code");

// ─── Express App Setup ─────────────────────────────────────────────────────────
const app = express();

// Middleware
//Activates the CORS middleware globally so that external frontend applications are permitted to hit your API endpoints.
app.use(cors());
app.use(express.json({ limit: "5mb" })); // generous limit for code + whiteboard data
app.use(express.urlencoded({ extended: true }));

// Health-check endpoint
// This is a simple endpoint that clients or monitoring tools can call to verify that the server is up and running. It returns a JSON response with the service name, status, and current timestamp.
//This is highly useful for automated cloud hosting platforms (like AWS or Render) to monitor if your server is alive.
app.get("/api/health", (req, res) => {
  res.json({
    service: "CoCode API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/code", codeRoutes);

const path = require("path");

// Global error handler
// This middleware will catch any errors that occur in the route handlers or other middleware. It logs the error and sends a JSON response with the error message and appropriate HTTP status code (defaulting to 500 for server errors).
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

// Serve frontend in production
// When the server is running in production mode, it serves the static files from the React frontend build. It also defines a catch-all route that sends back the index.html file for any routes that are not API endpoints, allowing React Router to handle client-side routing.
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client", "dist", "index.html"));
  });
}

// ─── HTTP Server + Socket.io ───────────────────────────────────────────────────
const server = http.createServer(app);
const io = initSocket(server);

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to MongoDB before accepting traffic
  await connectDB();
  
  // Connect to Redis and Kafka
  await connectRedis();
  await connectKafkaProducer();

  // Start the appropriate email worker
  if (process.env.KAFKA_BROKERS) {
    startEmailWorker();
  } else {
    startRedisEmailWorker();
  }

  server.listen(PORT, () => {
    console.log(`🚀 CoCode server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});