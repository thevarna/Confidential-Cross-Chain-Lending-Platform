//! Custom error codes for the confidential lending program.
//!
//! Uses Pinocchio's ProgramError custom error range (0x0 – 0xFFFFFFFF).
//! The TypeScript SDK maps these back to human-readable names.

/// Custom error variants.
/// Encoded as u32 starting at 0 via ProgramError::Custom.
#[repr(u32)]
pub enum LendingError {
    /// The provided account does not have the expected discriminator.
    InvalidAccountDiscriminator = 0,
    /// The loan is not in the expected status for this operation.
    InvalidLoanStatus = 1,
    /// The signer is not authorized to perform this action.
    NotAuthorized = 2,
    /// Insufficient funds for the requested operation.
    InsufficientFunds = 3,
    /// The collateral type is not in the allowed whitelist.
    CollateralTypeNotAllowed = 4,
    /// The lending platform is currently paused by the admin.
    PlatformPaused = 5,
    /// The loan deadline has already passed.
    DeadlinePassed = 6,
    /// The loan deadline has not yet passed (cannot liquidate).
    DeadlineNotReached = 7,
    /// The repayment amount does not match the expected total.
    InvalidRepaymentAmount = 8,
    /// The loan-to-value ratio exceeds the maximum allowed.
    LtvExceedsMaximum = 9,
    /// The loan duration is outside the allowed range.
    InvalidDuration = 10,
    /// The loan amount must be greater than zero.
    ZeroLoanAmount = 11,
    /// Account data is too small for the expected layout.
    AccountDataTooSmall = 12,
    /// PDA derivation does not match the provided account.
    InvalidPdaDerivation = 13,
    /// The Encrypt CPI authority does not match.
    InvalidEncryptCpiAuthority = 14,
    /// The Ika CPI authority does not match.
    InvalidIkaCpiAuthority = 15,
    /// The dWallet reference on the loan is not set.
    DWalletNotConfigured = 16,
    /// Clock sysvar could not be read.
    ClockUnavailable = 17,
    /// Demo-only: values exceed demonstration limits.
    DemoValueExceeded = 18,
}

impl From<LendingError> for pinocchio::error::ProgramError {
    fn from(e: LendingError) -> Self {
        pinocchio::error::ProgramError::Custom(e as u32)
    }
}
