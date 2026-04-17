//! Repay a funded loan.
//!
//! **CRITICAL PATH: Ika Integration**
//!
//! This instruction:
//! 1. Transfers repayment (principal + interest) from borrower to lender
//! 2. CPIs to the Ika dWallet program to `approve_message` — requesting
//!    a cross-chain settlement signature via the borrower's dWallet
//! 3. The Ika network (mock signer in pre-alpha) then signs the message
//!    and commits the signature on-chain in the MessageApproval PDA
//!
//! ## Accounts
//!  0. `[writable]`   loan_account          — Loan PDA
//!  1. `[]`           config_account        — Config PDA
//!  2. `[signer]`     borrower              — Borrower wallet
//!  3. `[writable]`   borrower_token        — Borrower's DEMO-USDC ATA
//!  4. `[writable]`   lender_token          — Lender's DEMO-USDC ATA
//!  5. `[writable]`   escrow_token          — Escrow token account
//!  6. `[]`           escrow_authority       — Escrow PDA authority
//!  7. `[]`           token_program         — SPL Token program
//!  8. `[]`           dwallet_program       — Ika dWallet program (87W54...)
//!  9. `[]`           ika_cpi_authority     — This program's Ika CPI authority PDA
//! 10. `[]`           ika_caller_program    — This program's executable account
//! 11. `[]`           dwallet_coordinator   — DWalletCoordinator PDA (readonly)
//! 12. `[writable]`   message_approval      — MessageApproval PDA to create
//! 13. `[]`           dwallet_account       — The borrower's dWallet account
//! 14. `[writable, signer]` payer           — Rent payer
//! 15. `[]`           system_program        — System program
//!
//! ## Instruction Data (99 bytes)
//! - loan_id:               [u8; 16]
//! - settlement_msg_digest: [u8; 32] (keccak256 of settlement data)
//! - user_pubkey:           [u8; 32] (borrower's Ed25519 public key)
//! - signature_scheme:      u16 LE (DWalletSignatureScheme, 0 = Ed25519)
//! - approval_bump:         u8

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey,
    cpi::{Seed, Signer}, error::ProgramError, ProgramResult,
    sysvars::{clock::Clock, Sysvar},
};
use pinocchio_token::instructions::Transfer;

use crate::error::LendingError;
use crate::events;
use crate::state::{
    ConfigReader, LoanReader, LoanWriter, ESCROW_SEED, IKA_CPI_SEED, LOAN_SEED, STATUS_FUNDED,
    STATUS_REPAID,
};

