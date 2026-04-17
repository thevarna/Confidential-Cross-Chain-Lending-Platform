//! Admin instructions: update_config, pause, unpause.
//!
//! All three require the admin signer to match the Config.admin field.

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey, error::ProgramError,
    ProgramResult,
};

use crate::error::LendingError;
use crate::events;
use crate::state::{ConfigReader, ConfigWriter, CONFIG_SEED};

// ─────────────────────────────────────────────────────────────────────────────
// UpdateConfig (disc 6)
// ─────────────────────────────────────────────────────────────────────────────
//
// ## Accounts
// 0. `[writable]`  config_account  — Config PDA
// 1. `[signer]`    admin           — Admin wallet
//
// ## Instruction Data (24 bytes)
// - max_ltv_bps:    u64 LE
// - min_duration:   i64 LE
// - max_duration:   i64 LE

pub fn process_update_config(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let [config_account, admin] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !admin.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    // Verify PDA
    let (config_pda, _) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(LendingError::InvalidPdaDerivation.into());
    }

    // Verify admin
    {
        let config_data = config_account.try_borrow()?;
        let config = ConfigReader(&config_data);
        if !config.validate() {
            return Err(LendingError::InvalidAccountDiscriminator.into());
        }
        if config.admin() != admin.address().as_ref() {
            return Err(LendingError::NotAuthorized.into());
        }
    }

    // Parse data
    if data.len() < 24 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let max_ltv_bps = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let min_duration = i64::from_le_bytes(data[8..16].try_into().unwrap());
    let max_duration = i64::from_le_bytes(data[16..24].try_into().unwrap());

    // Validate
    if max_ltv_bps == 0 || max_ltv_bps > 10000 {
        return Err(LendingError::LtvExceedsMaximum.into());
    }
    if min_duration <= 0 || max_duration <= 0 || min_duration > max_duration {
        return Err(LendingError::InvalidDuration.into());
    }

    // Write
    let mut config_data = config_account.try_borrow_mut()?;
    let mut writer = ConfigWriter(&mut config_data);
    writer.set_max_ltv_bps(max_ltv_bps);
    writer.set_min_duration(min_duration);
    writer.set_max_duration(max_duration);

    let admin_key = admin.address().as_array();
    events::emit_config_updated(admin_key);

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Pause (disc 7)
// ─────────────────────────────────────────────────────────────────────────────
//
// ## Accounts
// 0. `[writable]`  config_account  — Config PDA
// 1. `[signer]`    admin           — Admin wallet

pub fn process_pause(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> ProgramResult {
    let [config_account, admin] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_admin(program_id, config_account, admin)?;

    let mut config_data = config_account.try_borrow_mut()?;
    let mut writer = ConfigWriter(&mut config_data);
    writer.set_paused(true);

    events::emit_paused();
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Unpause (disc 8)
// ─────────────────────────────────────────────────────────────────────────────
//
// ## Accounts
// 0. `[writable]`  config_account  — Config PDA
// 1. `[signer]`    admin           — Admin wallet

pub fn process_unpause(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _data: &[u8],
) -> ProgramResult {
    let [config_account, admin] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    verify_admin(program_id, config_account, admin)?;

    let mut config_data = config_account.try_borrow_mut()?;
    let mut writer = ConfigWriter(&mut config_data);
    writer.set_paused(false);

    events::emit_unpaused();
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared admin verification
// ─────────────────────────────────────────────────────────────────────────────

fn verify_admin(
    program_id: &Pubkey,
    config_account: &AccountInfo,
    admin: &AccountInfo,
) -> ProgramResult {
    if !admin.is_signer() {
        return Err(LendingError::NotAuthorized.into());
    }

    let (config_pda, _) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    if config_account.address() != &config_pda {
        return Err(LendingError::InvalidPdaDerivation.into());
    }

    let config_data = config_account.try_borrow()?;
    let config = ConfigReader(&config_data);
    if !config.validate() {
        return Err(LendingError::InvalidAccountDiscriminator.into());
    }
    if config.admin() != admin.address().as_ref() {
        return Err(LendingError::NotAuthorized.into());
    }

    Ok(())
}
