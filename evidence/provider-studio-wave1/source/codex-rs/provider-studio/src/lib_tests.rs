use super::*;

#[test]
fn wave_1_status_types_are_public_contract() {
    let status_names = [
        status_name(PresetCatalogStatus::ScaffoldOnly),
        status_name(ConfigPlanStatus::ScaffoldOnly),
        status_name(DoctorStatus::ScaffoldOnly),
        status_name(ReportStatus::ScaffoldOnly),
        status_name(ServerContractStatus::ScaffoldOnly),
    ];

    assert_eq!(status_names, ["ScaffoldOnly"; 5]);
}

fn status_name<T>(status: T) -> String
where
    T: Copy + Eq + std::fmt::Debug,
{
    format!("{status:?}")
}
