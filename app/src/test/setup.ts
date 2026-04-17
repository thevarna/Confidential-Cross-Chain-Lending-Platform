import { appRouter } from "@/server/routers/_app";
import { prisma, connection } from "@/server/trpc";

// Ensure the caller is available globally for the tests
export const api = appRouter.createCaller({
  prisma,
  connection,
});
