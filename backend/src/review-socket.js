import { WebSocket, WebSocketServer } from 'ws';

export function attachReviewSocket(server) {
  const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });

  sockets.on('error', (error) => console.error('WebSocket server error:', error.message));
  sockets.on('connection', (client) => {
    client.isAlive = true;
    client.on('pong', () => { client.isAlive = true; });
    client.on('error', () => client.terminate());
  });

  const heartbeat = setInterval(() => {
    for (const client of sockets.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);
  sockets.on('close', () => clearInterval(heartbeat));

  return {
    broadcast(event) {
      const message = JSON.stringify(event);
      for (const client of sockets.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message, (error) => {
            if (error) client.terminate();
          });
        }
      }
    },
    close() {
      for (const client of sockets.clients) client.terminate();
      sockets.close();
    },
  };
}
