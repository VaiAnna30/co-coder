// Load environment variables from .env file into process.env
require("dotenv").config();

// Express -> Its a HTTP server framework for Node.js
// http -> here it is used to create a server for socket.io to listen on same port as express
// cors -> cross-origin resource sharing is a middleware allow frontend talking to backend
const express = require("express");
const http = require("http");
const cors = require("cors");

// connectDB -> function to connect to MongoDB
const connectDB = require("./config/db");
// initSocket -> function to initialize socket.io
const initSocket = require("./socket/index");
// connectRedis -> function to connect to Redis
const { connectRedis } = require("./config/redis");

// authRoutes -> routes for authentication (login, register, etc.)
const authRoutes = require("./routes/auth");
// roomRoutes -> routes for room management (create, join, leave, etc.)
const roomRoutes = require("./routes/rooms");
// codeRoutes -> routes for code execution and management
const codeRoutes = require("./routes/code");

const app = express();

// Middleware setup
// cors -> allows cross-origin requests from frontend to backend
app.use(cors());
// express.json -> parses incoming JSON requests and puts the parsed data in req.body
app.use(express.json({ limit: "5mb" }));
// express.urlencoded -> parses incoming requests with URL-encoded payloads and puts the parsed data in req.body
app.use(express.urlencoded({ extended: true }));

// This route helps to check if the server is running and healthy.
app.get("/api/health", (req, res) => {
  res.json({
    service: "CoCode API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Route setup
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/code", codeRoutes);

// path -> Node.js module to work with file and directory paths
const path = require("path");

// Global error handler middleware
// This middleware catches any unhandled errors in the application and sends a JSON response with the error message and status code.
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

// if the app is running in production level then we will serve frontend from backend server. This is done to avoid CORS issues and to serve the frontend from the same domain as the backend.
if (process.env.NODE_ENV === "production") {
  // Serve static files from the React frontend app
  app.use(express.static(path.join(__dirname, "../client/dist")));
  // * This route will serve the index.html file for any unknown routes. This is necessary for React Router to work properly in production.
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client", "dist", "index.html"));
  });
}

// ─── HTTP Server + Socket.io ───────────────────────────────────────────────────
const server = http.createServer(app);
// initSocket -> function to initialize socket.io and attach it to the HTTP server
const io = initSocket(server);

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to MongoDB before accepting traffic
  await connectDB();

  // Connect to Redis
  await connectRedis();

  server.listen(PORT, () => {
    console.log(`CoCode server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
