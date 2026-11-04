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
    cache: Mutex<Cache>,
    names: Mutex<HashMap<String, String>>,
    directory: PathBuf,
}
fn matches_identity(analysis: &Value, champion_id: u32) -> bool {
    analysis["data"]["summary"]["id"].as_u64() == Some(u64::from(champion_id))
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
            cache: Mutex::new(Cache::default()),
            names: Mutex::new(HashMap::new()),
            directory,
        }
    }
    pub fn analysis(
        &self,
        champion_id: u32,
        slug: &str,
        role: &str,
        version: &str,
        refresh: bool,
    ) -> Result<Value, String> {
        self.analysis_with(champion_id, slug, role, version, refresh, call)
    }
    fn analysis_with(
        &self,
        champion_id: u32,
        slug: &str,
        role: &str,
        version: &str,
        refresh: bool,
        mut fetch: impl FnMut(&str, Value) -> Result<Value, String>,
    ) -> Result<Value, String> {
        if slug.is_empty() || !slug.bytes().all(|b| b.is_ascii_alphanumeric()) {
            return Err("Identificador no compatible".into());
        }
        let patch = patch(version).ok_or("Parche no compatible")?;
        let position = match role {
            "TOP" => "top",
            "JUNGLE" => "jungle",
            "MID" => "mid",
            "BOT" => "adc",
            "SUPPORT" => "support",
            _ => return Err("Posición no compatible".into()),
        };
        let key = format!("{slug}-{role}");
        let patch_key = format!("{key}-{patch}");
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Reloj no disponible")?
            .as_secs();
        // Una consulta por vez; la copia histórica conserva su fecha y su parche.
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "Estadísticas no disponibles")?;
        for name in [&patch_key, &key] {
            if !cache.values.contains_key(name) {
                if let Some(value) = self.read(name, champion_id, slug, role, position, now) {
                    let saved_key = format!("{key}-{}", analysis_patch(&value).unwrap());
                    self.save(&saved_key, &value);
                    cache
                        .values
                        .entry(saved_key)
                        .or_insert_with(|| value.clone());
                    cache.values.insert(name.clone(), value);
                }
            }
        }
        let compatible = cache
            .values
            .get(&patch_key)
            .filter(|v| analysis_patch(v).as_deref() == Some(&patch))
            .cloned();
        if let Some(value) = &compatible {
            if age(value, now) < if refresh { 60 } else { 43200 } {
                return Ok(value.clone());
            }
        }
        if cache
            .checked
            .get(&key)
            .is_some_and(|t| now.saturating_sub(*t) < 60)
        {
            return select_analysis(
                compatible,
                cache
                    .values
                    .get(&key)
                    .cloned()
                    .ok_or_else(|| "Esperá un minuto antes de reintentar el proveedor.".into()),
                &patch,
                now,
            );
        }
        cache.checked.insert(key.clone(), now);
        let result = (|| {
            let mut names = self
                .names
                .lock()
                .map_err(|_| "Nombres del proveedor no disponibles")?;
            if names.is_empty() {
                let data = fetch(
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
            let fields=vec!["champion","position","data.summary.id","data.summary.average_stats.{play,win_rate,pick_rate}","data.core_items.{ids[],play,win,pick_rate}","data.boots.{ids[],play,win,pick_rate}","data.starter_items.{ids[],play,win,pick_rate}","data.runes.{primary_page_id,secondary_page_id,primary_rune_ids[],secondary_rune_ids[],stat_mod_ids[],play,win}","data.summoner_spells.{ids[],play,win}","data.fourth_items[].{ids[],play,win}","data.fifth_items[].{ids[],play,win}","data.sixth_items[].{ids[],play,win}","data.trends.win.{version,created_at}","data.damage_type","data.skills.{order[],play,win}","data.skill_masteries.builds[].{order[],play,win}","data.weak_counters[].{champion_id,play,win,my_win_rate}","data.strong_counters[].{champion_id,play,win,my_win_rate}"];
            let data = fetch(
                "lol_get_champion_analysis",
                json!({"game_mode":"ranked","champion":champion,"position":position,"lang":"en_US","desired_output_fields":fields}),
            )?;
            if !usable(&data) || patch_of_data(&data).is_none() {
                return Err("OP.GG devolvió un análisis incompleto o incompatible".into());
            }
            if !matches_identity(&data, champion_id)
                || data["position"]
                    .as_str()
                    .map(str::to_ascii_lowercase)
                    .as_deref()
                    != Some(position)
            {
                return Err("El proveedor devolvió otro campeón o posición".into());
            }
            Ok(
                json!({"schemaVersion":3,"championId":champion_id,"source":"OP.GG MCP","championKey":slug,"role":role,"retrievedAt":now,"region":null,"tier":"all","analysis":data}),
            )
        })();
        if let Ok(value) = &result {
            let remote_key = format!("{key}-{}", analysis_patch(value).unwrap());
            self.save(&remote_key, value);
            self.save(&key, value);
            cache.values.insert(remote_key, value.clone());
            cache.values.insert(key, value.clone());
        }
        select_analysis(compatible, result, &patch, now)
    }
    fn read(
        &self,
        name: &str,
        champion_id: u32,
        slug: &str,
        role: &str,
        position: &str,
        now: u64,
    ) -> Option<Value> {
        let file = std::fs::File::open(self.directory.join(format!("{name}.json"))).ok()?;
        let mut bytes = vec![];
        file.take(2_000_001).read_to_end(&mut bytes).ok()?;
        if bytes.len() > 2_000_000 {
            return None;
        }
        let v: Value = serde_json::from_slice(&bytes).ok()?;
        (v["retrievedAt"].as_u64().is_some_and(|t| t <= now + 300)
            && v["championKey"] == slug
            && v["role"] == role
            && v["schemaVersion"] == 3
            && v["championId"] == champion_id
            && matches_identity(&v["analysis"], champion_id)
            && v["analysis"]["position"]
                .as_str()
                .map(str::to_ascii_lowercase)
                .as_deref()
                == Some(position)
            && usable(&v["analysis"])
            && analysis_patch(&v).is_some())
        .then_some(v)
    }
    fn save(&self, name: &str, value: &Value) {
        if std::fs::create_dir_all(&self.directory).is_ok() {
            if let Ok(mut file) = tempfile::NamedTempFile::new_in(&self.directory) {
                if let Ok(bytes) = serde_json::to_vec(value) {
                    if file.write_all(&bytes).is_ok() {
                        let _ = file.persist(self.directory.join(format!("{name}.json")));
                    }
                }
            }
        }
    }
}

