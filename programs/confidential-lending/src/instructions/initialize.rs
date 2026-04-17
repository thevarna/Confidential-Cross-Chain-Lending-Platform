//! Initialize the lending platform.
//!
//! Creates the Config PDA and sets the admin, loan currency mint,
//! and risk parameters.
//!
//! ## Accounts
//! 0. `[writable]`   config_pda     — PDA to create (["config"])
//! 1. `[signer]`     admin          — Platform administrator
//! 2. `[]`           system_program — System program
//!
//! ## Instruction Data (88 bytes)
//! - loan_currency_mint: [u8; 32]
//! - max_ltv_bps:        u64 LE
//! - min_duration:       i64 LE (seconds)
//! - max_duration:       i64 LE (seconds)

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey,
    cpi::{Seed, Signer}, error::ProgramError, ProgramResult,
    sysvars::{rent::Rent, Sysvar},
};

use crate::error::LendingError;
use crate::events;
use crate::state::{self, ConfigWriter, CONFIG_SEED, CONFIG_SIZE};
use crate::system::CreateAccount;

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // ── Parse accounts ──
    let [config_account, admin, _system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Admin must be signer
    if !admin.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    // ── Parse instruction data ──
    if data.len() < 56 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let loan_currency_mint: &[u8; 32] = data[0..32].try_into().unwrap();
    let max_ltv_bps = u64::from_le_bytes(data[32..40].try_into().unwrap());
    let min_duration = i64::from_le_bytes(data[40..48].try_into().unwrap());
    let max_duration = i64::from_le_bytes(data[48..56].try_into().unwrap());

    // ── Validate parameters ──
    if max_ltv_bps == 0 || max_ltv_bps > 10000 {
        return Err(LendingError::LtvExceedsMaximum.into());
    }
    if min_duration <= 0 || max_duration <= 0 || min_duration > max_duration {
        return Err(LendingError::InvalidDuration.into());
    }

    // ── Derive Config PDA ──
    let (config_pda, bump) = state::find_config_pda(program_id);
    if config_account.address() != &config_pda {
        return Err(LendingError::InvalidPdaDerivation.into());
    }

    // ── Create the Config account via CPI ──
    let bump_bytes = [bump];
    CreateAccount {
        from: admin,
        to: config_account,
        lamports: Rent::get()?.try_minimum_balance(CONFIG_SIZE)?,
        space: CONFIG_SIZE as u64,
        owner: program_id,
    }
    .invoke_signed(&[Signer::from(&[
        Seed::from(CONFIG_SEED),
        Seed::from(&bump_bytes),
    ])])?;

    // ── Write config data ──
    let mut config_data = config_account.try_borrow_mut()?;
    let admin_key = admin.address().as_array();
    let mut writer = ConfigWriter(&mut config_data);
    writer.init(
        admin_key,
        loan_currency_mint,
        max_ltv_bps,
        min_duration,
        max_duration,
        bump,
    );

    // ── Emit event ──
    events::emit_config_updated(admin_key);

    Ok(())
}
