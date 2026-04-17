#!/bin/bash
# Deploy the confidential-lending program to Solana devnet.
set -euo pipefail

echo "🚀 Deploying confidential-lending to devnet..."
cd "$(dirname "$0")/.."

PROGRAM_SO="target/deploy/confidential_lending.so"

if [ ! -f "$PROGRAM_SO" ]; then
  echo "❌ Program binary not found. Run ./deploy/build.sh first."
  exit 1
fi

# Deploy to devnet
PROGRAM_ID=$(solana program deploy "$PROGRAM_SO" \
  --url https://api.devnet.solana.com \
  --keypair ~/.config/solana/id.json \
  --output json | grep programId | cut -d'"' -f4)

echo "✅ Deployed! Program ID: $PROGRAM_ID"

# Write to .env
if [ -f ".env" ]; then
  sed -i "s|LENDING_PROGRAM_ID=.*|LENDING_PROGRAM_ID=$PROGRAM_ID|" .env
  sed -i "s|NEXT_PUBLIC_LENDING_PROGRAM_ID=.*|NEXT_PUBLIC_LENDING_PROGRAM_ID=$PROGRAM_ID|" .env
else
  cp .env.example .env
  sed -i "s|<your_deployed_program_id>|$PROGRAM_ID|g" .env
fi

echo "   Updated .env with program ID"
echo ""
echo "Next steps:"
echo "  cd app && npm install && npm run db:push && npm run dev"
