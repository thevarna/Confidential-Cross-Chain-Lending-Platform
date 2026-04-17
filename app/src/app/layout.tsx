"use client";

import "./globals.css";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { SOLANA_RPC_URL } from "@/sdk/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

const wallets = [new PhantomWalletAdapter()];

/** Root layout with all providers: Solana Wallet, tRPC, React Query. */
export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <html lang="en">
      <head>
        <title>Confidential Lending | Encrypt × Ika</title>
        <meta
          name="description"
          content="Privacy-preserving cross-chain lending on Solana. Powered by Encrypt FHE and Ika dWallet."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔒</text></svg>" />
      </head>
      <body>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <ConnectionProvider endpoint={SOLANA_RPC_URL}>
              <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
              </WalletProvider>
            </ConnectionProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </body>
    </html>
  );
}
