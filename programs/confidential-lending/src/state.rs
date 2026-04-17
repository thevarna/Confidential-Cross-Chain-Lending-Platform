//! Account layouts and PDA helpers for the confidential lending program.
//!
//! All accounts are manually serialized as flat byte arrays for Pinocchio.
//! Each struct provides `const` offsets, size, and typed accessor methods.

use pinocchio::address::Address as Pubkey;

// ─────────────────────────────────────────────────────────────────────────────
// Discriminators
// ─────────────────────────────────────────────────────────────────────────────

pub const CONFIG_DISCRIMINATOR: u8 = 1;
pub const LOAN_DISCRIMINATOR: u8 = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Loan Status
// ─────────────────────────────────────────────────────────────────────────────

pub const STATUS_REQUESTED: u8 = 0;
pub const STATUS_FUNDED: u8 = 1;
pub const STATUS_REPAID: u8 = 2;
pub const STATUS_DEFAULTED: u8 = 3;
pub const STATUS_CANCELLED: u8 = 4;

// ─────────────────────────────────────────────────────────────────────────────
// PDA Seeds
// ─────────────────────────────────────────────────────────────────────────────

pub const CONFIG_SEED: &[u8] = b"config";
pub const LOAN_SEED: &[u8] = b"loan";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const DEMO_MINT_SEED: &[u8] = b"demo_mint";

/// Encrypt CPI authority PDA seed (from Encrypt docs).
pub const ENCRYPT_CPI_SEED: &[u8] = b"__encrypt_cpi_authority";

/// Ika CPI authority PDA seed (from Ika docs).
pub const IKA_CPI_SEED: &[u8] = b"__ika_cpi_authority";

// ─────────────────────────────────────────────────────────────────────────────
// Sponsor Program IDs
// ─────────────────────────────────────────────────────────────────────────────

/// Encrypt pre-alpha program ID.
pub const ENCRYPT_PROGRAM_ID: Pubkey = Pubkey::new_from_array(five8_const::decode_32_const(
    "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8",
));

/// Ika dWallet pre-alpha program ID.
pub const DWALLET_PROGRAM_ID: Pubkey = Pubkey::new_from_array(five8_const::decode_32_const(
    "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY",
));

// ─────────────────────────────────────────────────────────────────────────────
// ConfigAccount — PDA: ["config"]
// ─────────────────────────────────────────────────────────────────────────────
//
// Layout (91 bytes):
//   [0]       discriminator   u8
//   [1..33]   admin           Pubkey
//   [33]      paused          u8 (0=active, 1=paused)
//   [34..66]  loan_currency   Pubkey (DEMO-USDC mint)
//   [66..74]  max_ltv_bps     u64 LE (e.g. 8000 = 80%)
//   [74..82]  min_duration    i64 LE (seconds)
//   [82..90]  max_duration    i64 LE (seconds)
//   [90]      bump            u8
// ─────────────────────────────────────────────────────────────────────────────

pub const CONFIG_SIZE: usize = 91;

pub mod config_offsets {
    pub const DISC: usize = 0;
    pub const ADMIN: usize = 1;
    pub const PAUSED: usize = 33;
    pub const LOAN_CURRENCY_MINT: usize = 34;
    pub const MAX_LTV_BPS: usize = 66;
    pub const MIN_DURATION: usize = 74;
    pub const MAX_DURATION: usize = 82;
    pub const BUMP: usize = 90;
}

/// Safe read accessors for the Config account.
pub struct ConfigReader<'a>(pub &'a [u8]);

impl<'a> ConfigReader<'a> {
    pub fn validate(&self) -> bool {
        self.0.len() >= CONFIG_SIZE && self.0[config_offsets::DISC] == CONFIG_DISCRIMINATOR
    }

    pub fn admin(&self) -> &[u8] {
        &self.0[config_offsets::ADMIN..config_offsets::ADMIN + 32]
    }

    pub fn is_paused(&self) -> bool {
        self.0[config_offsets::PAUSED] != 0
    }

    pub fn loan_currency_mint(&self) -> &[u8] {
        &self.0[config_offsets::LOAN_CURRENCY_MINT..config_offsets::LOAN_CURRENCY_MINT + 32]
    }

