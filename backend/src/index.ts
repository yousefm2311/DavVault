import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middleware/error';
import { queueService } from './services/queue.service';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for dev/local testing
    methods: ['GET', 'POST'],
  },
});

// Configure CORS and JSON Parser
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Bind API Routes
app.use('/api', apiRouter);

// Bind Global Error Handler
app.use(errorHandler);

// Socket.io Connection Event Handler
io.on('connection', (socket) => {
  console.log(`[Socket.io]: Client connected: ${socket.id}`);

  // Client joins a channel to receive real-time indexing logs for a specific project
  socket.on('join_project', (projectId: string) => {
    socket.join(`project_${projectId}`);
    console.log(`[Socket.io]: Client ${socket.id} joined channel project_${projectId}`);
  });

  socket.on('leave_project', (projectId: string) => {
    socket.leave(`project_${projectId}`);
    console.log(`[Socket.io]: Client ${socket.id} left channel project_${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io]: Client disconnected: ${socket.id}`);
  });
});

// Connect to MongoDB Database
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/devvault';

console.log('[Database]: Connecting to MongoDB...');
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[Database]: MongoDB database connection established successfully.');

    // Initialize background queue processing
    queueService.init(io);

    // Start server
    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
      console.log(`[Server]: DevVault AI backend server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Database]: MongoDB database connection failed:', err);
    process.exit(1);
  });
