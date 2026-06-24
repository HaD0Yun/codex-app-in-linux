//! Typed scaffold for future Codex Provider Studio behavior.
//!
//! Wave 1 exports small contract types only. Provider behavior, config writes,
//! server endpoints, CLI integration, and UI integration are intentionally out
//! of scope.

mod config_plan;
mod doctor;
mod presets;
mod report;
mod server_contract;

pub use config_plan::ConfigPlanStatus;
pub use doctor::DoctorStatus;
pub use presets::PresetCatalogStatus;
pub use report::ReportStatus;
pub use server_contract::ServerContractStatus;

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
