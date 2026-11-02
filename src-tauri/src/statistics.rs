use crate::provider_format;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub struct Statistics {
    cache: Mutex<HashMap<String, (u64, Value)>>,
    names: Mutex<HashMap<String, String>>,
    directory: PathBuf,
}
fn usable(analysis: &Value) -> bool {
    let ids = |value: &Value| {
        value.as_array().is_some_and(|a| {
            a.len() <= 10
                && a.iter()
                    .all(|id| id.as_u64().is_some_and(|id| id > 0 && id < 100_000))
        })
    };
    let row = |value: &Value| {
        value.is_object() && ids(&value["ids"]) && value["play"].is_u64() && value["win"].is_u64()
    };
    let data = &analysis["data"];
    let skill = |v: &Value| {
        v["play"].is_u64()
            && v["win"]
                .as_u64()
                .is_some_and(|w| w <= v["play"].as_u64().unwrap_or(0))
            && v["order"].as_array().is_some_and(|a| {
                a.len() <= 18
                    && a.iter().all(|k| {
                        k.as_str()
                            .is_some_and(|k| ["Q", "W", "E", "R"].contains(&k))
                    })
            })
    };
    analysis["champion"].is_string()
        && analysis["position"].is_string()
        && data.is_object()
        && data["trends"]["win"]["version"].is_string()
        && row(&data["core_items"])
        && row(&data["starter_items"])
        && (data["boots"].is_null() || row(&data["boots"]))
        && ["fourth_items", "fifth_items", "sixth_items"]
            .iter()
            .all(|k| {
                data[k].is_null()
                    || data[k]
                        .as_array()
                        .is_some_and(|a| a.len() <= 100 && a.iter().all(row))
            })
        && ["primary_rune_ids", "secondary_rune_ids", "stat_mod_ids"]
            .iter()
            .all(|k| ids(&data["runes"][k]))
        && ["primary_page_id", "secondary_page_id"]
            .iter()
            .all(|k| data["runes"][k].is_u64())
        && (data["summoner_spells"].is_null() || row(&data["summoner_spells"]))
        && (data["skills"].is_null() || skill(&data["skills"]))
        && (data["skill_masteries"].is_null()
            || data["skill_masteries"]["builds"]
                .as_array()
                .is_some_and(|a| a.len() <= 100 && a.iter().all(skill)))
        && ["strong_counters", "weak_counters"].iter().all(|k| {
            data[k].is_null()
                || data[k].as_array().is_some_and(|a| {
                    a.len() <= 200
                        && a.iter().all(|r| {
                            r["champion_id"].as_u64().is_some_and(|id| id > 0)
                                && r["play"].is_u64()
                                && r["my_win_rate"]
                                    .as_f64()
                                    .is_some_and(|rate| (0.0..=1.0).contains(&rate))
                        })
                })
        })
}
impl Statistics {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
            names: Mutex::new(HashMap::new()),
            directory,
        }
    }
    pub fn analysis(&self, slug: &str, role: &str, refresh: bool) -> Result<Value, String> {
        if slug.is_empty() || !slug.bytes().all(|b| b.is_ascii_alphanumeric()) {
            return Err("Identificador no compatible".into());
        }
        let position = match role {
            "TOP" => "top",
            "JUNGLE" => "jungle",
            "MID" => "mid",
            "BOT" => "adc",
            "SUPPORT" => "support",
            _ => return Err("Posición no compatible".into()),
        };
        let key = format!("{slug}:{role}");
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Reloj no disponible")?
            .as_secs();
        // Se serializan las consultas para no duplicar solicitudes del mismo draft.
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "Estadísticas no disponibles")?;
        let path = self.directory.join(format!("{slug}-{role}.json"));
        if !cache.contains_key(&key) {
            if let Ok(file) = std::fs::File::open(&path) {
                let mut bytes = vec![];
                if file.take(2_000_001).read_to_end(&mut bytes).is_ok() && bytes.len() <= 2_000_000
                {
                    if let Ok(value) = serde_json::from_slice::<Value>(&bytes) {
                        if let Some(time) = value["retrievedAt"].as_u64().filter(|t| {
                            *t <= now + 300
                                && value["championKey"] == slug
                                && value["role"] == role
                                && value["schemaVersion"] == 2
                                && usable(&value["analysis"])
                        }) {
                            cache.insert(key.clone(), (time, value));
                        }
                    }
                }
            }
        }
        if let Some((time, value)) = cache.get(&key) {
            if now.saturating_sub(*time) < if refresh { 60 } else { 43200 } {
                return Ok(value.clone());
            }
        }
        let mut names = self
            .names
            .lock()
            .map_err(|_| "Nombres del proveedor no disponibles")?;
        if names.is_empty() {
            let data = call(
                "lol_list_champions",
                json!({"lang":"en_US","desired_output_fields":["data.champions[].{key,name}"]}),
            )?;
            for row in data["data"]["champions"]
                .as_array()
                .ok_or("Catálogo del proveedor inválido")?
            {
                if let (Some(key), Some(name)) = (row["key"].as_str(), row["name"].as_str()) {
                    let canonical = name
                        .split(|c: char| !c.is_ascii_alphanumeric())
                        .filter(|s| !s.is_empty())
                        .collect::<Vec<_>>()
                        .join("_")
                        .to_ascii_uppercase();
                    names.insert(key.to_string(), canonical);
                }
            }
        }
        let champion = names
            .get(slug)
            .ok_or("El proveedor no reconoce este campeón")?
            .clone();
        drop(names);
        let fields=vec!["champion","position","data.summary.average_stats.{play,win_rate,pick_rate}","data.core_items.{ids[],play,win,pick_rate}","data.boots.{ids[],play,win,pick_rate}","data.starter_items.{ids[],play,win,pick_rate}","data.runes.{primary_page_id,secondary_page_id,primary_rune_ids[],secondary_rune_ids[],stat_mod_ids[],play,win}","data.summoner_spells.{ids[],play,win}","data.fourth_items[].{ids[],play,win}","data.fifth_items[].{ids[],play,win}","data.sixth_items[].{ids[],play,win}","data.trends.win.{version,created_at}","data.damage_type","data.skills.{order[],play,win}","data.skill_masteries.builds[].{order[],play,win}","data.weak_counters[].{champion_id,play,win,my_win_rate}","data.strong_counters[].{champion_id,play,win,my_win_rate}"];
        let data = call(
            "lol_get_champion_analysis",
            json!({"game_mode":"ranked","champion":champion,"position":position,"lang":"en_US","desired_output_fields":fields}),
        )?;
        if !usable(&data) {
            return Err("OP.GG devolvió un análisis incompleto o incompatible".into());
        }
        if data["champion"] != champion
            || data["position"]
                .as_str()
                .map(str::to_ascii_lowercase)
                .as_deref()
                != Some(position)
        {
            return Err("El proveedor devolvió otro campeón o posición".into());
        }
        let value = json!({"schemaVersion":2,"source":"OP.GG MCP","championKey":slug,"role":role,"retrievedAt":now,"region":null,"tier":"all","analysis":data});
        if std::fs::create_dir_all(&self.directory).is_ok() {
            if let Ok(mut file) = tempfile::NamedTempFile::new_in(&self.directory) {
                if let Ok(bytes) = serde_json::to_vec(&value) {
                    if file.write_all(&bytes).is_ok() {
                        let _ = file.persist(path);
                    }
                }
            }
        }
        cache.insert(key, (now, value.clone()));
        Ok(value)
    }
}

