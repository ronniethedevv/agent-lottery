"use client";

import { useQuery } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function useLotteries(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["lotteries", limit, offset],
    queryFn: () => fetchApi(`/api/lotteries?limit=${limit}&offset=${offset}`),
  });
}

export function useLottery(address: string) {
  return useQuery({
    queryKey: ["lottery", address],
    queryFn: () => fetchApi(`/api/lotteries/${address}`),
    enabled: !!address,
  });
}

export function useLotteryRounds(address: string, limit = 20) {
  return useQuery({
    queryKey: ["lottery-rounds", address, limit],
    queryFn: () => fetchApi(`/api/lotteries/${address}/rounds?limit=${limit}`),
    enabled: !!address,
  });
}

export function useAgents(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["agents", limit, offset],
    queryFn: () => fetchApi(`/api/agents?limit=${limit}&offset=${offset}`),
  });
}

export function useAgent(address: string) {
  return useQuery({
    queryKey: ["agent", address],
    queryFn: () => fetchApi(`/api/agents/${address}`),
    enabled: !!address,
  });
}

export function useRecentDraws(limit = 20) {
  return useQuery({
    queryKey: ["draws", limit],
    queryFn: () => fetchApi(`/api/draws/recent?limit=${limit}`),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchApi<{
      activeLotteries: number;
      activeAgents: number;
      totalTickets: number;
      totalClaims: number;
      drawsToday: number;
      totalPrizePool: string;
    }>("/api/stats"),
    refetchInterval: 15_000,
  });
}
