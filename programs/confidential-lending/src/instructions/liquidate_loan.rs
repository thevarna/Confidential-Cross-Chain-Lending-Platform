//! Liquidate a defaulted loan.
//!
//! Anyone can call this after the due_date has passed on a funded loan.
//! Marks the loan as Defaulted and transfers escrow funds to the lender.
//!
//! ## Accounts
//! 0. `[writable]`   loan_account    — Loan PDA
//! 1. `[]`           config_account  — Config PDA
//! 2. `[signer]`     liquidator      — Caller (admin or lender)
//! 3. `[writable]`   escrow_token    — Escrow token account
//! 4. `[writable]`   lender_token    — Lender's token account
//! 5. `[]`           escrow_authority — Escrow PDA authority
//! 6. `[]`           token_program   — SPL Token program
//!
//! ## Instruction Data (16 bytes)
//! - loan_id: [u8; 16]

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey,
    cpi::{Seed, Signer}, error::ProgramError, ProgramResult,
    sysvars::{clock::Clock, Sysvar},
};
use pinocchio_token::instructions::Transfer;

use crate::error::LendingError;
use crate::events;
use crate::state::{
    ConfigReader, LoanReader, LoanWriter, ESCROW_SEED, LOAN_SEED, STATUS_DEFAULTED, STATUS_FUNDED,
};

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // ── Parse accounts ──
    let [loan_account, config_account, liquidator, escrow_token, lender_token, escrow_authority, _token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── Validate signer ──
    if !liquidator.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    // ── Read config ──
    let config_data = config_account.try_borrow()?;
    let config = ConfigReader(&config_data);
    if !config.validate() {
        return Err(LendingError::InvalidAccountDiscriminator.into());
    }
    drop(config_data);

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
    if loan.status() != STATUS_FUNDED {
        return Err(LendingError::InvalidLoanStatus.into());
    }

    let due_date = loan.due_date();
    let loan_amount = loan.loan_amount();
    drop(loan_data_ref);

    // ── Check deadline has passed ──
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    if now <= due_date {
        return Err(LendingError::DeadlineNotReached.into());
    }

    // ── Transfer escrow funds to lender ──
    let (_, escrow_bump) =
        Pubkey::find_program_address(&[ESCROW_SEED, loan_id.as_ref()], program_id);
    let escrow_bump_bytes = [escrow_bump];
    Transfer {
        from: escrow_token,
        to: lender_token,
        authority: escrow_authority,
        amount: loan_amount,
    }
    .invoke_signed(&[Signer::from(&[
        Seed::from(ESCROW_SEED),
        Seed::from(loan_id.as_ref()),
        Seed::from(&escrow_bump_bytes),
    ])])?;

    // ── Update loan state ──
    let liquidator_key = liquidator.address().as_array();
    let mut loan_data = loan_account.try_borrow_mut()?;
    let mut writer = LoanWriter(&mut loan_data);
    writer.set_status(STATUS_DEFAULTED);

    // ── Emit event ──
    events::emit_loan_defaulted(loan_id, liquidator_key);

    Ok(())
}