#[derive(Default)]
struct Cache {
    values: HashMap<String, Value>,
    checked: HashMap<String, u64>,
}
fn patch(version: &str) -> Option<String> {
    let parts: Vec<_> = version.split('.').take(2).collect();
    (parts.len() == 2
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.len() <= 3 && p.bytes().all(|c| c.is_ascii_digit())))
    .then(|| parts.join("."))
}
fn patch_of_data(data: &Value) -> Option<String> {
    patch(data["data"]["trends"]["win"]["version"].as_str()?)
}
fn analysis_patch(value: &Value) -> Option<String> {
    patch_of_data(&value["analysis"])
}
fn age(value: &Value, now: u64) -> u64 {
    now.saturating_sub(value["retrievedAt"].as_u64().unwrap_or(0))
}
fn select_analysis(
    compatible: Option<Value>,
    result: Result<Value, String>,
    patch: &str,
    now: u64,
) -> Result<Value, String> {
    if result
        .as_ref()
        .is_ok_and(|v| analysis_patch(v).as_deref() == Some(patch) && age(v, now) < 43200)
    {
        return result;
    }
    if let Some(mut previous) = compatible.filter(|v| age(v, now) <= 7 * 86400) {
        previous["warning"] = json!(match &result {
            Ok(v) => format!("OP.GG informa el parche {}. Se conserva la referencia del {} con su fecha original.", analysis_patch(v).unwrap_or_default(), patch),
            Err(_) => format!("No se pudo actualizar OP.GG. Se conserva la referencia del parche {patch} con su fecha original."),
        });
        return Ok(previous);
    }
    if result.as_ref().is_ok_and(|v| age(v, now) > 7 * 86400) {
        return Err(
            "La referencia guardada tiene más de siete días. Hace falta actualizar el análisis."
                .into(),
        );
    }
    result
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
    fn sample(patch: &str, time: u64) -> Value {
        let row = json!({"ids":[6672],"play":1000,"win":500});
        json!({"schemaVersion":3,"championId":234,"championKey":"Viego","role":"JUNGLE","retrievedAt":time,
            "source":"OP.GG MCP","region":null,"tier":"all",
            "analysis":{"champion":"VIEGO","position":"jungle","data":{
                "summary":{"id":234},"trends":{"win":{"version":patch}},
                "core_items":row,"starter_items":row,"runes":{"primary_page_id":8000,"secondary_page_id":8300,
                "primary_rune_ids":[8010,9111,9104,8014],"secondary_rune_ids":[8304,8347],"stat_mod_ids":[5005,5008,5001]}}}})
    }
    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
    #[test]
    fn patch_transition_preserves_legacy_cache_and_recovers_each_patch_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let stats = Statistics::new(dir.path().to_path_buf());
        let old = sample("16.21", now() - 120);
        stats.save("Viego-JUNGLE", &old);
        stats
            .names
            .lock()
            .unwrap()
            .insert("Viego".into(), "VIEGO".into());
        let next = sample("16.22", now());
        let selected = stats
            .analysis_with(234, "Viego", "JUNGLE", "16.21.1", true, |_, _| {
                Ok(next["analysis"].clone())
            })
            .unwrap();
        assert_eq!(selected["analysis"], old["analysis"]);
        assert_eq!(selected["retrievedAt"], old["retrievedAt"]);
        assert!(selected["warning"].as_str().unwrap().contains("16.22"));
        assert!(dir.path().join("Viego-JUNGLE-16.21.json").is_file());
        assert!(dir.path().join("Viego-JUNGLE-16.22.json").is_file());
        let restarted = Statistics::new(dir.path().to_path_buf());
        for patch in ["16.22", "16.21"] {
            let value = restarted
                .analysis_with(234, "Viego", "JUNGLE", patch, false, |_, _| {
                    panic!("No necesita red")
                })
                .unwrap();
            assert_eq!(analysis_patch(&value).as_deref(), Some(patch));
        }
    }
    #[test]
    fn fallback_expires_and_never_relabels_an_incompatible_patch() {
        let time = now();
        let old = sample("16.21", time - 43201);
        let selected =
            select_analysis(Some(old.clone()), Err("Sin red".into()), "16.21", time).unwrap();
        assert_eq!(selected["retrievedAt"], old["retrievedAt"]);
        assert!(selected["warning"].is_string());
        let expired = sample("16.21", time - 7 * 86400 - 1);
        assert!(select_analysis(Some(expired), Err("Sin red".into()), "16.21", time).is_err());
        let next = sample("16.22", time);
        assert_eq!(
            select_analysis(None, Ok(next.clone()), "16.21", time).unwrap(),
            next
        );
        assert!(patch("../../22").is_none());
        assert!(patch("16.22/../").is_none());
    }
    #[test]
    fn failed_refresh_uses_original_date_and_throttles_retries() {
        let dir = tempfile::tempdir().unwrap();
        let stats = Statistics::new(dir.path().to_path_buf());
        let old = sample("16.21", now() - 43201);
        stats.save("Viego-JUNGLE-16.21", &old);
        let value = stats
            .analysis_with(234, "Viego", "JUNGLE", "16.21", false, |_, _| {
                Err("Sin red".into())
            })
            .unwrap();
        assert_eq!(value["retrievedAt"], old["retrievedAt"]);
        let retry = stats
            .analysis_with(234, "Viego", "JUNGLE", "16.21", true, |_, _| {
                panic!("Reintento anticipado")
            })
            .unwrap();
        assert_eq!(retry["analysis"], old["analysis"]);
    }
    #[test]
    fn cached_identity_and_role_must_match_before_migration() {
        let dir = tempfile::tempdir().unwrap();
        let stats = Statistics::new(dir.path().to_path_buf());
        let mut wrong = sample("16.21", now());
        wrong["analysis"]["position"] = json!("support");
        stats.save("Viego-JUNGLE", &wrong);
        assert!(stats
            .analysis_with(234, "Viego", "JUNGLE", "16.21", false, |_, _| Err(
                "Sin red".into()
            ))
            .is_err());
        assert!(!dir.path().join("Viego-JUNGLE-16.21.json").exists());
    }
    #[test]
    fn identity_uses_canonical_id_instead_of_name_punctuation() {
        let mut value = json!({"champion":"VELKOZ","data":{"summary":{"id":161}}});
        assert!(matches_identity(&value, 161));
        value["data"]["summary"]["id"] = json!(234);
        assert!(!matches_identity(&value, 161));
    }
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
        let v = stats
            .analysis(234, "Viego", "JUNGLE", "16.21.1", false)
            .unwrap();
        assert_eq!(v["analysis"]["champion"], "VIEGO");
        assert!(
            v["analysis"]["data"]["core_items"]["play"]
                .as_u64()
                .unwrap()
                > 0
        );
        let alias = stats
            .analysis(64, "LeeSin", "JUNGLE", "16.21.1", false)
            .unwrap();
        assert_eq!(alias["analysis"]["champion"], "LEE_SIN");
        let punctuation = stats
            .analysis(161, "Velkoz", "SUPPORT", "16.21.1", false)
            .unwrap();
        assert_eq!(punctuation["analysis"]["data"]["summary"]["id"], 161);
    }
}
