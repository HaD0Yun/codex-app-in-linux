/// Readiness of the future provider preset catalog.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PresetCatalogStatus {
    /// Preset behavior is intentionally absent in the Wave 1 scaffold.
    ScaffoldOnly,
}
