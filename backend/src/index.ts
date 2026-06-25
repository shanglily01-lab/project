// ─── Data API server ──────────────────────────────────
// Polls OpenProject on an interval, keeps the latest task snapshot in memory,
// and serves it over REST (/data/*) + a Socket.io feed. This is the live
// project-tracking data layer the frontend consumes.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { OpenProjectAdapter, buildSnapshot, detectChanges } from './adapters/openproject-adapter.js';
import { buildPersonStates, buildProjectStates } from './ontology/sync.js';
import { registerScoringRoutes } from './scoring/routes.js';
import type { TaskState, Snapshot } from './types.js';

// ─── Config ────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3100');
const OP_BASE_URL = process.env.OP_BASE_URL || '/api/v3';
const OP_TOKEN = process.env.OP_TOKEN || '';
const OP_TARGET = process.env.OP_TARGET || '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000');

// ─── State ─────────────────────────────────────────────

let lastSnapshot: Snapshot = {};
let lastTasks: TaskState[] = [];

// ─── Server ────────────────────────────────────────────

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    },
  });
  await app.register(cors, { origin: true });

  const io = new Server(app.server, { cors: { origin: '*' } });

  // ─── OpenProject proxy ───────────────────────────────

  app.all('/api/*', async (req, reply) => {
    if (!OP_TARGET) return reply.status(503).send({ error: 'OP_TARGET not configured' });
    const url = new URL(req.url, OP_TARGET);
    const resp = await fetch(url.toString(), {
      method: req.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(req.headers as Record<string, string>)
            .filter(([k]) => !['host', 'origin', 'referer'].includes(k))
        ),
        host: url.hostname,
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });
    const data = await resp.text();
    reply.status(resp.status).header('content-type', resp.headers.get('content-type') || 'application/json').send(data);
  });

  // ─── REST API ────────────────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    tasks: lastTasks.length,
  }));

  // Data endpoints — served from the in-memory snapshot (adapters + ontology)
  app.get('/data/tasks', async () => lastTasks);
  app.get('/data/persons', async () => buildPersonStates(lastTasks));
  app.get('/data/projects', async () => buildProjectStates(lastTasks));
  app.get('/data/changes', async () => {
    const snap = buildSnapshot(lastTasks);
    return detectChanges(snap, lastSnapshot);
  });

  // Manual refresh trigger
  app.post('/actions/refresh', async () => {
    await refreshCycle();
    return { ok: true, tasks: lastTasks.length };
  });

  await registerScoringRoutes(app);

  // ─── WebSocket ───────────────────────────────────────

  io.on('connection', (socket) => {
    app.log.info(`Client connected: ${socket.id}`);
    socket.emit('snapshot', {
      tasks: lastTasks,
      persons: buildPersonStates(lastTasks),
      projects: buildProjectStates(lastTasks),
    });
  });

  // ─── Background poll loop ────────────────────────────

  async function refreshCycle() {
    try {
      app.log.info('Starting refresh cycle...');

      const opAdapter = new OpenProjectAdapter({
        baseUrl: OP_BASE_URL.startsWith('/') ? `http://localhost:${PORT}${OP_BASE_URL}` : OP_BASE_URL,
        token: OP_TOKEN,
        pollIntervalMs: POLL_INTERVAL_MS,
      });
      const { tasks } = await opAdapter.poll();

      const newSnap = buildSnapshot(tasks);
      const changes = detectChanges(newSnap, lastSnapshot);

      lastTasks = tasks;
      lastSnapshot = newSnap;

      io.emit('refresh', {
        tasks: lastTasks.length,
        changes: changes.length,
        timestamp: new Date().toISOString(),
      });

      app.log.info({ tasks: tasks.length, changes: changes.length }, 'Refresh complete');
    } catch (err) {
      app.log.error(err, 'Refresh cycle failed');
    }
  }

  // ─── Start ───────────────────────────────────────────

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Data API running on port ${PORT}`);

  setTimeout(refreshCycle, 2000);
  setInterval(refreshCycle, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
