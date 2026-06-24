/// Readiness of the future provider doctor surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DoctorStatus {
    /// Doctor probes and network checks are intentionally absent in Wave 1.
    ScaffoldOnly,
}
