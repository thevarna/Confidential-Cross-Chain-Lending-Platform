//! Encrypt FHE computation graph for loan term evaluation.
//!
//! This module defines the `#[encrypt_fn]` that places Encrypt's Fully
//! Homomorphic Encryption squarely in the **critical path** of loan creation.
//!
//! ## What it computes (all encrypted):
//! 1. **repayment_total** = principal + (principal × rate_bps / 10000)
//! 2. **ltv_bps** = (principal × 10000) / collateral_value
//!
//! ## How it integrates:
//! - The `#[encrypt_fn]` macro compiles this into a binary computation graph
//!   at compile time
//! - `create_loan` instruction calls `ctx.evaluate_loan_terms(...)` via CPI
//!   to the Encrypt program
//! - The off-chain Encrypt executor evaluates the graph on encrypted inputs
//!   and commits results back on-chain
//!
//! ## Pre-alpha note:
//! In the current pre-alpha, values are stored as plaintext. The same code
//! will operate on real REFHE ciphertexts when Encrypt reaches mainnet.

use encrypt_dsl::prelude::encrypt_fn;

/// Evaluates encrypted loan terms using FHE computation.
///
/// # Inputs (all encrypted)
/// - `principal`: Loan amount requested by the borrower
/// - `collateral_value`: Current value of the posted collateral
/// - `interest_rate_bps`: Annual interest rate in basis points (e.g. 500 = 5%)
///
/// # Outputs (all encrypted)
/// - `repayment_total`: Total amount the borrower must repay (principal + interest)
/// - `ltv_bps`: Loan-to-Value ratio in basis points (e.g. 5000 = 50%)
///
/// # FHE Operations Used
/// - Multiplication (3×)
/// - Division (2×)
/// - Addition (1×)
///
/// This graph produces 6 operation nodes + 3 inputs + 1 constant + 2 outputs
/// = 12 nodes total, well within Encrypt's per-graph limits.
#[encrypt_fn]
pub fn evaluate_loan_terms(
    principal: encrypt_types::encrypted::EUint64,
    collateral_value: encrypt_types::encrypted::EUint64,
    interest_rate_bps: encrypt_types::encrypted::EUint64,
) -> (
    encrypt_types::encrypted::EUint64,
    encrypt_types::encrypted::EUint64,
) {
    // ── Step 1: Compute repayment total ──
    // interest = principal × rate_bps / 10000
    let interest = principal * interest_rate_bps / 10000;
    let repayment_total = principal + interest;

    // ── Step 2: Compute LTV ratio ──
    // ltv_bps = (principal × 10000) / collateral_value
    let ltv_numerator = principal * 10000;
    let ltv_bps = ltv_numerator / collateral_value;

    (repayment_total, ltv_bps)
}

