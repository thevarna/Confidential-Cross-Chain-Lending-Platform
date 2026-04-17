/**
 * Client-side tRPC hooks + React Query provider.
 */

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers/_app";

/** tRPC React hooks — use these in components. */
export const trpc = createTRPCReact<AppRouter>();

/** Create the tRPC client with superjson transformer. */
export function createTRPCClient() {
  return trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: "/api/trpc",
      }),
    ],
  });
}
