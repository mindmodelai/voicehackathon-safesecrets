/**
 * SafeSecrets Backend Entry Point
 *
 * Creates an HTTP server, attaches the SafeSecretsWSServer for real-time
 * voice pipeline communication, and listens on PORT (default 8080).
 */

import { createServer } from 'node:http';
import { SafeSecretsWSServer } from './ws-server.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

// Create a plain HTTP server — the WSServer attaches to it on /ws
const httpServer = createServer((_req, res) => {
  // Health check endpoint
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: wsServer.getSessionCount() }));
    return;
  }

  // Everything else gets a simple 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Attach the WebSocket server to the HTTP server
const wsServer = new SafeSecretsWSServer({ server: httpServer });

httpServer.listen(PORT, () => {
  console.log(`SafeSecrets backend listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down SafeSecrets backend...');
  wsServer.close().then(() => {
    httpServer.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { httpServer, wsServer };
