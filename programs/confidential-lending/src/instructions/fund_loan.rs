//! Fund a loan request.
//!
//! A lender transfers the loan_amount of DEMO-USDC into the escrow
//! token account, activating the loan and setting the due date.
//!
//! ## Accounts
//! 0. `[writable]`   loan_account     — Loan PDA
//! 1. `[]`           config_account   — Config PDA
//! 2. `[signer]`     lender           — Lender wallet
//! 3. `[writable]`   lender_token     — Lender's DEMO-USDC ATA
//! 4. `[writable]`   escrow_token     — Escrow token account (PDA-owned)
//! 5. `[]`           token_program    — SPL Token program
//! 6. `[]`           clock_sysvar     — Clock sysvar for timestamp
//!
//! ## Instruction Data (16 bytes)
//! - loan_id: [u8; 16]

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey, error::ProgramError,
    ProgramResult, sysvars::{clock::Clock, Sysvar},
};
use pinocchio_token::instructions::Transfer;

use crate::error::LendingError;
use crate::events;
use crate::state::{
    ConfigReader, LoanReader, LoanWriter, LOAN_SEED, STATUS_FUNDED, STATUS_REQUESTED,
};

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // ── Parse accounts ──
    let [loan_account, config_account, lender, lender_token, escrow_token, _token_program, _clock_sysvar] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── Validate signer ──
    if !lender.is_signer() {
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

    // ── Read loan & validate status ──
    {
        let loan_data = loan_account.try_borrow()?;
        let loan = LoanReader(&loan_data);
        if !loan.validate() {
            return Err(LendingError::InvalidAccountDiscriminator.into());
        }
        if loan.status() != STATUS_REQUESTED {
            return Err(LendingError::InvalidLoanStatus.into());
        }
    }

    // ── Get clock ──
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // ── Read loan amount and duration for the transfer ──
    let loan_data_ref = loan_account.try_borrow()?;
    let loan = LoanReader(&loan_data_ref);
    let loan_amount = loan.loan_amount();
    let duration = loan.duration_seconds();
    let due_date = now + duration;
    drop(loan_data_ref);

    // ── Transfer DEMO-USDC from lender to escrow ──
    Transfer {
        from: lender_token,
        to: escrow_token,
        authority: lender,
        amount: loan_amount,
    }
    .invoke()?;

    // ── Update loan state ──
    let mut loan_data = loan_account.try_borrow_mut()?;
    let lender_key = lender.address().as_array();
    let mut writer = LoanWriter(&mut loan_data);
    writer.set_lender(lender_key);
    writer.set_status(STATUS_FUNDED);
    writer.set_due_date(due_date);
    writer.set_funded_at(now);

    // ── Emit event ──
    events::emit_loan_funded(loan_id, lender_key, due_date);

    Ok(())
}