fn call(name: &str, arguments: Value) -> Result<Value, String> {
    let http = reqwest::blocking::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|_| "No se pudo iniciar el proveedor")?;
    let response=http.post("https://mcp-api.op.gg/mcp").header("Accept","application/json, text/event-stream").json(&json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":arguments}})).send().map_err(|_|"OP.GG no está disponible")?.error_for_status().map_err(|_|"El proveedor rechazó la consulta")?;
    let mut bytes = vec![];
    response
        .take(2_000_001)
        .read_to_end(&mut bytes)
        .map_err(|_| "Respuesta incompleta")?;
    if bytes.len() > 2_000_000 {
        return Err("Respuesta demasiado grande".into());
    }
    let text = String::from_utf8(bytes).map_err(|_| "Respuesta inválida")?;
    let envelope: Value = serde_json::from_str(&text)
        .or_else(|_| {
            text.lines()
                .filter_map(|l| l.strip_prefix("data:"))
                .find_map(|l| serde_json::from_str(l).ok())
                .ok_or_else(|| serde_json::from_str::<Value>("").unwrap_err())
        })
        .map_err(|_| "Formato de transporte no compatible")?;
    if envelope["result"]["isError"] == true || envelope.get("error").is_some() {
        return Err("No hay análisis disponible para este campeón y posición".into());
    }
    let content = envelope["result"]["content"]
        .as_array()
        .ok_or("Respuesta estadística vacía")?;
    let raw = content
        .iter()
        .filter_map(|c| c["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    provider_format::decode(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn malformed_cached_or_remote_rows_are_rejected() {
        let sample = json!({"ids":[6672],"play":1000,"win":500});
        let mut analysis = json!({"champion":"VIEGO","position":"jungle","data":{"trends":{"win":{"version":"16.21"}},"core_items":sample,"starter_items":sample,"fourth_items":[],"runes":{"primary_page_id":8000,"secondary_page_id":8300,"primary_rune_ids":[8010,9111,9104,8014],"secondary_rune_ids":[8304,8347],"stat_mod_ids":[5005,5008,5001]}}});
        assert!(usable(&analysis));
        analysis["data"]["skills"] = json!({"order":"QWE", "play":1000,"win":500});
        assert!(!usable(&analysis));
        analysis["data"]["skills"] = Value::Null;
        analysis["data"]["weak_counters"] =
            json!([{"champion_id":113,"play":1000,"my_win_rate":45}]);
        assert!(!usable(&analysis));
        analysis["data"]["weak_counters"] = Value::Null;
        analysis["data"]["runes"]["secondary_rune_ids"] = json!("invalid");
        assert!(!usable(&analysis));
        analysis["data"] = Value::Null;
        assert!(!usable(&analysis));
    }
    #[test]
    #[ignore = "consulta la interfaz pública del proveedor"]
    fn published_analysis_is_available() {
        let dir = tempfile::tempdir().unwrap();
        let stats = Statistics::new(dir.path().to_path_buf());
        let v = stats.analysis("Viego", "JUNGLE", false).unwrap();
        assert_eq!(v["analysis"]["champion"], "VIEGO");
        assert!(
            v["analysis"]["data"]["core_items"]["play"]
                .as_u64()
                .unwrap()
                > 0
        );
        let alias = stats.analysis("LeeSin", "JUNGLE", false).unwrap();
        assert_eq!(alias["analysis"]["champion"], "LEE_SIN");
    }
}
