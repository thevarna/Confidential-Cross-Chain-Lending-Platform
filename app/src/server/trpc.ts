/**
 * tRPC server initialization with Prisma context.
 */

import { initTRPC } from "@trpc/server";
import { PrismaClient } from "../generated/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { Connection } from "@solana/web3.js";
import superjson from "superjson";
import { SOLANA_RPC_URL } from "@/sdk/constants";

// ── Singleton instances ──
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getPrismaClient() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  // Create the adapter with the connection object
  const adapter = new PrismaBetterSqlite3({ 
    url: "file:./prisma/dev.db" 
  });
  
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();

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
