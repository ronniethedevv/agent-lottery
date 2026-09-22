"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WebSocketProvider } from "@/hooks/useWebSocket";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchInterval: 30_000,
          },
        },
      })
  );

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider url={wsUrl}>{children}</WebSocketProvider>
    </QueryClientProvider>
  );
}
