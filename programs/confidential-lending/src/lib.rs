//! Confidential Cross-Chain Lending Program
//!
//! A Solana-native lending protocol combining:
//! - **Encrypt** (FHE) for privacy-preserving loan term evaluation
//! - **Ika** (dWallet) for cross-chain settlement authorization
//!
//! Built with Pinocchio for maximum CU efficiency and sponsor SDK compatibility.

use pinocchio::{
    account::AccountView as AccountInfo, address::Address as Pubkey, entrypoint,
    error::ProgramError, ProgramResult,
};

pub mod error;
pub mod events;
pub mod graph;
pub mod instructions;
pub mod state;
pub mod system;

entrypoint!(process_instruction);

/// Main instruction dispatcher.
///
/// | Disc | Instruction       | Sponsor Integration       |
/// |------|-------------------|---------------------------|
/// | 0    | Initialize        | —                         |
/// | 1    | CreateLoan        | Encrypt (FHE graph CPI)   |
/// | 2    | FundLoan          | —                         |
/// | 3    | RepayLoan         | Ika (approve_message CPI) |
/// | 4    | LiquidateLoan     | —                         |
/// | 5    | CancelLoan        | —                         |
/// | 6    | UpdateConfig      | —                         |
/// | 7    | Pause             | —                         |
/// | 8    | Unpause           | —                         |
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    let (discriminator, rest) = data.split_first().unwrap();

    match discriminator {
        0 => instructions::initialize::process(program_id, accounts, rest),
        1 => instructions::create_loan::process(program_id, accounts, rest),
        2 => instructions::fund_loan::process(program_id, accounts, rest),
        3 => instructions::repay_loan::process(program_id, accounts, rest),
        4 => instructions::liquidate_loan::process(program_id, accounts, rest),
        5 => instructions::cancel_loan::process(program_id, accounts, rest),
        6 => instructions::admin::process_update_config(program_id, accounts, rest),
        7 => instructions::admin::process_pause(program_id, accounts, rest),
        8 => instructions::admin::process_unpause(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
