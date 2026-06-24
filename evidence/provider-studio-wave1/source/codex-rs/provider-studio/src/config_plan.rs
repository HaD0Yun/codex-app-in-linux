/// Readiness of the future provider config planning surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigPlanStatus {
    /// Config writes and restore flows are intentionally absent in Wave 1.
    ScaffoldOnly,
}
