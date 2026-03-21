import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as db from './src/models/db.js';
import { startScheduler } from './src/services/automationService.js';
import router, { getGoogleToken } from './src/api/routes.js';
import { logger } from './src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api', router);

// ── Bootstrap ─────────────────────────────────────────────────────────────
db.initDb();
startScheduler(getGoogleToken);

const server = app.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════╗
║       InstaPoster Pro — Server           ║
║  Running at http://localhost:${PORT}        ║
╚══════════════════════════════════════════╝
  `);
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
const shutdown = () => {
    logger.info('Shutting down server...');
    server.close(() => {
        logger.info('HTTP server closed.');
        db.db.close();
        logger.info('Database connection closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
