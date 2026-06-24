/// Readiness of the future app-server contract surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerContractStatus {
    /// Server endpoints are intentionally absent in the Wave 1 scaffold.
    ScaffoldOnly,
}