/// Helper to invoke the CPI internally without exporting the private trait
pub fn invoke_evaluate_loan_terms<'cpi, C: encrypt_dsl::cpi::EncryptCpi>(
    ctx: &'cpi C,
    principal: C::Account<'cpi>,
    collateral_value: C::Account<'cpi>,
    interest_rate_bps: C::Account<'cpi>,
    out_0: C::Account<'cpi>,
    out_1: C::Account<'cpi>,
) -> Result<(), C::Error> {
    ctx.evaluate_loan_terms(principal, collateral_value, interest_rate_bps, out_0, out_1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — run with `cargo test -p confidential-lending --lib`
// No SBF build needed; uses mock plaintext arithmetic.
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::evaluate_loan_terms;
    use encrypt_types::graph::{get_node, parse_graph, GraphNodeKind};
    use encrypt_types::identifier::{
        decode_mock_identifier, encode_mock_digest, mock_binary_compute, mock_select,
        mock_unary_compute,
    };
    use encrypt_types::types::FheType;

    fn run_mock(graph_fn: fn() -> Vec<u8>, inputs: &[u128], fhe_types: &[FheType]) -> Vec<u128> {
        let data = graph_fn();
        let pg = parse_graph(&data).unwrap();
        let num_nodes = pg.header().num_nodes() as usize;
        let mut digests: Vec<[u8; 32]> = Vec::with_capacity(num_nodes);
        let mut input_index = 0usize;

        for i in 0..num_nodes {
            let node = get_node(pg.node_bytes(), i as u16).unwrap();
            let fhe_type = FheType::from_u8(node.fhe_type()).unwrap_or(FheType::EUint64);

            let digest = match node.kind() {
                k if k == GraphNodeKind::Input as u8 => {
                    let value = inputs[input_index];
                    let input_type = fhe_types[input_index];
                    input_index += 1;
                    encode_mock_digest(input_type, value)
                }
                k if k == GraphNodeKind::Constant as u8 => {
                    let byte_width = fhe_type.byte_width().min(16);
                    let offset = node.const_offset() as usize;
                    let mut bytes = [0u8; 16];
                    bytes[..byte_width].copy_from_slice(&pg.constants()[offset..offset + byte_width]);
                    encode_mock_digest(fhe_type, u128::from_le_bytes(bytes))
                }
                k if k == GraphNodeKind::Op as u8 => {
                    let a = node.input_a() as usize;
                    let b = node.input_b() as usize;
                    let c = node.input_c() as usize;

                    if node.op_type() == 60 {
                        mock_select(&digests[a], &digests[b], &digests[c])
                    } else if b == 0xFFFF {
                        mock_unary_compute(
                            unsafe { core::mem::transmute(node.op_type()) },
                            &digests[a],
                            fhe_type,
                        )
                    } else {
                        mock_binary_compute(
                            unsafe { core::mem::transmute(node.op_type()) },
                            &digests[a],
                            &digests[b],
                            fhe_type,
                        )
                    }
                }
                k if k == GraphNodeKind::Output as u8 => digests[node.input_a() as usize],
                _ => panic!("unexpected graph node kind"),
            };

            digests.push(digest);
        }

        (0..num_nodes)
            .filter(|&i| get_node(pg.node_bytes(), i as u16).unwrap().kind() == GraphNodeKind::Output as u8)
            .map(|i| decode_mock_identifier(&digests[i]))
            .collect()
    }

    #[test]
    fn graph_has_correct_shape() {
        let graph_bytes = evaluate_loan_terms();
        let pg = parse_graph(&graph_bytes).unwrap();
        assert_eq!(pg.header().num_inputs(), 3, "expected 3 inputs");
        assert_eq!(pg.header().num_outputs(), 2, "expected 2 outputs");
    }

    #[test]
    fn standard_loan_calculation() {
        // 1000 SOL principal, 2000 SOL collateral, 5% interest (500 bps)
        let results = run_mock(
            evaluate_loan_terms,
            &[1000, 2000, 500],
            &[FheType::EUint64, FheType::EUint64, FheType::EUint64],
        );
        // repayment = 1000 + (1000 * 500 / 10000) = 1000 + 50 = 1050
        assert_eq!(results[0], 1050, "repayment_total should be 1050");
        // ltv = (1000 * 10000) / 2000 = 5000 bps = 50%
        assert_eq!(results[1], 5000, "ltv_bps should be 5000");
    }

    #[test]
    fn high_ltv_loan() {
        // 8000 principal, 10000 collateral, 10% interest (1000 bps)
        let results = run_mock(
            evaluate_loan_terms,
            &[8000, 10000, 1000],
            &[FheType::EUint64, FheType::EUint64, FheType::EUint64],
        );
        // repayment = 8000 + (8000 * 1000 / 10000) = 8000 + 800 = 8800
        assert_eq!(results[0], 8800);
        // ltv = (8000 * 10000) / 10000 = 8000 bps = 80%
        assert_eq!(results[1], 8000);
    }

    #[test]
    fn zero_interest_loan() {
        let results = run_mock(
            evaluate_loan_terms,
            &[5000, 10000, 0],
            &[FheType::EUint64, FheType::EUint64, FheType::EUint64],
        );
        // repayment = 5000 + 0 = 5000
        assert_eq!(results[0], 5000);
        // ltv = (5000 * 10000) / 10000 = 5000 bps
        assert_eq!(results[1], 5000);
    }

    #[test]
    fn over_collateralized_loan() {
        // 100 principal, 10000 collateral = very safe loan
        let results = run_mock(
            evaluate_loan_terms,
            &[100, 10000, 250],
            &[FheType::EUint64, FheType::EUint64, FheType::EUint64],
        );
        // repayment = 100 + (100 * 250 / 10000) = 100 + 2 = 102
        assert_eq!(results[0], 102);
        // ltv = (100 * 10000) / 10000 = 100 bps = 1%
        assert_eq!(results[1], 100);
    }
}
