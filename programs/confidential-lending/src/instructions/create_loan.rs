//! Create a new confidential loan request.
//!
//! **CRITICAL PATH: Encrypt Integration**
//!
//! This instruction:
//! 1. Creates the Loan PDA
//! 2. Creates plaintext ciphertext accounts for principal, collateral, and rate
//! 3. Executes the `evaluate_loan_terms` FHE graph via CPI to the Encrypt program
//! 4. Stores the output ciphertext references (repayment_total, ltv_bps) in the loan
//!
//! ## Accounts
//!  0. `[writable]`   loan_account          — PDA to create (["loan", loan_id])
//!  1. `[writable]`   config_account        — Config PDA (["config"])
//!  2. `[signer]`     borrower              — Borrower wallet
//!  3. `[]`           encrypt_program       — Encrypt program (4ebfz...)
//!  4. `[]`           encrypt_config        — Encrypt program's config PDA
//!  5. `[writable]`   encrypt_deposit       — Encrypt deposit account for fees
//!  6. `[]`           encrypt_cpi_authority  — This program's Encrypt CPI authority PDA
//!  7. `[]`           caller_program        — This program's executable account
//!  8. `[]`           network_encryption_key — Current Encrypt network key
//!  9. `[writable]`   principal_ct          — Ciphertext account for principal
//! 10. `[writable]`   collateral_ct         — Ciphertext account for collateral value
//! 11. `[writable]`   rate_ct              — Ciphertext account for interest rate
//! 12. `[writable]`   repayment_out_ct     — Output ciphertext for repayment total
//! 13. `[writable]`   ltv_out_ct           — Output ciphertext for LTV bps
//! 14. `[writable, signer]` payer          — Rent payer
//! 15. `[]`           event_authority       — Encrypt event authority
//! 16. `[]`           system_program        — System program
//!
//! ## Instruction Data (112 bytes)
//! - loan_id:           [u8; 16]
//! - collateral_mint:   [u8; 32]
//! - collateral_amount: u64 LE
//! - loan_amount:       u64 LE
//! - interest_rate_bps: u64 LE
//! - duration_seconds:  i64 LE
//! - dwallet_pubkey:    [u8; 32]

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey,
    cpi::{Seed, Signer}, error::ProgramError, ProgramResult,
    sysvars::{clock::Clock, rent::Rent, Sysvar},
};

use crate::error::LendingError;
use crate::events;
use crate::state::{
    ConfigReader, LoanWriter, ENCRYPT_CPI_SEED, LOAN_SEED, LOAN_SIZE,
};
use crate::system::CreateAccount;

