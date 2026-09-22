import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { createRouter } from "./api/routes.js";
import { WSBroadcaster } from "./api/websocket.js";
import { EventIndexer, type IndexerConfig } from "./indexer/EventIndexer.js";

loadEnv();

const logger = pino({ name: "server" });
const prisma = new PrismaClient();

async function main() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // API routes
  const apiRouter = createRouter(prisma);
  app.use("/api", apiRouter);

  // HTTP server
  const server = createServer(app);

  // WebSocket
  const broadcaster = new WSBroadcaster(server);

  // Event Indexer
  const indexerConfig: IndexerConfig = {
    rpcUrl: process.env.BSC_RPC_URL || process.env.BSC_TESTNET_RPC_URL || "http://127.0.0.1:8545",
    factoryAddress: process.env.LOTTERY_FACTORY_ADDRESS || "",
    registryAddress: process.env.AGENT_REGISTRY_ADDRESS || "",
    startBlock: parseInt(process.env.INDEX_START_BLOCK || "0"),
    confirmations: 2,
    pollInterval: parseInt(process.env.INDEX_POLL_INTERVAL || "5000"),
  };

  if (indexerConfig.factoryAddress) {
    const indexer = new EventIndexer(prisma, indexerConfig);

    // Forward indexer events to WebSocket
    indexer.onEvent = (event) => {
      broadcaster.broadcast(event);
    };

    await indexer.start();
    logger.info("Event indexer started");

    process.on("SIGINT", async () => {
      await indexer.stop();
    });
  } else {
    logger.warn("No factory address configured, indexer disabled");
  }

  // Start server
  const port = parseInt(process.env.PORT || "3001");
  server.listen(port, () => {
    logger.info({ port }, "Server running");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down...");
    broadcaster.close();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, "Server failed to start");
  process.exit(1);
});