use ika_dwallet_pinocchio::DWalletContext;

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // ── Parse accounts ──
    let [loan_account, config_account, borrower, borrower_token, lender_token, escrow_token, escrow_authority, _token_program, dwallet_program, ika_cpi_authority, ika_caller_program, dwallet_coordinator, message_approval, dwallet_account, payer, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── Validate borrower signer ──
    if !borrower.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    // ── Read config ──
    let config_data = config_account.try_borrow()?;
    let config = ConfigReader(&config_data);
    if !config.validate() {
        return Err(LendingError::InvalidAccountDiscriminator.into());
    }
    if config.is_paused() {
        return Err(LendingError::PlatformPaused.into());
    }
    drop(config_data);

    // ── Parse instruction data ──
    if data.len() < 83 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let loan_id: &[u8; 16] = data[0..16].try_into().unwrap();
    let settlement_msg_digest: [u8; 32] = data[16..48].try_into().unwrap();
    let user_pubkey: [u8; 32] = data[48..80].try_into().unwrap();
    let signature_scheme = u16::from_le_bytes(data[80..82].try_into().unwrap());
    let approval_bump = data[82];

    // ── Verify Loan PDA ──
    let (loan_pda, _) = Pubkey::find_program_address(&[LOAN_SEED, loan_id.as_ref()], program_id);
    if loan_account.address() != &loan_pda {
        return Err(LendingError::InvalidPdaDerivation.into());
    }

    // ── Read loan & validate ──
    let loan_data_ref = loan_account.try_borrow()?;
    let loan = LoanReader(&loan_data_ref);
    if !loan.validate() {
        return Err(LendingError::InvalidAccountDiscriminator.into());
    }
    if loan.status() != STATUS_FUNDED {
        return Err(LendingError::InvalidLoanStatus.into());
    }
    // Verify borrower is the original borrower
    if loan.borrower() != borrower.address().as_ref() {
        return Err(LendingError::NotAuthorized.into());
    }

    let loan_amount = loan.loan_amount();
    let interest_rate_bps = loan.interest_rate_bps();
    let due_date = loan.due_date();
    drop(loan_data_ref);

    // ── Check deadline ──
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    if now > due_date {
        return Err(LendingError::DeadlinePassed.into());
    }

    // ── Calculate repayment amount ──
    let interest = loan_amount * interest_rate_bps / 10000;
    let repayment_total = loan_amount + interest;

    // ── Transfer repayment from escrow back to lender ──
    // First: transfer from borrower → escrow (the repayment)
    Transfer {
        from: borrower_token,
        to: lender_token,
        authority: borrower,
        amount: repayment_total,
    }
    .invoke()?;

    // ── Transfer original loan from escrow → borrower ──
    let (_, escrow_bump) =
        Pubkey::find_program_address(&[ESCROW_SEED, loan_id.as_ref()], program_id);
    let escrow_bump_bytes = [escrow_bump];
    Transfer {
        from: escrow_token,
        to: borrower_token,
        authority: escrow_authority,
        amount: loan_amount,
    }
    .invoke_signed(&[Signer::from(&[
        Seed::from(ESCROW_SEED),
        Seed::from(loan_id.as_ref()),
        Seed::from(&escrow_bump_bytes),
    ])])?;

    // ── IKA INTEGRATION: Approve settlement message via dWallet CPI ──
    //
    // This is the core Ika integration. We CPI-call `approve_message` on the
    // dWallet program, which:
    //   1. Creates a MessageApproval PDA on-chain (status = Pending)
    //   2. The off-chain gRPC flow can then submit a Sign request with this
    //      approval as proof
    //   3. The Ika network signs the settlement message
    //   4. The signature is committed on-chain in the MessageApproval account
    //
    // The settlement message contains the loan repayment details that can be
    // used for cross-chain settlement (e.g., releasing collateral on another chain).
    let (_, ika_cpi_bump) = Pubkey::find_program_address(&[IKA_CPI_SEED], program_id);

    let dwallet_ctx = DWalletContext {
        dwallet_program,
        cpi_authority: ika_cpi_authority,
        caller_program: ika_caller_program,
        cpi_authority_bump: ika_cpi_bump,
    };

    // Approve the settlement message — requesting the dWallet to sign it.
    // message_metadata_digest is zero (no metadata for this use case).
    dwallet_ctx.approve_message(
        dwallet_coordinator,               // readonly — DWalletCoordinator PDA
        message_approval,                  // writable, empty — PDA to create
        dwallet_account,                   // readonly — the borrower's dWallet
        payer,                             // writable, signer — rent payer
        system_program,                    // readonly
        settlement_msg_digest,             // [u8; 32] — keccak256(settlement data)
        [0u8; 32],                         // [u8; 32] — no metadata digest
        user_pubkey,                       // [u8; 32] — borrower's public key
        signature_scheme,                  // u16 — DWalletSignatureScheme (0 = Ed25519)
        approval_bump,                     // u8 — MessageApproval PDA bump
    )?;

    // ── Update loan state ──
    let approval_key = message_approval.address().as_array();
    let mut loan_data = loan_account.try_borrow_mut()?;
    let mut writer = LoanWriter(&mut loan_data);
    writer.set_status(STATUS_REPAID);
    writer.set_repaid_at(now);
    writer.set_settlement_approval(approval_key);

    // ── Emit event ──
    events::emit_loan_repaid(loan_id, approval_key);

    Ok(())
}
