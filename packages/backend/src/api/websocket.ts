import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import pino from "pino";

const logger = pino({ name: "websocket" });

export class WSBroadcaster {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      logger.info({ clients: this.clients.size }, "Client connected");

      ws.on("close", () => {
        this.clients.delete(ws);
        logger.info({ clients: this.clients.size }, "Client disconnected");
      });

      ws.on("error", (err) => {
        logger.error({ error: err }, "WebSocket error");
        this.clients.delete(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
    });
  }

  broadcast(event: { type: string; data: unknown }): void {
    const message = JSON.stringify({
      ...event,
      timestamp: Date.now(),
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    this.wss.close();
  }
}
