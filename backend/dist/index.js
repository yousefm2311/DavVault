"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middleware/error");
const queue_service_1 = require("./services/queue.service");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Setup Socket.io
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allow all origins for dev/local testing
        methods: ['GET', 'POST'],
    },
});
// Configure CORS and JSON Parser
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', database: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected' });
});
// Bind API Routes
app.use('/api', routes_1.default);
// Bind Global Error Handler
app.use(error_1.errorHandler);
// Socket.io Connection Event Handler
io.on('connection', (socket) => {
    console.log(`[Socket.io]: Client connected: ${socket.id}`);
    // Client joins a channel to receive real-time indexing logs for a specific project
    socket.on('join_project', (projectId) => {
        socket.join(`project_${projectId}`);
        console.log(`[Socket.io]: Client ${socket.id} joined channel project_${projectId}`);
    });
    socket.on('leave_project', (projectId) => {
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
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => {
    console.log('[Database]: MongoDB database connection established successfully.');
    // Initialize background queue processing
    queue_service_1.queueService.init(io);
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
