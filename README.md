# 🔒 Confidential Cross-Chain Lending Platform

> **Privacy-preserving lending on Solana** — powered by **Encrypt FHE** and **Ika dWallet**.

Built for the **Colosseum Frontier / Superteam Hackathon** (April 2026).

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (Next.js + React + Wallet Adapter)             │
├──────────────────────────────────────────────────────────┤
│  API Layer (tRPC + Prisma/SQLite)                        │
├──────────────────────────────────────────────────────────┤
│  On-Chain Program (Pinocchio)                            │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Loan Lifecycle │──│ Encrypt CPI   │──│ Ika CPI     │  │
│  │ (9 inst.)     │  │ (FHE graph)   │  │ (dWallet)    │  │
│  └───────────────┘  └───────────────┘  └──────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Encrypt Program        │  Ika dWallet Program           │
│  4ebfz...rND8           │  87W54...q1oY                  │
└──────────────────────────────────────────────────────────┘
```

### Sponsor Integration (Critical Path)

| Sponsor | Where | What |
|---------|-------|------|
| **Encrypt** | `create_loan` instruction | FHE graph computes encrypted repayment total + LTV ratio via CPI |
| **Ika** | `repay_loan` instruction | dWallet `approve_message` CPI creates cross-chain settlement signature |

---

## ⚠️ Pre-Alpha Disclaimer

Both sponsor SDKs are **pre-alpha**:
- **Encrypt:** No real encryption — all data is plaintext on-chain
- **Ika:** No real MPC signing — single mock signer

This is a **demonstration application**. Do not submit real secrets or financial data.

---

## 🚀 Quick Start

### Prerequisites

- Rust 1.78+ with `cargo-build-sbf`
- Solana CLI 2.x
- Node.js 18+ (or Bun)
- A Solana devnet wallet with SOL

### 1. Build the Program

```bash
chmod +x deploy/build.sh deploy/deploy.sh
./deploy/build.sh
```

### 2. Deploy to Devnet

```bash
./deploy/deploy.sh
```

### 3. Start the Web App

```bash
cd app
cp ../.env.example .env.local  # Edit with your program ID
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run Tests

```bash
# Unit tests (FHE graph — no SBF needed)
cargo test -p confidential-lending --lib

# All tests (requires SBF build)
cargo test -p confidential-lending
```

---

## 📁 Project Structure

```
├── programs/confidential-lending/    # Solana program (Pinocchio)
│   └── src/
│       ├── lib.rs                    # Entrypoint + dispatch
│       ├── state.rs                  # Account layouts (Config, Loan)
│       ├── graph.rs                  # Encrypt #[encrypt_fn] FHE graph
│       ├── instructions/
│       │   ├── create_loan.rs        # ← Encrypt CPI (FHE graph)
│       │   ├── repay_loan.rs         # ← Ika CPI (dWallet approval)
│       │   └── ...                   # fund, liquidate, cancel, admin
│       ├── error.rs                  # 19 custom errors
│       └── events.rs                 # Structured log events
├── app/                              # Next.js web application
│   ├── prisma/schema.prisma          # SQLite schema (Loan, DWallet)
│   ├── src/
│   │   ├── sdk/                      # TypeScript program client
│   │   ├── server/routers/           # tRPC routers (loan, dwallet, encrypt)
│   │   ├── components/               # React UI components
│   │   └── app/                      # Next.js pages
│   └── package.json
└── deploy/                           # Build + deploy scripts
```

---

## 🧪 FHE Graph: `evaluate_loan_terms`

The core Encrypt integration — a fully homomorphic computation that evaluates
loan terms on encrypted values:

```rust
#[encrypt_fn]
pub fn evaluate_loan_terms(
    principal: EUint64,
    collateral_value: EUint64,
    interest_rate_bps: EUint64,
) -> (EUint64, EUint64) {
    let interest = principal * interest_rate_bps / 10000;
    let repayment_total = principal + interest;
    let ltv_bps = principal * 10000 / collateral_value;
    (repayment_total, ltv_bps)
}
```

**Operations:** 3× multiply, 2× divide, 1× add → 12 graph nodes total.

---

## 🌐 dWallet Integration: Cross-Chain Settlement

On loan repayment, the program CPIs to Ika's dWallet program:

```rust
dwallet_ctx.approve_message(
    coordinator,
    message_approval,    // ← PDA created on-chain
    dwallet_account,
    payer,
    system_program,
    settlement_msg_digest,   // keccak256(settlement data)
    [0u8; 32],               // no metadata
    user_pubkey,
    signature_scheme,        // Ed25519
    approval_bump,
)?;
```

The Ika network then signs the settlement message and commits the signature on-chain.

---

## 🔧 Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Pinocchio** over Anchor | Encrypt requires anchor-lang 0.32, Ika requires 1.x — incompatible. Both support pinocchio 0.10. |
| **Custom DEMO-USDC** token | Devnet USDC faucet is unreliable during hackathons |
| **SQLite** via Prisma | Zero external dependencies, instant setup |
| **tRPC** for API | End-to-end type safety between frontend and backend |

---

## 📋 Hackathon Criteria Mapping

| Criterion | How We Satisfy It |
|-----------|------------------|
| **Functionality** | Complete loan lifecycle (create → fund → repay/default) with both sponsors in critical path |
| **Innovation** | First lending protocol combining FHE privacy + dWallet settlement |
| **User Experience** | Premium dark UI, sponsor explainer panel, real-time event log |
| **Documentation** | This README + inline code docs + architecture diagrams |
| **Performance** | Pinocchio for maximum CU efficiency |

---

## 📖 Sponsor Documentation

- [Encrypt SDK Docs](https://docs.encrypt.xyz/)
- [Ika dWallet Docs](https://solana-pre-alpha.ika.xyz/)
- [Hackathon Listing](https://superteam.fun/earn/listing/encrypt-ika-frontier-april-2026)

---

## 📜 License

MIT
