use crate::{client::LocalClient, game_data::GameData};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, io::Write, path::Path};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePage {
    pub primary: u32,
    pub secondary: u32,
    pub primary_runes: Vec<u32>,
    pub secondary_runes: Vec<u32>,
    pub shards: Vec<u32>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub champion_id: u32,
    pub session_id: String,
    pub runes: Option<RunePage>,
    pub spells: Option<[u32; 2]>,
    pub replacement_page_id: Option<u64>,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Applied {
    pub runes_applied: bool,
    pub spells_applied: bool,
    pub message: String,
}
pub trait ClientApi {
    fn get(&self, path: &str) -> Result<Value, String>;
    fn change(&self, method: &str, path: &str, body: &Value) -> Result<Value, String>;
}
impl ClientApi for LocalClient {
    fn get(&self, path: &str) -> Result<Value, String> {
        self.get(path)
    }
    fn change(&self, method: &str, path: &str, body: &Value) -> Result<Value, String> {
        self.change(
            reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Método no compatible")?,
            path,
            body,
        )
    }
}
fn ensure_selection(api: &impl ClientApi, champion: u32) -> Result<(), String> {
    if api.get("/lol-gameflow/v1/gameflow-phase")?.as_str() != Some("ChampSelect") {
        return Err("La importación solo está disponible en selección de campeones.".into());
    }
    let draft = api.get("/lol-champ-select/v1/session")?;
    let own = draft["myTeam"]
        .as_array()
        .and_then(|t| t.iter().find(|p| p["cellId"] == draft["localPlayerCellId"]))
        .ok_or("No se pudo identificar tu selección")?;
    let selected = own["championId"]
        .as_u64()
        .filter(|id| *id > 0)
        .or_else(|| own["championPickIntent"].as_u64());
    if selected != Some(u64::from(champion)) {
        return Err("Tu campeón cambió. Revisá el plan antes de importar.".into());
    }
    Ok(())
}
pub fn validate_runes(data: &GameData, page: &RunePage) -> Result<(), String> {
    let main = data
        .trees
        .iter()
        .find(|t| t.id == page.primary)
        .ok_or("Árbol principal inválido")?;
    let sub = data
        .trees
        .iter()
        .find(|t| t.id == page.secondary)
        .ok_or("Árbol secundario inválido")?;
    if main.id == sub.id
        || page.primary_runes.len() != 4
        || main
            .slots
            .iter()
            .enumerate()
            .any(|(i, s)| !s.runes.iter().any(|r| r.id == page.primary_runes[i]))
    {
        return Err("Página principal incompatible".into());
    }
    let rows: Vec<_> = page
        .secondary_runes
        .iter()
        .map(|id| {
            sub.slots
                .iter()
                .position(|s| s.runes.iter().any(|r| r.id == *id))
        })
        .collect();
    if rows.len() != 2
        || rows.iter().any(|r| r.is_none() || *r == Some(0))
        || rows.iter().collect::<HashSet<_>>().len() != 2
    {
        return Err("Secundaria incompatible".into());
    }
    let shards: Value = serde_json::from_str(include_str!("../../data/knowledge/shards.json"))
        .map_err(|_| "Fragmentos no disponibles")?;
    if page.shards.len() != 3
        || page.shards.iter().enumerate().any(|(i, id)| {
            !shards["slots"][i]
                .as_array()
                .is_some_and(|a| a.iter().any(|v| v.as_u64() == Some(u64::from(*id))))
        })
    {
        return Err("Fragmentos incompatibles".into());
    }
    Ok(())
}
fn perk_ids(page: &RunePage) -> Vec<u32> {
    page.primary_runes
        .iter()
        .chain(&page.secondary_runes)
        .chain(&page.shards)
        .copied()
        .collect()
}
fn spell_order(current: [u32; 2], recommended: [u32; 2]) -> [u32; 2] {
    if recommended.contains(&current[0]) {
        [
            current[0],
            *recommended.iter().find(|id| **id != current[0]).unwrap(),
        ]
    } else if recommended.contains(&current[1]) {
        [
            *recommended.iter().find(|id| **id != current[1]).unwrap(),
            current[1],
        ]
    } else {
        recommended
    }
}
pub fn apply(
    api: &impl ClientApi,
    data: &GameData,
    request: &Request,
    directory: &Path,
) -> Result<Applied, String> {
    if request.runes.is_none() && request.spells.is_none() {
        return Err("No hay una configuración para importar".into());
    }
    if let Some(page) = &request.runes {
        validate_runes(data, page)?;
    }
    ensure_selection(api, request.champion_id)?;
    let version = api.get("/lol-patch/v1/game-version")?;
    let patch = data
        .catalog
        .version
        .split('.')
        .take(2)
        .collect::<Vec<_>>()
        .join(".")
        + ".";
    if !version.as_str().is_some_and(|s| s.starts_with(&patch)) {
        return Err("Cliente y datos pertenecen a parches distintos".into());
    }
    let account = api.get("/lol-summoner/v1/current-summoner")?;
    if let Some(spells) = request.spells {
        let available: Value =
            serde_json::from_str(include_str!("../../data/knowledge/spells.json"))
                .map_err(|_| "Hechizos no disponibles")?;
        if spells[0] == spells[1]
            || spells.iter().any(|id| {
                !available["spells"].as_array().is_some_and(|a| {
                    a.iter().any(|s| {
                        s["id"].as_u64() == Some(u64::from(*id))
                            && s["level"].as_u64().is_some_and(|min| {
                                account["summonerLevel"]
                                    .as_u64()
                                    .is_some_and(|level| level >= min)
                            })
                    })
                })
            })
        {
            return Err("Los spells no son válidos o aún no están desbloqueados".into());
        }
    }
    let mut applied = Applied::default();
    let operation = || -> Result<(bool, bool), String> {
        let mut runes_applied = false;
        if let Some(page) = &request.runes {
            let puuid = account["puuid"]
                .as_str()
                .filter(|s| !s.is_empty())
                .ok_or("No se pudo identificar la propiedad de la página")?;
            let file = directory.join(format!("{:x}.json", Sha256::digest(puuid.as_bytes())));
            let ownership: Option<Value> = std::fs::read(&file)
                .ok()
                .and_then(|b| serde_json::from_slice(&b).ok());
            let pages = api.get("/lol-perks/v1/pages")?;
            let owned = ownership.as_ref().and_then(|record| {
                pages.as_array()?.iter().find(|p| {
                    p["id"] == record["id"]
                        && p["name"] == record["name"]
                        && p["isEditable"] == true
                        && p["isDeletable"] == true
                })
            });
            let replacement = if let Some(id) = request.replacement_page_id {
                Some(
                    pages
                        .as_array()
                        .and_then(|pages| {
                            pages.iter().find(|p| {
                                p["id"].as_u64() == Some(id)
                                    && p["isEditable"] == true
                                    && p["isDeletable"] == true
                            })
                        })
                        .ok_or("La página elegida ya no está disponible para editar")?,
                )
            } else {
                None
            };
            if let Some(original) = replacement {
                let backup = backup_path(
                    directory,
                    puuid,
                    original["id"].as_u64().ok_or("Página no compatible")?,
                );
                if !backup.exists() {
                    save_json(directory, &backup, original)
                        .map_err(|_| "No se pudo guardar la copia. No se reemplazó la página.")?;
                }
            }
            let target = replacement.or(owned);
            if target.is_none() && api.get("/lol-perks/v1/inventory")?["canAddCustomPage"] == false
            {
                return Err("No hay ranuras libres. Elegí explícitamente una página para reutilizar; se guardará una copia local antes del cambio.".into());
            }
            let name = format!(
                "kahoru.lol · {}",
                data.catalog
                    .champions
                    .iter()
                    .find(|c| c.id == request.champion_id)
                    .ok_or("Campeón no disponible")?
                    .name
            );
            let mut body = json!({"name":name,"primaryStyleId":page.primary,"subStyleId":page.secondary,"selectedPerkIds":perk_ids(page),"current":true});
            ensure_selection(api, request.champion_id)?;
            let saved = if let Some(owned) = target {
                let id = owned["id"].as_u64().ok_or("Página propia no compatible")?;
                body["id"] = json!(id);
                api.change("PUT", &format!("/lol-perks/v1/pages/{id}"), &body)?;
                json!({"id":id,"name":name})
            } else {
                api.change("POST", "/lol-perks/v1/pages", &body)?
            };
            let id = saved["id"]
                .as_u64()
                .ok_or("La página se envió, pero el cliente no confirmó su identificador")?;
            std::fs::create_dir_all(directory)
                .map_err(|_| "Página creada; no se pudo guardar su referencia local")?;
            let mut record = tempfile::NamedTempFile::new_in(directory)
                .map_err(|_| "No se pudo guardar la propiedad de la página")?;
            record
                .write_all(
                    &serde_json::to_vec(&json!({"id":id,"name":name}))
                        .map_err(|_| "Referencia no válida")?,
                )
                .map_err(|_| "No se pudo guardar la propiedad")?;
            record
                .persist(&file)
                .map_err(|_| "No se pudo conservar la propiedad de la página")?;
            let current = api.get("/lol-perks/v1/currentpage")?;
            let mut selected: Vec<u32> = current["selectedPerkIds"]
                .as_array()
                .ok_or("El cliente no confirmó las runas activas")?
                .iter()
                .filter_map(|v| v.as_u64().and_then(|id| u32::try_from(id).ok()))
                .collect();
            selected.sort_unstable();
            let mut expected = perk_ids(page);
            expected.sort_unstable();
            if current["id"].as_u64() != Some(id)
                || selected != expected
                || current["primaryStyleId"] != page.primary
                || current["subStyleId"] != page.secondary
            {
                return Err(
                    "Página guardada; el cliente no confirmó que esté activa. Revisala en LoL."
                        .into(),
                );
            }
            runes_applied = true;
        }
        Ok((runes_applied, false))
    };
    match operation() {
        Ok((runes, _)) => applied.runes_applied = runes,
        Err(error) => {
            applied.message = error;
            return Ok(applied);
        }
    }
    if let Some(spells) = request.spells {
        let operation = || -> Result<(), String> {
            ensure_selection(api, request.champion_id)?;
            let current = api.get("/lol-champ-select/v1/session/my-selection")?;
            let order = spell_order(
                [
                    current["spell1Id"].as_u64().unwrap_or(0) as u32,
                    current["spell2Id"].as_u64().unwrap_or(0) as u32,
                ],
                spells,
            );
            api.change(
                "PATCH",
                "/lol-champ-select/v1/session/my-selection",
                &json!({"spell1Id":order[0],"spell2Id":order[1]}),
            )?;
            let confirmed = api.get("/lol-champ-select/v1/session/my-selection")?;
            if confirmed["spell1Id"] != order[0] || confirmed["spell2Id"] != order[1] {
                return Err("El cliente no confirmó los spells seleccionados".into());
            }
            Ok(())
        };
        match operation() {
            Ok(()) => applied.spells_applied = true,
            Err(error) => {
                applied.message = error;
                return Ok(applied);
            }
        }
    }
    applied.message = "Configuración aplicada y comprobada en el cliente.".into();
    Ok(applied)
}

fn backup_path(directory: &Path, puuid: &str, id: u64) -> std::path::PathBuf {
    directory.join(format!(
        "{:x}-backup-{id}.json",
        Sha256::digest(puuid.as_bytes())
    ))
}
fn save_json(directory: &Path, path: &Path, value: &Value) -> Result<(), String> {
    std::fs::create_dir_all(directory).map_err(|_| "No se pudo crear la carpeta de respaldo")?;
    let mut file =
        tempfile::NamedTempFile::new_in(directory).map_err(|_| "No se pudo guardar el respaldo")?;
    file.write_all(&serde_json::to_vec(value).map_err(|_| "Respaldo inválido")?)
        .map_err(|_| "No se pudo escribir el respaldo")?;
    file.persist(path)
        .map_err(|_| "No se pudo conservar el respaldo")?;
    Ok(())
}
pub fn targets(api: &impl ClientApi, directory: &Path) -> Result<Value, String> {
    let account = api.get("/lol-summoner/v1/current-summoner")?;
    let puuid = account["puuid"].as_str().ok_or("Cuenta no disponible")?;
    let pages = api.get("/lol-perks/v1/pages")?;
    Ok(Value::Array(pages.as_array().ok_or("Páginas no disponibles")?.iter().filter(|p|p["isEditable"]==true&&p["isDeletable"]==true).filter_map(|p|{let id=p["id"].as_u64()?;Some(json!({"id":id,"name":p["name"],"current":p["current"],"canRestore":backup_path(directory,puuid,id).exists()}))}).collect()))
}
pub fn restore(
    api: &impl ClientApi,
    champion: u32,
    id: u64,
    directory: &Path,
) -> Result<String, String> {
    ensure_selection(api, champion)?;
    let account = api.get("/lol-summoner/v1/current-summoner")?;
    let puuid = account["puuid"].as_str().ok_or("Cuenta no disponible")?;
    let backup: Value = serde_json::from_slice(
        &std::fs::read(backup_path(directory, puuid, id))
            .map_err(|_| "No existe un respaldo de esta página")?,
    )
    .map_err(|_| "Respaldo no compatible")?;
    let pages = api.get("/lol-perks/v1/pages")?;
    if !pages.as_array().is_some_and(|pages| {
        pages.iter().any(|p| {
            p["id"].as_u64() == Some(id) && p["isEditable"] == true && p["isDeletable"] == true
        })
    }) {
        return Err("La página ya no es editable".into());
    }
    let body = json!({"id":id,"name":backup["name"],"primaryStyleId":backup["primaryStyleId"],"subStyleId":backup["subStyleId"],"selectedPerkIds":backup["selectedPerkIds"],"current":true});
    ensure_selection(api, champion)?;
    api.change("PUT", &format!("/lol-perks/v1/pages/{id}"), &body)?;
    let current = api.get("/lol-perks/v1/currentpage")?;
    if current["id"] != id
        || current["selectedPerkIds"] != backup["selectedPerkIds"]
        || current["name"] != backup["name"]
    {
        return Err("El cliente no confirmó la restauración completa".into());
    }
    Ok("Página anterior restaurada y comprobada.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};
    struct Mock {
        phase: Cell<&'static str>,
        champion: Cell<u32>,
        pages: RefCell<Vec<Value>>,
        current: RefCell<Value>,
        selection: RefCell<Value>,
        writes: RefCell<Vec<String>>,
        fail_spells: bool,
        change_champion: bool,
    }
    impl Mock {
        fn new() -> Self {
            Self {
                phase: Cell::new("ChampSelect"),
                champion: Cell::new(234),
                pages: RefCell::new(vec![
                    json!({"id":42,"name":"Mi página","isEditable":true,"isDeletable":true,"current":true,"primaryStyleId":8000,"subStyleId":8300,"selectedPerkIds":[8010,9111,9104,8014,8304,8347,5005,5008,5001]}),
                ]),
                current: RefCell::new(Value::Null),
                selection: RefCell::new(json!({"spell1Id":11,"spell2Id":4})),
                writes: RefCell::new(vec![]),
                fail_spells: false,
                change_champion: false,
            }
        }
    }
    impl ClientApi for Mock {
        fn get(&self, path: &str) -> Result<Value, String> {
            match path {
                "/lol-gameflow/v1/gameflow-phase" => Ok(json!(self.phase.get())),
                "/lol-champ-select/v1/session" => Ok(
                    json!({"localPlayerCellId":0,"myTeam":[{"cellId":0,"championId":self.champion.get()}]}),
                ),
                "/lol-patch/v1/game-version" => Ok(json!("16.21.123")),
                "/lol-summoner/v1/current-summoner" => {
                    Ok(json!({"puuid":"synthetic-test-account","summonerLevel":30}))
                }
                "/lol-perks/v1/inventory" => Ok(json!({"canAddCustomPage":true})),
                "/lol-perks/v1/pages" => Ok(json!(self.pages.borrow().clone())),
                "/lol-perks/v1/currentpage" => Ok(self.current.borrow().clone()),
                "/lol-champ-select/v1/session/my-selection" => Ok(self.selection.borrow().clone()),
                _ => Err("Ruta inesperada".into()),
            }
        }
        fn change(&self, method: &str, path: &str, body: &Value) -> Result<Value, String> {
            self.writes.borrow_mut().push(format!("{method} {path}"));
            if method == "POST" || method == "PUT" {
                let mut page = body.clone();
                let target = body["id"].as_u64().unwrap_or(900);
                page["id"] = json!(target);
                page["isEditable"] = json!(true);
                page["isDeletable"] = json!(true);
                let mut pages = self.pages.borrow_mut();
                pages.retain(|p| p["id"] != target);
                pages.push(page.clone());
                *self.current.borrow_mut() = page.clone();
                if self.change_champion {
                    self.champion.set(103);
                }
                return Ok(page);
            }
            if self.fail_spells {
                return Err("Fallo de spells simulado".into());
            }
            *self.selection.borrow_mut() = body.clone();
            Ok(Value::Null)
        }
    }
    fn request() -> Request {
        let pages: Value =
            serde_json::from_str(include_str!("../../data/client-recommendations.json")).unwrap();
        let page = pages["champions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["id"] == 234)
            .unwrap()["pages"][0]
            .clone();
        Request {
            champion_id: 234,
            session_id: "test-session".into(),
            runes: Some(serde_json::from_value(page).unwrap()),
            spells: Some([4, 11]),
            replacement_page_id: None,
        }
    }
    #[test]
    fn imports_owned_page_and_preserves_user_pages_and_flash_key() {
        let api = Mock::new();
        let dir = tempfile::tempdir().unwrap();
        let data = GameData::bundled().unwrap();
        let r = request();
        let result = apply(&api, &data, &r, dir.path()).unwrap();
        assert!(result.runes_applied && result.spells_applied);
        assert_eq!(api.selection.borrow()["spell2Id"], 4);
        let result = apply(&api, &data, &r, dir.path()).unwrap();
        assert!(result.runes_applied);
        assert_eq!(api.pages.borrow().len(), 2);
        assert_eq!(api.pages.borrow()[0]["name"], "Mi página");
        assert_eq!(
            api.writes
                .borrow()
                .iter()
                .filter(|s| s.starts_with("POST"))
                .count(),
            1
        );
        assert!(api
            .writes
            .borrow()
            .iter()
            .any(|s| s == "PUT /lol-perks/v1/pages/900"));
    }
    #[test]
    fn rejects_invalid_runes_and_changed_selection_before_writes() {
        let api = Mock::new();
        let dir = tempfile::tempdir().unwrap();
        let data = GameData::bundled().unwrap();
        let mut r = request();
        r.runes.as_mut().unwrap().primary_runes[0] = 999999;
        assert!(apply(&api, &data, &r, dir.path()).is_err());
        let r = request();
        api.phase.set("InProgress");
        assert!(apply(&api, &data, &r, dir.path()).is_err());
        api.phase.set("ChampSelect");
        api.champion.set(103);
        assert!(apply(&api, &data, &r, dir.path()).is_err());
        assert!(api.writes.borrow().is_empty());
    }
    #[test]
    fn reports_partial_success_without_replacing_a_changed_champion() {
        let mut api = Mock::new();
        api.change_champion = true;
        let dir = tempfile::tempdir().unwrap();
        let result = apply(&api, &GameData::bundled().unwrap(), &request(), dir.path()).unwrap();
        assert!(result.runes_applied);
        assert!(!result.spells_applied);
        assert_eq!(api.writes.borrow().len(), 1);
    }
    #[test]
    fn reports_spells_failure_and_keeps_verified_runes() {
        let mut api = Mock::new();
        api.fail_spells = true;
        let dir = tempfile::tempdir().unwrap();
        let result = apply(&api, &GameData::bundled().unwrap(), &request(), dir.path()).unwrap();
        assert!(result.runes_applied);
        assert!(!result.spells_applied);
        assert!(result.message.contains("Fallo de spells"));
    }
    #[test]
    fn keeps_flash_in_either_existing_slot() {
        assert_eq!(spell_order([11, 4], [4, 11]), [11, 4]);
        assert_eq!(spell_order([4, 11], [11, 4]), [4, 11]);
    }

    #[test]
    fn replacement_has_a_restoreable_backup() {
        let api = Mock::new();
        let original = api.pages.borrow()[0].clone();
        let dir = tempfile::tempdir().unwrap();
        let data = GameData::bundled().unwrap();
        let mut r = request();
        r.replacement_page_id = Some(42);
        assert!(apply(&api, &data, &r, dir.path()).unwrap().runes_applied);
        assert_eq!(api.pages.borrow().len(), 1);
        assert_eq!(targets(&api, dir.path()).unwrap()[0]["canRestore"], true);
        assert!(restore(&api, 234, 42, dir.path())
            .unwrap()
            .contains("restaurada"));
        assert_eq!(api.current.borrow()["name"], original["name"]);
        assert_eq!(
            api.current.borrow()["selectedPerkIds"],
            original["selectedPerkIds"]
        );
    }
}