    pub fn max_ltv_bps(&self) -> u64 {
        u64::from_le_bytes(
            self.0[config_offsets::MAX_LTV_BPS..config_offsets::MAX_LTV_BPS + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn min_duration(&self) -> i64 {
        i64::from_le_bytes(
            self.0[config_offsets::MIN_DURATION..config_offsets::MIN_DURATION + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn max_duration(&self) -> i64 {
        i64::from_le_bytes(
            self.0[config_offsets::MAX_DURATION..config_offsets::MAX_DURATION + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn bump(&self) -> u8 {
        self.0[config_offsets::BUMP]
    }
}

/// Safe write helpers for initializing / updating the Config account.
pub struct ConfigWriter<'a>(pub &'a mut [u8]);

impl<'a> ConfigWriter<'a> {
    pub fn init(
        &mut self,
        admin: &[u8; 32],
        loan_currency_mint: &[u8; 32],
        max_ltv_bps: u64,
        min_duration: i64,
        max_duration: i64,
        bump: u8,
    ) {
        self.0[config_offsets::DISC] = CONFIG_DISCRIMINATOR;
        self.0[config_offsets::ADMIN..config_offsets::ADMIN + 32].copy_from_slice(admin);
        self.0[config_offsets::PAUSED] = 0;
        self.0[config_offsets::LOAN_CURRENCY_MINT..config_offsets::LOAN_CURRENCY_MINT + 32]
            .copy_from_slice(loan_currency_mint);
        self.0[config_offsets::MAX_LTV_BPS..config_offsets::MAX_LTV_BPS + 8]
            .copy_from_slice(&max_ltv_bps.to_le_bytes());
        self.0[config_offsets::MIN_DURATION..config_offsets::MIN_DURATION + 8]
            .copy_from_slice(&min_duration.to_le_bytes());
        self.0[config_offsets::MAX_DURATION..config_offsets::MAX_DURATION + 8]
            .copy_from_slice(&max_duration.to_le_bytes());
        self.0[config_offsets::BUMP] = bump;
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.0[config_offsets::PAUSED] = if paused { 1 } else { 0 };
    }

    pub fn set_max_ltv_bps(&mut self, val: u64) {
        self.0[config_offsets::MAX_LTV_BPS..config_offsets::MAX_LTV_BPS + 8]
            .copy_from_slice(&val.to_le_bytes());
    }

    pub fn set_min_duration(&mut self, val: i64) {
        self.0[config_offsets::MIN_DURATION..config_offsets::MIN_DURATION + 8]
            .copy_from_slice(&val.to_le_bytes());
    }

    pub fn set_max_duration(&mut self, val: i64) {
        self.0[config_offsets::MAX_DURATION..config_offsets::MAX_DURATION + 8]
            .copy_from_slice(&val.to_le_bytes());
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LoanAccount — PDA: ["loan", loan_id(16)]
// ─────────────────────────────────────────────────────────────────────────────
//
// Layout (307 bytes):
//   [0]         discriminator           u8
//   [1..17]     loan_id                 [u8; 16]
//   [17..49]    borrower                Pubkey
//   [49..81]    lender                  Pubkey (zero if unfunded)
//   [81..113]   collateral_mint         Pubkey
//   [113..121]  collateral_amount       u64 LE
//   [121..129]  loan_amount             u64 LE
//   [129..137]  interest_rate_bps       u64 LE
//   [137..145]  duration_seconds        i64 LE
//   [145..153]  due_date                i64 LE (0 until funded)
//   [153]       status                  u8
//   [154..186]  encrypted_repayment_ct  Pubkey (Encrypt ciphertext)
//   [186..218]  encrypted_ltv_ct        Pubkey (Encrypt ciphertext)
//   [218..250]  dwallet_pubkey          Pubkey (Ika dWallet ref)
//   [250..282]  settlement_approval     Pubkey (Ika MessageApproval PDA)
//   [282..290]  created_at              i64 LE
//   [290..298]  funded_at               i64 LE
//   [298..306]  repaid_at               i64 LE
//   [306]       bump                    u8
// ─────────────────────────────────────────────────────────────────────────────

pub const LOAN_SIZE: usize = 307;

pub mod loan_offsets {
    pub const DISC: usize = 0;
    pub const LOAN_ID: usize = 1;
    pub const BORROWER: usize = 17;
    pub const LENDER: usize = 49;
    pub const COLLATERAL_MINT: usize = 81;
    pub const COLLATERAL_AMOUNT: usize = 113;
    pub const LOAN_AMOUNT: usize = 121;
    pub const INTEREST_RATE_BPS: usize = 129;
    pub const DURATION_SECONDS: usize = 137;
    pub const DUE_DATE: usize = 145;
    pub const STATUS: usize = 153;
    pub const ENCRYPTED_REPAYMENT_CT: usize = 154;
    pub const ENCRYPTED_LTV_CT: usize = 186;
    pub const DWALLET_PUBKEY: usize = 218;
    pub const SETTLEMENT_APPROVAL: usize = 250;
    pub const CREATED_AT: usize = 282;
    pub const FUNDED_AT: usize = 290;
    pub const REPAID_AT: usize = 298;
    pub const BUMP: usize = 306;
}

/// Safe read accessors for the Loan account.
pub struct LoanReader<'a>(pub &'a [u8]);

impl<'a> LoanReader<'a> {
    pub fn validate(&self) -> bool {
        self.0.len() >= LOAN_SIZE && self.0[loan_offsets::DISC] == LOAN_DISCRIMINATOR
    }

    pub fn loan_id(&self) -> &[u8] {
        &self.0[loan_offsets::LOAN_ID..loan_offsets::LOAN_ID + 16]
    }

    pub fn borrower(&self) -> &[u8] {
        &self.0[loan_offsets::BORROWER..loan_offsets::BORROWER + 32]
    }

    pub fn lender(&self) -> &[u8] {
        &self.0[loan_offsets::LENDER..loan_offsets::LENDER + 32]
    }

    pub fn collateral_mint(&self) -> &[u8] {
        &self.0[loan_offsets::COLLATERAL_MINT..loan_offsets::COLLATERAL_MINT + 32]
    }

    pub fn collateral_amount(&self) -> u64 {
        u64::from_le_bytes(
            self.0[loan_offsets::COLLATERAL_AMOUNT..loan_offsets::COLLATERAL_AMOUNT + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn loan_amount(&self) -> u64 {
        u64::from_le_bytes(
            self.0[loan_offsets::LOAN_AMOUNT..loan_offsets::LOAN_AMOUNT + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn interest_rate_bps(&self) -> u64 {
        u64::from_le_bytes(
            self.0[loan_offsets::INTEREST_RATE_BPS..loan_offsets::INTEREST_RATE_BPS + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn duration_seconds(&self) -> i64 {
        i64::from_le_bytes(
            self.0[loan_offsets::DURATION_SECONDS..loan_offsets::DURATION_SECONDS + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn due_date(&self) -> i64 {
        i64::from_le_bytes(
            self.0[loan_offsets::DUE_DATE..loan_offsets::DUE_DATE + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn status(&self) -> u8 {
        self.0[loan_offsets::STATUS]
    }

    pub fn encrypted_repayment_ct(&self) -> &[u8] {
        &self.0[loan_offsets::ENCRYPTED_REPAYMENT_CT..loan_offsets::ENCRYPTED_REPAYMENT_CT + 32]
    }

    pub fn encrypted_ltv_ct(&self) -> &[u8] {
        &self.0[loan_offsets::ENCRYPTED_LTV_CT..loan_offsets::ENCRYPTED_LTV_CT + 32]
    }

    pub fn dwallet_pubkey(&self) -> &[u8] {
        &self.0[loan_offsets::DWALLET_PUBKEY..loan_offsets::DWALLET_PUBKEY + 32]
    }

    pub fn settlement_approval(&self) -> &[u8] {
        &self.0[loan_offsets::SETTLEMENT_APPROVAL..loan_offsets::SETTLEMENT_APPROVAL + 32]
    }

    pub fn created_at(&self) -> i64 {
        i64::from_le_bytes(
            self.0[loan_offsets::CREATED_AT..loan_offsets::CREATED_AT + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn funded_at(&self) -> i64 {
        i64::from_le_bytes(
            self.0[loan_offsets::FUNDED_AT..loan_offsets::FUNDED_AT + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn repaid_at(&self) -> i64 {
        i64::from_le_bytes(
            self.0[loan_offsets::REPAID_AT..loan_offsets::REPAID_AT + 8]
                .try_into()
                .unwrap(),
        )
    }

    pub fn bump(&self) -> u8 {
        self.0[loan_offsets::BUMP]
    }
}

/// Safe write helpers for creating / updating the Loan account.
pub struct LoanWriter<'a>(pub &'a mut [u8]);

impl<'a> LoanWriter<'a> {
    /// Initialize a new loan in the Requested state.
    #[allow(clippy::too_many_arguments)]
    pub fn init(
        &mut self,
        loan_id: &[u8; 16],
        borrower: &[u8; 32],
        collateral_mint: &[u8; 32],
        collateral_amount: u64,
        loan_amount: u64,
        interest_rate_bps: u64,
        duration_seconds: i64,
        dwallet_pubkey: &[u8; 32],
        encrypted_repayment_ct: &[u8; 32],
        encrypted_ltv_ct: &[u8; 32],
        created_at: i64,
        bump: u8,
    ) {
        self.0[loan_offsets::DISC] = LOAN_DISCRIMINATOR;
        self.0[loan_offsets::LOAN_ID..loan_offsets::LOAN_ID + 16].copy_from_slice(loan_id);
        self.0[loan_offsets::BORROWER..loan_offsets::BORROWER + 32].copy_from_slice(borrower);
        // Lender is zero initially
        self.0[loan_offsets::LENDER..loan_offsets::LENDER + 32].copy_from_slice(&[0u8; 32]);
        self.0[loan_offsets::COLLATERAL_MINT..loan_offsets::COLLATERAL_MINT + 32]
            .copy_from_slice(collateral_mint);
        self.0[loan_offsets::COLLATERAL_AMOUNT..loan_offsets::COLLATERAL_AMOUNT + 8]
            .copy_from_slice(&collateral_amount.to_le_bytes());
        self.0[loan_offsets::LOAN_AMOUNT..loan_offsets::LOAN_AMOUNT + 8]
            .copy_from_slice(&loan_amount.to_le_bytes());
        self.0[loan_offsets::INTEREST_RATE_BPS..loan_offsets::INTEREST_RATE_BPS + 8]
            .copy_from_slice(&interest_rate_bps.to_le_bytes());
        self.0[loan_offsets::DURATION_SECONDS..loan_offsets::DURATION_SECONDS + 8]
            .copy_from_slice(&duration_seconds.to_le_bytes());
        // Due date is zero until funded
        self.0[loan_offsets::DUE_DATE..loan_offsets::DUE_DATE + 8]
            .copy_from_slice(&0i64.to_le_bytes());
        self.0[loan_offsets::STATUS] = STATUS_REQUESTED;
        self.0[loan_offsets::ENCRYPTED_REPAYMENT_CT..loan_offsets::ENCRYPTED_REPAYMENT_CT + 32]
            .copy_from_slice(encrypted_repayment_ct);
        self.0[loan_offsets::ENCRYPTED_LTV_CT..loan_offsets::ENCRYPTED_LTV_CT + 32]
            .copy_from_slice(encrypted_ltv_ct);
        self.0[loan_offsets::DWALLET_PUBKEY..loan_offsets::DWALLET_PUBKEY + 32]
            .copy_from_slice(dwallet_pubkey);
        self.0[loan_offsets::SETTLEMENT_APPROVAL..loan_offsets::SETTLEMENT_APPROVAL + 32]
            .copy_from_slice(&[0u8; 32]);
        self.0[loan_offsets::CREATED_AT..loan_offsets::CREATED_AT + 8]
            .copy_from_slice(&created_at.to_le_bytes());
        self.0[loan_offsets::FUNDED_AT..loan_offsets::FUNDED_AT + 8]
            .copy_from_slice(&0i64.to_le_bytes());
        self.0[loan_offsets::REPAID_AT..loan_offsets::REPAID_AT + 8]
            .copy_from_slice(&0i64.to_le_bytes());
        self.0[loan_offsets::BUMP] = bump;
    }

    pub fn set_status(&mut self, status: u8) {
        self.0[loan_offsets::STATUS] = status;
    }

    pub fn set_lender(&mut self, lender: &[u8; 32]) {
        self.0[loan_offsets::LENDER..loan_offsets::LENDER + 32].copy_from_slice(lender);
    }

    pub fn set_due_date(&mut self, due_date: i64) {
        self.0[loan_offsets::DUE_DATE..loan_offsets::DUE_DATE + 8]
            .copy_from_slice(&due_date.to_le_bytes());
    }

    pub fn set_funded_at(&mut self, ts: i64) {
        self.0[loan_offsets::FUNDED_AT..loan_offsets::FUNDED_AT + 8]
            .copy_from_slice(&ts.to_le_bytes());
    }

    pub fn set_repaid_at(&mut self, ts: i64) {
        self.0[loan_offsets::REPAID_AT..loan_offsets::REPAID_AT + 8]
            .copy_from_slice(&ts.to_le_bytes());
    }

    pub fn set_settlement_approval(&mut self, approval: &[u8; 32]) {
        self.0[loan_offsets::SETTLEMENT_APPROVAL..loan_offsets::SETTLEMENT_APPROVAL + 32]
            .copy_from_slice(approval);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA derivation helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Derive the Config PDA address.
pub fn find_config_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], program_id)
}

/// Derive a Loan PDA address from a 16-byte loan ID.
pub fn find_loan_pda(program_id: &Pubkey, loan_id: &[u8; 16]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LOAN_SEED, loan_id], program_id)
}

/// Derive the Escrow PDA (token account authority) for a loan.
pub fn find_escrow_pda(program_id: &Pubkey, loan_id: &[u8; 16]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ESCROW_SEED, loan_id], program_id)
}

/// Derive the Encrypt CPI authority PDA for this program.
pub fn find_encrypt_cpi_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ENCRYPT_CPI_SEED], program_id)
}

/// Derive the Ika CPI authority PDA for this program.
pub fn find_ika_cpi_authority(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[IKA_CPI_SEED], program_id)
}
