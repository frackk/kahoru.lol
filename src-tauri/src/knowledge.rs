use crate::{
    client::LocalClient,
    game_data::GameData,
    loadout::{validate_runes, RunePage},
};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    io::{Read, Write},
    path::Path,
};
fn patch(version: &str) -> String {
    version.split('.').take(2).collect::<Vec<_>>().join(".")
}
fn plain(text: &str) -> String {
    let mut tag = false;
    text.chars()
        .filter_map(|c| match c {
            '<' => {
                tag = true;
                Some(' ')
            }
            '>' => {
                tag = false;
                None
            }
            _ if !tag => Some(c),
            _ => None,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn valid_champion(c: &Value, data: &GameData) -> bool {
    let roles = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
    let positions = match c["roles"].as_array() {
        Some(a) if a.len() <= 5 => a,
        _ => return false,
    };
    if !positions
        .iter()
        .all(|r| r.as_str().is_some_and(|r| roles.contains(&r)))
    {
        return false;
    }
    if !c["classes"]
        .as_array()
        .is_some_and(|a| a.len() <= 5 && a.iter().all(|v| v.is_string()))
        || !c["damage"].is_string()
    {
        return false;
    }
    if !c["abilities"].as_array().is_some_and(|a| {
        !a.is_empty()
            && a.len() <= 10
            && a.iter().all(|v| {
                v["name"].is_string() && v["description"].as_str().is_some_and(|s| s.len() < 20000)
            })
    }) {
        return false;
    }
    c["pages"].as_array().is_some_and(|pages| {
        pages.len() <= 30
            && pages.iter().all(|p| {
                let role = match p["role"].as_str() {
                    Some(r) => r,
                    None => return false,
                };
                let source = match role {
                    "MID" => "MIDDLE",
                    "BOT" => "BOTTOM",
                    "SUPPORT" => "UTILITY",
                    _ => role,
                };
                positions.contains(&json!(role))
                    && p["sourcePosition"] == source
                    && p["recommendationId"].is_string()
                    && serde_json::from_value::<RunePage>(p.clone())
                        .is_ok_and(|page| validate_runes(data, &page).is_ok())
                    && p["spells"].as_array().is_some_and(|a| {
                        a.len() == 2
                            && a.iter()
                                .all(|v| v.as_u64().is_some_and(|id| id > 0 && id < 1000))
                    })
            })
    })
}

fn compatible(value: &Value, data: &GameData) -> bool {
    value["schemaVersion"] == 2
        && value["clientVersion"]
            .as_str()
            .is_some_and(|v| patch(v) == patch(&data.catalog.version))
        && value["champions"].as_array().is_some_and(|champions| {
            let ids: HashSet<_> = champions.iter().filter_map(|c| c["id"].as_u64()).collect();
            champions.len() == data.catalog.champions.len()
                && champions.iter().all(|c| valid_champion(c, data))
                && ids.len() == champions.len()
                && data
                    .catalog
                    .champions
                    .iter()
                    .all(|c| ids.contains(&u64::from(c.id)))
        })
}
pub fn load(path: &Path, data: &GameData) -> Value {
    let cached = || {
        let file = std::fs::File::open(path).ok()?;
        let mut bytes = vec![];
        file.take(10_000_001).read_to_end(&mut bytes).ok()?;
        if bytes.len() > 10_000_000 {
            return None;
        }
        let value: Value = serde_json::from_slice(&bytes).ok()?;
        compatible(&value, data).then_some(value)
    };
    cached().unwrap_or_else(|| {
        serde_json::from_str(include_str!("../../data/client-recommendations.json"))
            .expect("Metadatos incluidos inválidos")
    })
}
pub fn refresh(data: &GameData) -> Result<Option<Value>, String> {
    if crate::client::discover().is_none() {
        return Ok(None);
    }
    let api = LocalClient::connect()?;
    let version = api.get("/lol-patch/v1/game-version")?;
    if !version
        .as_str()
        .is_some_and(|v| patch(v) == patch(&data.catalog.version))
    {
        return Err(
            "El cliente y el paquete oficial no coinciden; no se actualizaron las recomendaciones."
                .into(),
        );
    }
    let roles = api.get("/lol-perks/v1/recommended-champion-positions")?;
    let mut champions = vec![];
    for c in &data.catalog.champions {
        if champions.len() % 25 == 0
            && !matches!(
                api.get("/lol-gameflow/v1/gameflow-phase")?.as_str(),
                Some("None" | "Lobby" | "EndOfGame")
            )
        {
            return Err("La sesión empezó. Comprobá los datos fuera del draft.".into());
        }
        let info = api.get(&format!("/lol-game-data/assets/v1/champions/{}.json", c.id))?;
        let mut positions = vec![];
        let mut pages = vec![];
        for position in roles[c.id.to_string()]["recommendedPositions"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            let role = match position {
                "TOP" => "TOP",
                "JUNGLE" => "JUNGLE",
                "MIDDLE" => "MID",
                "BOTTOM" => "BOT",
                "UTILITY" => "SUPPORT",
                _ => continue,
            };
            positions.push(role);
            let recommendations = api.get(&format!(
                "/lol-perks/v1/recommended-pages/champion/{}/position/{}/map/11",
                c.id, position
            ))?;
            for page in recommendations.as_array().into_iter().flatten() {
                if page["position"] != position {
                    continue;
                }
                let perks = page["perks"]
                    .as_array()
                    .ok_or("Página recomendada no compatible")?;
                let primary: Vec<_> = perks
                    .iter()
                    .filter(|p| {
                        p["slotType"] != "kStatMod" && p["styleId"] == page["primaryPerkStyleId"]
                    })
                    .map(|p| p["id"].clone())
                    .collect();
                let secondary: Vec<_> = perks
                    .iter()
                    .filter(|p| {
                        p["slotType"] != "kStatMod" && p["styleId"] == page["secondaryPerkStyleId"]
                    })
                    .map(|p| p["id"].clone())
                    .collect();
                let shards: Vec<_> = perks
                    .iter()
                    .filter(|p| p["slotType"] == "kStatMod")
                    .map(|p| p["id"].clone())
                    .collect();
                let normalized = json!({"role":role,"sourcePosition":page["position"],"recommendationId":page["recommendationId"],"primary":page["primaryPerkStyleId"],"secondary":page["secondaryPerkStyleId"],"primaryRunes":primary,"secondaryRunes":secondary,"shards":shards,"spells":page["summonerSpellIds"]});
                let runes: RunePage = serde_json::from_value(normalized.clone())
                    .map_err(|_| "Página recomendada incompleta")?;
                if validate_runes(data, &runes).is_ok() {
                    pages.push(normalized);
                }
            }
        }
        let abilities:Vec<_>=std::iter::once(&info["passive"]).chain(info["spells"].as_array().into_iter().flatten()).map(|s|json!({"name":s["name"],"description":plain(s["abilityDescription"].as_str().or_else(||s["description"].as_str()).unwrap_or_default())})).collect();
        champions.push(json!({"id":c.id,"roles":positions,"damage":info["tacticalInfo"]["damageType"],"durability":info["playstyleInfo"]["durability"],"classes":info["roles"],"abilities":abilities,"pages":pages}));
    }
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|_| "Reloj no disponible")?;
    let value = json!({"schemaVersion":2,"clientVersion":version,"retrievedAt":now,"source":"League Client API: public champion metadata and recommended pages; map 11","champions":champions});
    if !compatible(&value, data) {
        return Err("Paquete de recomendaciones no compatible".into());
    }
    Ok(Some(value))
}
pub fn save(path: &Path, value: &Value) -> Result<(), String> {
    let parent = path.parent().ok_or("Caché no disponible")?;
    std::fs::create_dir_all(parent).map_err(|_| "No se pudo guardar la caché")?;
    let mut file = tempfile::NamedTempFile::new_in(parent)
        .map_err(|_| "No se pudo guardar el paquete de recomendaciones")?;
    file.write_all(&serde_json::to_vec(value).map_err(|_| "Paquete inválido")?)
        .map_err(|_| "No se pudo guardar el paquete")?;
    file.persist(path)
        .map_err(|_| "No se pudo activar el paquete")?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundled_knowledge_covers_the_catalog() {
        let game = GameData::bundled().unwrap();
        let bundled: Value =
            serde_json::from_str(include_str!("../../data/client-recommendations.json")).unwrap();
        assert!(compatible(&bundled, &game));
        let mut bad = bundled.clone();
        bad["champions"][0]["id"] = bad["champions"][1]["id"].clone();
        assert!(!compatible(&bad, &game));
    }
    #[test]
    fn invalid_cache_recovers_the_bundled_data() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("knowledge.json");
        std::fs::write(&path, b"broken").unwrap();
        let game = GameData::bundled().unwrap();
        assert_eq!(
            load(&path, &game)["champions"].as_array().unwrap().len(),
            game.catalog.champions.len()
        );
    }
}
