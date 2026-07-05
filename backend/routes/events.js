import { Router } from 'express';
import * as store from '../store.js';
import { liveEvents } from '../services/liveEvents.js';

const router = Router();
const HEARTBEAT_MS = 25_000;

/** SSE stream — token via query (EventSource cannot send Authorization header). */
router.get('/stream', (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = store.getSessionByToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const user = store.getUserById(session.user_id);
  if (!user || store.isUserBlocked(user)) {
    return res.status(401).json({ error: 'Account blocked or not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(': connected\n\n');

  const clientId = liveEvents.addClient(res, user);
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    liveEvents.removeClient(clientId);
  });
});

export default router;
