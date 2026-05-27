/**
 * CoCode — Real-time Collaborative Development Workspace
 * Entry point: Express app + HTTP server + Socket.io + MongoDB
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');

const connectDB = require('./config/db');
const initSocket = require('./socket/index');

// Route modules
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const codeRoutes = require('./routes/code');

// ─── Express App Setup ─────────────────────────────────────────────────────────
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' })); // generous limit for code + whiteboard data
app.use(express.urlencoded({ extended: true }));

// Health-check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    service: 'CoCode API',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/code', codeRoutes);

const path = require('path');

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
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

  server.listen(PORT, () => {
    console.log(`🚀 CoCode server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
