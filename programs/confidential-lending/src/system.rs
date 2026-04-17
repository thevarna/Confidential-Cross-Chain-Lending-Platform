//! Minimal System Program CPI helpers built against the workspace's Pinocchio version.

use pinocchio::{
    account::AccountView,
    address::Address,
    cpi::{invoke_signed, Signer},
    instruction::{InstructionAccount, InstructionView},
    ProgramResult,
};

/// Create a new account owned by `owner`.
pub struct CreateAccount<'a, 'b> {
    pub from: &'a AccountView,
    pub to: &'a AccountView,
    pub lamports: u64,
    pub space: u64,
    pub owner: &'b Address,
}

impl<'a, 'b> CreateAccount<'a, 'b> {
    #[inline(always)]
    pub fn invoke(&self) -> ProgramResult {
        self.invoke_signed(&[])
    }

    #[inline(always)]
    pub fn invoke_signed(&self, signers: &[Signer]) -> ProgramResult {
        let instruction_accounts = [
            InstructionAccount::writable_signer(self.from.address()),
            InstructionAccount::writable_signer(self.to.address()),
        ];

        let mut instruction_data = [0u8; 52];
        instruction_data[4..12].copy_from_slice(&self.lamports.to_le_bytes());
        instruction_data[12..20].copy_from_slice(&self.space.to_le_bytes());
        instruction_data[20..52].copy_from_slice(self.owner.as_ref());

        let instruction = InstructionView {
            program_id: &Address::new_from_array([0u8; 32]),
            accounts: &instruction_accounts,
            data: &instruction_data,
        };

        invoke_signed(&instruction, &[self.from, self.to], signers)
    }
}
