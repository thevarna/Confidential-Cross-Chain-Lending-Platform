//! Cancel a loan request.
//!
//! Only the borrower can cancel, and only before the loan is funded.
//!
//! ## Accounts
//! 0. `[writable]`   loan_account   — Loan PDA
//! 1. `[signer]`     borrower       — Borrower wallet (must match loan)
//!
//! ## Instruction Data (16 bytes)
//! - loan_id: [u8; 16]

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey, error::ProgramError,
    ProgramResult,
};

use crate::error::LendingError;
use crate::events;
use crate::state::{LoanReader, LoanWriter, LOAN_SEED, STATUS_CANCELLED, STATUS_REQUESTED};

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // ── Parse accounts ──
    let [loan_account, borrower] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── Validate signer ──
    if !borrower.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    // ── Parse instruction data ──
    if data.len() < 16 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let loan_id: &[u8; 16] = data[0..16].try_into().unwrap();

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
    // Can only cancel if still in Requested status
    if loan.status() != STATUS_REQUESTED {
        return Err(LendingError::InvalidLoanStatus.into());
    }
    // Must be the original borrower
    if loan.borrower() != borrower.address().as_ref() {
        return Err(LendingError::NotAuthorized.into());
    }
    drop(loan_data_ref);

    // ── Update status ──
    let mut loan_data = loan_account.try_borrow_mut()?;
    let mut writer = LoanWriter(&mut loan_data);
    writer.set_status(STATUS_CANCELLED);

    // ── Emit event ──
    events::emit_loan_cancelled(loan_id);

    Ok(())
}
