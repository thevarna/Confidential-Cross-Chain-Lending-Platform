/**
 * tRPC Next.js API route handler.
 */

import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";

export default createNextApiHandler({
  router: appRouter,
  createContext: () => createContext(),
  onError: ({ error }) => {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      console.error("tRPC internal error:", error);
    }
  },
});
