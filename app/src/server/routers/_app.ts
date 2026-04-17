/**
 * Root tRPC router — merges all sub-routers.
 */

import { router } from "../trpc";
import { loanRouter } from "./loan";
import { dwalletRouter } from "./dwallet";
import { encryptRouter } from "./encrypt";

export const appRouter = router({
  loan: loanRouter,
  dwallet: dwalletRouter,
  encrypt: encryptRouter,
});

/** Export the router type for client-side type inference. */
export type AppRouter = typeof appRouter;