// The FHE graph logic is defined in `graph.rs`. We use a helper function to
// invoke it via CPI since the macro-generated trait is private to that module.
use encrypt_pinocchio::EncryptContext;
use encrypt_types::encrypted::Uint64;

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // ── Parse accounts ──
    let [loan_account, config_account, borrower, encrypt_program, encrypt_config, encrypt_deposit, encrypt_cpi_authority, caller_program, network_encryption_key, principal_ct, collateral_ct, rate_ct, repayment_out_ct, ltv_out_ct, payer, event_authority, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── Validate signer ──
    if !borrower.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    // ── Read & validate config ──
    let config_data = config_account.try_borrow()?;
    let config = ConfigReader(&config_data);
    if !config.validate() {
        return Err(LendingError::InvalidAccountDiscriminator.into());
    }
    if config.is_paused() {
        return Err(LendingError::PlatformPaused.into());
    }

    // ── Parse instruction data ──
    if data.len() < 112 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let loan_id: &[u8; 16] = data[0..16].try_into().unwrap();
    let collateral_mint: &[u8; 32] = data[16..48].try_into().unwrap();
    let collateral_amount = u64::from_le_bytes(data[48..56].try_into().unwrap());
    let loan_amount = u64::from_le_bytes(data[56..64].try_into().unwrap());
    let interest_rate_bps = u64::from_le_bytes(data[64..72].try_into().unwrap());
    let duration_seconds = i64::from_le_bytes(data[72..80].try_into().unwrap());
    let dwallet_pubkey: &[u8; 32] = data[80..112].try_into().unwrap();

    // ── Validate loan parameters ──
    if loan_amount == 0 {
        return Err(LendingError::ZeroLoanAmount.into());
    }
    if duration_seconds < config.min_duration() || duration_seconds > config.max_duration() {
        return Err(LendingError::InvalidDuration.into());
    }

    // ── Derive Loan PDA ──
    let (loan_pda, loan_bump) =
        Pubkey::find_program_address(&[LOAN_SEED, loan_id.as_ref()], program_id);
    if loan_account.address() != &loan_pda {
        return Err(LendingError::InvalidPdaDerivation.into());
    }

    // ── Create the Loan account ──
    let bump_bytes = [loan_bump];
    CreateAccount {
        from: payer,
        to: loan_account,
        lamports: Rent::get()?.try_minimum_balance(LOAN_SIZE)?,
        space: LOAN_SIZE as u64,
        owner: program_id,
    }
    .invoke_signed(&[Signer::from(&[
        Seed::from(LOAN_SEED),
        Seed::from(loan_id.as_ref()),
        Seed::from(&bump_bytes),
    ])])?;

    // ── Get clock for timestamp ──
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // ── ENCRYPT INTEGRATION: Create ciphertexts & execute FHE graph ──
    //
    // The Encrypt CPI authority is derived from this program's ID:
    //   PDA(["__encrypt_cpi_authority"], our_program_id)
    let (_, encrypt_cpi_bump) = Pubkey::find_program_address(&[ENCRYPT_CPI_SEED], program_id);

    let encrypt_ctx = EncryptContext {
        encrypt_program,
        config: encrypt_config,
        deposit: encrypt_deposit,
        cpi_authority: encrypt_cpi_authority,
        caller_program,
        network_encryption_key,
        payer,
        event_authority,
        system_program,
        cpi_authority_bump: encrypt_cpi_bump,
    };

    // Step 1: Create plaintext ciphertext accounts for each input
    // These will be encrypted by the Encrypt executor off-chain.
    encrypt_ctx.create_plaintext_typed::<Uint64>(&loan_amount, principal_ct)?;
    encrypt_ctx.create_plaintext_typed::<Uint64>(&collateral_amount, collateral_ct)?;
    encrypt_ctx.create_plaintext_typed::<Uint64>(&interest_rate_bps, rate_ct)?;

    // Step 2: Execute the evaluate_loan_terms FHE graph via CPI
    // This triggers the Encrypt program to:
    //   a) Validate input ciphertext types match the graph
    //   b) Write pending output ciphertext accounts
    //   c) Emit an event for the off-chain executor to evaluate
    //
    // The executor will compute:
    //   repayment_total = principal + (principal * rate / 10000)
    //   ltv_bps = (principal * 10000) / collateral_value
    //
    // All arithmetic happens on encrypted values (plaintext in pre-alpha).
    crate::graph::invoke_evaluate_loan_terms(
        &encrypt_ctx,
        principal_ct,       // input[0]: principal (EUint64)
        collateral_ct,      // input[1]: collateral_value (EUint64)
        rate_ct,            // input[2]: interest_rate_bps (EUint64)
        repayment_out_ct,   // output[0]: repayment_total (EUint64)
        ltv_out_ct,         // output[1]: ltv_bps (EUint64)
    )?;

    // ── Write loan state ──
    let repayment_key = repayment_out_ct.address().as_array();
    let ltv_key = ltv_out_ct.address().as_array();
    let borrower_key = borrower.address().as_array();

    let mut loan_data = loan_account.try_borrow_mut()?;
    let mut writer = LoanWriter(&mut loan_data);
    writer.init(
        loan_id,
        borrower_key,
        collateral_mint,
        collateral_amount,
        loan_amount,
        interest_rate_bps,
        duration_seconds,
        dwallet_pubkey,
        repayment_key,
        ltv_key,
        now,
        loan_bump,
    );

    // ── Emit event ──
    events::emit_loan_created(loan_id, borrower_key, loan_amount);

    Ok(())
}
