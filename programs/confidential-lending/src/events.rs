//! On-chain event emission via Solana logs.
//!
//! Events are emitted as structured log lines that the frontend
//! can parse via `connection.onLogs` or transaction log inspection.
//!
//! Format: `EVENT:<type> <key>=<value> ...`

use solana_program_log::log as msg;

/// Emits a LoanCreated event to the transaction log.
pub fn emit_loan_created(loan_id: &[u8; 16], borrower: &[u8; 32], amount: u64) {
    msg!(
        "EVENT:LoanCreated loan_id={} borrower={} amount={}",
        &loan_id[..4],
        &borrower[..4],
        amount
    );
}

/// Emits a LoanFunded event to the transaction log.
pub fn emit_loan_funded(loan_id: &[u8; 16], lender: &[u8; 32], due_date: i64) {
    msg!(
        "EVENT:LoanFunded loan_id={} lender={} due_date={}",
        &loan_id[..4],
        &lender[..4],
        due_date
    );
}

/// Emits a LoanRepaid event to the transaction log.
pub fn emit_loan_repaid(loan_id: &[u8; 16], settlement_approval: &[u8; 32]) {
    msg!(
        "EVENT:LoanRepaid loan_id={} settlement={}",
        &loan_id[..4],
        &settlement_approval[..4]
    );
}

/// Emits a LoanDefaulted event to the transaction log.
pub fn emit_loan_defaulted(loan_id: &[u8; 16], liquidator: &[u8; 32]) {
    msg!(
        "EVENT:LoanDefaulted loan_id={} liquidator={}",
        &loan_id[..4],
        &liquidator[..4]
    );
}

/// Emits a LoanCancelled event to the transaction log.
pub fn emit_loan_cancelled(loan_id: &[u8; 16]) {
    msg!("EVENT:LoanCancelled loan_id={}", &loan_id[..4]);
}

/// Emits a ConfigUpdated event to the transaction log.
pub fn emit_config_updated(admin: &[u8; 32]) {
    msg!("EVENT:ConfigUpdated admin={}", &admin[..4]);
}

/// Emits a PlatformPaused event.
pub fn emit_paused() {
    msg!("EVENT:PlatformPaused");
}

/// Emits a PlatformUnpaused event.
pub fn emit_unpaused() {
    msg!("EVENT:PlatformUnpaused");
}
