const http = require('http');
const url = require('url');

// SSE signaling server for WebRTC
// - clients subscribe: GET /events?roomId=...
// - clients publish: POST /signal?roomId=... with { to: string|null, from: string, type: string, payload: object, id?: string }
//
// NOTE: This is a simple demo-grade signaling layer. For production: add auth, rate limiting, message validation.

const PORT = 5555; // один порт для фронта/сигналинга

const MAX_PARTICIPANTS = 6;
// roomId -> Map(clientId -> ServerResponse)
const clientsByRoom = new Map();

function canAcceptMore(roomId) {
  const set = clientsByRoom.get(roomId);
  return !set || set.size < MAX_PARTICIPANTS;
}




function getRoomSet(roomId) {
  if (!clientsByRoom.has(roomId)) clientsByRoom.set(roomId, new Set());
  return clientsByRoom.get(roomId);
}

function removeClient(roomId, client) {
  const set = clientsByRoom.get(roomId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) clientsByRoom.delete(roomId);
}

function sendEvent(res, eventObj) {
  // SSE format: event: <name>\ndata: <json>\n\n
  res.write(`event: signal\n`);
  res.write(`data: ${JSON.stringify(eventObj)}\n\n`);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  const roomId = parsed.query.roomId;
  if (!roomId && pathname !== '/') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'roomId is required' }));
    return;
  }

  // Health
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'privaXion-signal-sse' }));
    return;
  }

  // Subscribe (SSE)
  if (pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write('\n');

    const clientId = parsed.query.clientId || 'anon';
    const set = getRoomSet(roomId);

    if (!canAcceptMore(roomId)) {
      sendEvent(res, { kind: 'room-full', roomId, from: clientId, max: MAX_PARTICIPANTS });
      res.end();
      return;
    }

    const client = { id: clientId, res };
    set.add(client);

    // Notify that we are connected
    sendEvent(res, { kind: 'connected', roomId, from: clientId, participants: set.size });

    req.on('close', () => {
      removeClient(roomId, client);

      const remaining = clientsByRoom.get(roomId);
      const participants = remaining ? remaining.size : 0;
      if (participants >= 0) {
        // broadcast leave notification (room participants count)
        if (remaining) {
          for (const c of remaining) {
            sendEvent(c.res, { kind: 'left', roomId, from: clientId, participants });
          }
        }
      }
    });


    return;

  }

  // Publish signal
  if (pathname === '/signal' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
        return;
      }

      const from = data.from;
      const to = data.to ?? null;
      const type = data.type;
      const payload = data.payload;

      if (!from || !type) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'from and type are required' }));
        return;
      }

      const set = clientsByRoom.get(roomId);
      if (!set || set.size === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, delivered: 0 }));
        return;
      }

      let delivered = 0;
      for (const client of set) {
        // if to is specified, deliver only to that client
        if (to && client.id !== to) continue;
        if (!to && client.id === from) {
          // sender doesn't need to receive its own messages
          continue;
        }

        sendEvent(client.res, {
          kind: 'message',
          roomId,
          from,
          to,
          type,
          payload,
          id: data.id || null,
          ts: Date.now()
        });
        delivered++;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, delivered }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Signal SSE server running at http://localhost:${PORT}/`);
});

