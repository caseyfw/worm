import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import {
  EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type Reaction,
} from '@worm/shared';
import { RollingAggregator, type Strategy } from './aggregator.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const STRATEGY = (process.env['STRATEGY'] ?? 'ewma') as Strategy;

const app = express();
const httpServer = createServer(app);

// Serve built web frontend if it exists
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDistPath = path.resolve(__dirname, '../../web/dist');

if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
} else {
  console.warn(`[worm] web/dist not found at ${webDistPath} — skipping static serving`);
  app.get('/', (_req, res) => {
    res
      .status(200)
      .send(
        '<h1>worm</h1><p>Web frontend not built yet. Run <code>npm run build -w @worm/web</code>.</p>',
      );
  });
}

// Socket.IO
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

const aggregator = new RollingAggregator({ strategy: STRATEGY });
console.log(`[worm] aggregation strategy: ${STRATEGY}`);

// Broadcast a sample every second
setInterval(() => {
  const sample = aggregator.tick(Date.now());
  io.emit(EVENTS.sample, sample);
}, 1000);

io.on('connection', (socket) => {
  // Send history on connect
  socket.emit(EVENTS.history, aggregator.history());

  // Handle reactions
  socket.on(EVENTS.reaction, (r: Reaction) => {
    if (r.kind === 'up' || r.kind === 'down') {
      aggregator.record(r.kind, Date.now());
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[worm] listening on http://localhost:${PORT}`);
});

// Graceful shutdown — exit cleanly on Ctrl-C so npm doesn't print error noise
process.on('SIGINT', () => {
  console.log('\n[worm] shutting down');
  io.close();
  httpServer.close(() => process.exit(0));
});
