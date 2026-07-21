import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middleware/error';
import { queueService } from './services/queue.service';
import { stripeWebhook } from './controllers/subscription.controller';
import { assertTokenSecrets } from './services/token.service';
import jwt from 'jsonwebtoken';
import { Project, User } from './models';
import { decorateObject } from './utils/domain-mapper';
import { accessibleProjectFilter } from './utils/access-control';

// Load environment variables
dotenv.config();
assertTokenSecrets();

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Configure CORS and JSON Parser
app.use(cors(corsOptions));
app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 500 && process.env.NODE_ENV !== 'development') {
      return sendJson({
        error: 'An unexpected server error occurred.',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    
    // Safety check: Skip decoration for auth routes, webhook calls, health checks, error statuses, or token bodies
    const skipDecoration = 
      res.statusCode >= 400 ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/subscription/webhook') ||
      req.path.endsWith('/download') ||
      (body && (body.error || body.accessToken || body.token));

    if (skipDecoration) {
      return sendJson(body);
    }

    // Decorate JSON bodies with non-breaking domainType fields
    return sendJson(decorateObject(body));
  }) as typeof res.json;
  next();
});

// Health Check Endpoint
app.get('/health', async (req, res) => {
  const queue = await queueService.getStats().catch(() => ({
    mode: queueService.getMode(),
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }));

  res.status(200).json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    queue,
    integrations: {
      ai: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
      aiProviders: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      githubOAuth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_TEAM_PRICE_ID),
    },
  });
});

// Bind API Routes
app.use('/api', apiRouter);

// Bind Global Error Handler
app.use(errorHandler);

const normalizeSocketProjectId = (value: unknown): string | null => {
  return typeof value === 'string' &&
    /^[a-fA-F0-9]{24}$/.test(value) &&
    mongoose.Types.ObjectId.isValid(value)
    ? value
    : null;
};

// Socket.io Connection Event Handler
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized.'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      tokenVersion?: number;
    };
    const user = await User.findById(decoded.id, 'tokenVersion status');
    if (
      !user ||
      user.status === 'suspended' ||
      (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)
    ) {
      return next(new Error('Unauthorized.'));
    }
    socket.data.userId = user._id.toString();
    next();
  } catch {
    next(new Error('Unauthorized.'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io]: Client connected: ${socket.id}`);

  // Client joins a channel to receive real-time indexing logs for a specific project
  socket.on('join_project', async (projectId: unknown) => {
    if (!normalizeSocketProjectId(socket.data.userId)) {
      console.warn(`[Socket.io]: Ignoring project join without valid socket user id from ${socket.id}`);
      return;
    }

    const normalizedProjectId = normalizeSocketProjectId(projectId);
    if (!normalizedProjectId) {
      console.warn(`[Socket.io]: Ignoring invalid project room id from ${socket.id}`);
      return;
    }

    try {
      const project = await Project.findOne(
        await accessibleProjectFilter(socket.data.userId, normalizedProjectId),
        '_id'
      );
      if (!project) return;
      socket.join(`project_${normalizedProjectId}`);
      console.log(`[Socket.io]: Client ${socket.id} joined channel project_${normalizedProjectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Socket.io]: Failed to join project room safely - ${msg}`);
    }
  });

  socket.on('leave_project', (projectId: unknown) => {
    if (!normalizeSocketProjectId(socket.data.userId)) return;

    const normalizedProjectId = normalizeSocketProjectId(projectId);
    if (!normalizedProjectId) return;

    socket.leave(`project_${normalizedProjectId}`);
    console.log(`[Socket.io]: Client ${socket.id} left channel project_${normalizedProjectId}`);
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
