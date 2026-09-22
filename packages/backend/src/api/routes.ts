import { Router } from "express";
import { PrismaClient } from "@prisma/client";

export function createRouter(prisma: PrismaClient): Router {
  const router = Router();

  // --- Lotteries ---

  router.get("/lotteries", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const where = status ? { status: status as "ACTIVE" | "PAUSED" | "CLOSED" } : {};

    const [lotteries, total] = await Promise.all([
      prisma.lottery.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          rounds: {
            orderBy: { roundNumber: "desc" },
            take: 1,
          },
        },
      }),
      prisma.lottery.count({ where }),
    ]);

    res.json({ lotteries, total, limit, offset });
  });

  router.get("/lotteries/:id", async (req, res) => {
    const lottery = await prisma.lottery.findUnique({
      where: { address: req.params.id },
      include: {
        rounds: {
          orderBy: { roundNumber: "desc" },
          take: 1,
          include: { tickets: { select: { commitmentHash: true, leafIndex: true, insertedAt: true } } },
        },
      },
    });

    if (!lottery) {
      res.status(404).json({ error: "Lottery not found" });
      return;
    }

    res.json(lottery);
  });

  router.get("/lotteries/:id/rounds", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const rounds = await prisma.round.findMany({
      where: { lotteryId: req.params.id },
      skip: offset,
      take: limit,
      orderBy: { roundNumber: "desc" },
      include: {
        _count: { select: { tickets: true } },
        draw: true,
        claim: true,
      },
    });

    res.json(rounds);
  });

  router.get("/lotteries/:id/rounds/:rid", async (req, res) => {
    const round = await prisma.round.findFirst({
      where: {
        lotteryId: req.params.id,
        roundNumber: parseInt(req.params.rid),
      },
      include: {
        tickets: {
          select: { commitmentHash: true, leafIndex: true, insertedAt: true },
          orderBy: { leafIndex: "asc" },
        },
        draw: true,
        claim: true,
      },
    });

    if (!round) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    res.json(round);
  });

  // --- Agents ---

  router.get("/agents", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sort as string) || "reputation";

    const orderBy = sortBy === "reputation"
      ? { reputation: "desc" as const }
      : { registeredAt: "desc" as const };

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where: { isActive: true },
        skip: offset,
        take: limit,
        orderBy,
      }),
      prisma.agent.count({ where: { isActive: true } }),
    ]);

    res.json({ agents, total, limit, offset });
  });

  router.get("/agents/:address", async (req, res) => {
    const agent = await prisma.agent.findUnique({
      where: { address: req.params.address },
    });

    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    // Get agent participation stats from claims
    const claims = await prisma.claim.findMany({
      where: { recipient: req.params.address },
      include: { round: { include: { lottery: true } } },
    });

    const totalWon = claims.reduce((sum, c) => sum + BigInt(c.amount), 0n);

    res.json({
      ...agent,
      stats: {
        totalClaims: claims.length,
        totalWon: totalWon.toString(),
      },
    });
  });

  // --- Draws ---

  router.get("/draws/recent", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const draws = await prisma.draw.findMany({
      take: limit,
      orderBy: { requestedAt: "desc" },
      include: {
        round: {
          include: { lottery: { select: { address: true, entryFee: true } } },
        },
      },
    });

    res.json(draws);
  });

  // --- Global Stats ---

  router.get("/stats", async (req, res) => {
    const [
      lotteryCount,
      agentCount,
      totalTickets,
      totalClaims,
      recentDraws,
    ] = await Promise.all([
      prisma.lottery.count({ where: { status: "ACTIVE" } }),
      prisma.agent.count({ where: { isActive: true } }),
      prisma.ticket.count(),
      prisma.claim.count(),
      prisma.draw.count({
        where: { requestedAt: { gte: new Date(Date.now() - 86400000) } },
      }),
    ]);

    // Total prize pool across active rounds
    const activeRounds = await prisma.round.findMany({
      where: { status: "OPEN" },
      select: { prizePool: true },
    });
    const totalPrizePool = activeRounds.reduce(
      (sum, r) => sum + BigInt(r.prizePool),
      0n
    );

    res.json({
      activeLotteries: lotteryCount,
      activeAgents: agentCount,
      totalTickets,
      totalClaims,
      drawsToday: recentDraws,
      totalPrizePool: totalPrizePool.toString(),
    });
  });

  return router;
}
