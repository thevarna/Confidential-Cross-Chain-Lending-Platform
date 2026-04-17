/**
 * tRPC server initialization with Prisma context.
 */

import { initTRPC } from "@trpc/server";
import { PrismaClient } from "@prisma/client";
import { Connection } from "@solana/web3.js";
import superjson from "superjson";
import { SOLANA_RPC_URL } from "@/sdk/constants";

// ── Singleton instances ──
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const globalForConnection = globalThis as unknown as { connection: Connection };
export const connection =
  globalForConnection.connection ?? new Connection(SOLANA_RPC_URL, "confirmed");
if (process.env.NODE_ENV !== "production") globalForConnection.connection = connection;

// ── Context ──
export interface TRPCContext {
  prisma: PrismaClient;
  connection: Connection;
}

export const createContext = (): TRPCContext => ({
  prisma,
  connection,
});

// ── tRPC instance ──
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
