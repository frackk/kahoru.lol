use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub version: String,
    pub locale: String,
    pub source: String,
    pub retrieved_at: String,
    pub sha256: String,
    pub champions: Vec<Champion>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct Champion {
    pub id: u32,
    pub slug: String,
    pub name: String,
    pub title: String,
}

impl Catalog {
    pub fn bundled() -> Result<Self, String> {
        let catalog: Self = serde_json::from_str(include_str!("../../data/champions.json"))
            .map_err(|_| "No se pudo leer el catálogo incluido".to_string())?;
        let ids: HashSet<_> = catalog.champions.iter().map(|c| c.id).collect();
        if ids.len() != catalog.champions.len()
            || catalog.champions.len() < 100
            || catalog
                .champions
                .iter()
                .any(|c| c.id == 0 || c.name.is_empty())
        {
            return Err("El catálogo incluido no es válido".into());
        }
        Ok(catalog)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_catalog_has_unique_canonical_ids_and_provenance() {
        let catalog = Catalog::bundled().unwrap();
        assert!(catalog
            .source
            .starts_with("https://ddragon.leagueoflegends.com/"));
        assert_eq!(catalog.sha256.len(), 64);
        assert!(catalog
            .champions
            .iter()
            .any(|c| c.id == 103 && c.slug == "Ahri"));
    }
}
