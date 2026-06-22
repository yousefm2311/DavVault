"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error('[Error Handler]:', err.stack || err.message || err);
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'An unexpected error occurred on the server.';
    res.status(status).json({
        error: message,
        code: err.code || 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    });
};
exports.errorHandler = errorHandler;
