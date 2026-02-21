import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { setupSocket } from './socket.js';
import { getCacheClient } from './services/cacheClient.js';

const server = http.createServer(app);
setupSocket(server, env.SOCKET_ALLOWED_ORIGIN);

getCacheClient(env.REDIS_URL);

server.listen(env.PORT, () => {
  console.log(`KnowMe backend running on port ${env.PORT}`);
});
