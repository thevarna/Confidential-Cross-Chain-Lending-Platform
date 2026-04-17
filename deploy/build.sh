#!/bin/bash
# Build the confidential-lending Solana program for SBF target.
set -euo pipefail

echo "🔨 Building confidential-lending program..."
cd "$(dirname "$0")/.."

# Build for Solana BPF/SBF target
cargo build-sbf --manifest-path programs/confidential-lending/Cargo.toml

echo "✅ Build complete!"
echo "   Program binary: target/deploy/confidential_lending.so"
