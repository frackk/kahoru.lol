use crate::catalog::{Catalog, Champion};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub cost: u32,
    pub combine_cost: u32,
    pub purchasable: bool,
    pub from: Vec<u32>,
    pub into: Vec<u32>,
    pub tags: Vec<String>,
    pub required_champion: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Rune {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub description: String,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct RuneSlot {
    pub runes: Vec<Rune>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct RuneTree {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub slots: Vec<RuneSlot>,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Asset {
    pub url: String,
    pub sha256: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameData {
    pub schema_version: u32,
    pub catalog: Catalog,
    pub asset_base: Option<String>,
    pub items: Vec<Item>,
    pub trees: Vec<RuneTree>,
    pub assets: BTreeMap<String, Asset>,
}
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub running: bool,
    pub completed: usize,
    pub total: usize,
    pub message: String,
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn valid_version(v: &str) -> bool {
    let p: Vec<_> = v.split('.').collect();
    p.len() == 3
        && p.iter()
            .all(|s| !s.is_empty() && s.len() < 6 && s.bytes().all(|b| b.is_ascii_digit()))
}
fn safe_path(p: &str) -> bool {
    p.bytes()
        .all(|b| b.is_ascii_alphanumeric() || b"/._-".contains(&b))
        && !p.starts_with('/')
        && p.split('/').all(|s| !s.is_empty() && s != "." && s != "..")
        && p.ends_with(".png")
}
fn text(v: &Value, k: &str) -> String {
    v[k].as_str().unwrap_or_default().into()
}
fn ids(v: &Value) -> Vec<u32> {
    v.as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s.as_str().and_then(|s| s.parse().ok()))
        .collect()
}
fn plain(html: &str) -> String {
    let mut tag = false;
    html.chars()
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

impl GameData {
    pub fn bundled() -> Result<Self, String> {
        let data: Self = serde_json::from_str(include_str!("../../data/game-data.json"))
            .map_err(|_| "Paquete incluido ilegible.")?;
        data.validate()?;
        Ok(data)
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1
            || !valid_version(&self.catalog.version)
            || self.catalog.champions.len() < 100
            || self.catalog.champions.len() > 500
            || self.items.len() < 100
            || self.items.len() > 2000
            || self.trees.len() != 5
        {
            return Err("El paquete está incompleto o no es compatible.".into());
        }
        let mut champs = HashSet::new();
        let mut items = HashSet::new();
        let mut runes = HashSet::new();
        for c in &self.catalog.champions {
            if c.id == 0
                || !champs.insert(c.id)
                || c.name.is_empty()
                || !self.assets.contains_key(&c.icon)
            {
                return Err("Catálogo de campeones inválido.".into());
            }
        }
        for i in &self.items {
            if i.id == 0
                || !items.insert(i.id)
                || i.name.is_empty()
                || !self.assets.contains_key(&i.icon)
            {
                return Err("Catálogo de objetos inválido.".into());
            }
        }
        for t in &self.trees {
            if t.slots.len() != 4 || !self.assets.contains_key(&t.icon) {
                return Err("Árbol de runas inválido.".into());
            }
            for s in &t.slots {
                if s.runes.is_empty() {
                    return Err("Fila de runas vacía.".into());
                }
                for r in &s.runes {
                    if !runes.insert(r.id) || !self.assets.contains_key(&r.icon) {
                        return Err("Runa inválida.".into());
                    }
                }
            }
        }
        for (path, a) in &self.assets {
            if !safe_path(path)
                || !a
                    .url
                    .starts_with("https://ddragon.leagueoflegends.com/cdn/")
                || a.sha256.len() != 64
                || !a.sha256.bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err("Recurso inválido.".into());
            }
        }
        Ok(())
    }
    pub fn load(cache: &Path) -> Self {
        let attempt = || -> Result<Self, String> {
            let folder: String = serde_json::from_slice(
                &std::fs::read(cache.join("active.json")).map_err(|_| "Sin caché")?,
            )
            .map_err(|_| "Índice inválido")?;
            if folder.is_empty()
                || folder == "."
                || folder == ".."
                || !folder
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-')
            {
                return Err("Ruta inválida".into());
            }
            let root = cache.join(folder);
            let mut data: Self = serde_json::from_slice(
                &std::fs::read(root.join("game-data.json")).map_err(|_| "Sin paquete")?,
            )
            .map_err(|_| "Paquete inválido")?;
            data.validate()?;
            for (p, a) in &data.assets {
                let bytes = std::fs::read(root.join(p)).map_err(|_| "Recurso ausente")?;
                if digest(&bytes) != a.sha256 {
                    return Err("Recurso corrupto".into());
                }
            }
            data.asset_base = Some(root.to_string_lossy().into());
            Ok(data)
        };
        attempt().unwrap_or_else(|_| Self::bundled().expect("Paquete incluido inválido"))
    }
}

fn http() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .https_only(true)
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "No se pudo iniciar la descarga.".into())
}
fn fetch(http: &reqwest::blocking::Client, url: &str, limit: u64) -> Result<Vec<u8>, String> {
    let response = http
        .get(url)
        .send()
        .map_err(|_| "No se pudo conectar con Data Dragon.")?
        .error_for_status()
        .map_err(|_| "Data Dragon no tiene disponible el recurso solicitado.")?;
    let mut bytes = vec![];
    response
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Descarga incompleta.")?;
    if bytes.len() as u64 > limit {
        return Err("Recurso demasiado grande.".into());
    }
    Ok(bytes)
}

pub fn prepare(
    current: &GameData,
    game_version: Option<&str>,
    cache: &Path,
    progress: Arc<Mutex<UpdateStatus>>,
) -> Result<GameData, String> {
    let http = http()?;
    let versions: Vec<String> = serde_json::from_slice(&fetch(
        &http,
        "https://ddragon.leagueoflegends.com/api/versions.json",
        512_000,
    )?)
    .map_err(|_| "Manifiesto inválido.")?;
    let patch = game_version
        .unwrap_or(&current.catalog.version)
        .split('.')
        .take(2)
        .collect::<Vec<_>>()
        .join(".")
        + ".";
    let version = versions
        .iter()
        .filter(|v| valid_version(v) && v.starts_with(&patch))
        .max_by_key(|v| {
            v.split('.')
                .filter_map(|s| s.parse::<u32>().ok())
                .collect::<Vec<_>>()
        })
        .ok_or("Todavía no hay datos oficiales para el parche del juego.")?;
    if version == &current.catalog.version {
        return Ok(current.clone());
    }
    let base = format!("https://ddragon.leagueoflegends.com/cdn/{version}");
    let raw = fetch(
        &http,
        &format!("{base}/data/es_AR/champion.json"),
        4_000_000,
    )?;
    let champions: Value = serde_json::from_slice(&raw).map_err(|_| "Campeones inválidos.")?;
    let items: Value = serde_json::from_slice(&fetch(
        &http,
        &format!("{base}/data/es_AR/item.json"),
        4_000_000,
    )?)
    .map_err(|_| "Objetos inválidos.")?;
    let trees: Value = serde_json::from_slice(&fetch(
        &http,
        &format!("{base}/data/es_AR/runesReforged.json"),
        2_000_000,
    )?)
    .map_err(|_| "Runas inválidas.")?;
    if champions["version"] != *version || items["version"] != *version {
        return Err("Versiones inconsistentes.".into());
    }
    let mut urls = BTreeMap::new();
    let mut cs = vec![];
    for c in champions["data"]
        .as_object()
        .ok_or("Campeones ausentes.")?
        .values()
    {
        let icon = format!("champion/{}", text(&c["image"], "full"));
        urls.insert(icon.clone(), format!("{base}/img/{icon}"));
        cs.push(Champion {
            id: text(c, "key").parse().map_err(|_| "ID inválido")?,
            slug: text(c, "id"),
            name: text(c, "name"),
            title: text(c, "title"),
            icon,
            tags: serde_json::from_value(c["tags"].clone()).map_err(|_| "Clases inválidas")?,
            resource: text(c, "partype"),
            range: c["stats"]["attackrange"].as_f64().unwrap_or(0.),
        });
    }
    cs.sort_by(|a, b| a.name.cmp(&b.name));
    let mut its = vec![];
    for (key, i) in items["data"].as_object().ok_or("Objetos ausentes.")? {
        let id: u32 = key.parse().map_err(|_| "ID inválido")?;
        if id >= 10000 || i["maps"]["11"] != true {
            continue;
        }
        let icon = format!("item/{}", text(&i["image"], "full"));
        urls.insert(icon.clone(), format!("{base}/img/{icon}"));
        its.push(Item {
            id,
            name: text(i, "name"),
            icon,
            description: plain(&text(i, "description")),
            cost: i["gold"]["total"].as_u64().ok_or("Coste ausente")? as u32,
            combine_cost: i["gold"]["base"].as_u64().ok_or("Coste ausente")? as u32,
            purchasable: i["gold"]["purchasable"] == true && i["inStore"] != false,
            from: ids(&i["from"]),
            into: ids(&i["into"]),
            tags: serde_json::from_value(i["tags"].clone()).unwrap_or_default(),
            required_champion: i["requiredChampion"].as_str().map(String::from),
        });
    }
    let mut ts = vec![];
    for t in trees.as_array().ok_or("Árboles ausentes")? {
        let id = t["id"].as_u64().ok_or("Árbol inválido")? as u32;
        let icon = format!("tree/{id}.png");
        urls.insert(
            icon.clone(),
            format!(
                "https://ddragon.leagueoflegends.com/cdn/img/{}",
                text(t, "icon")
            ),
        );
        let mut slots = vec![];
        for s in t["slots"].as_array().ok_or("Filas ausentes")? {
            let mut runes = vec![];
            for r in s["runes"].as_array().ok_or("Runas ausentes")? {
                let id = r["id"].as_u64().ok_or("Runa inválida")? as u32;
                let icon = format!("rune/{id}.png");
                urls.insert(
                    icon.clone(),
                    format!(
                        "https://ddragon.leagueoflegends.com/cdn/img/{}",
                        text(r, "icon")
                    ),
                );
                runes.push(Rune {
                    id,
                    name: text(r, "name"),
                    icon,
                    description: plain(&text(r, "longDesc")),
                });
            }
            slots.push(RuneSlot { runes });
        }
        ts.push(RuneTree {
            id,
            name: text(t, "name"),
            icon,
            slots,
        });
    }
    std::fs::create_dir_all(cache).map_err(|_| "No se pudo crear la caché.")?;
    let staging =
        tempfile::tempdir_in(cache).map_err(|_| "No se pudo preparar la actualización.")?;
    let total = urls.len();
    if let Ok(mut p) = progress.lock() {
        p.total = total;
        p.message = "Descargando imágenes oficiales".into();
    }
    let mut assets = BTreeMap::new();
    for (index, (path, url)) in urls.into_iter().enumerate() {
        if !safe_path(&path) || !url.starts_with("https://ddragon.leagueoflegends.com/cdn/") {
            return Err("Ruta de imagen inválida.".into());
        }
        let bytes = fetch(&http, &url, 2_000_000)?;
        if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            return Err("Imagen inválida.".into());
        }
        let target = staging.path().join(&path);
        std::fs::create_dir_all(target.parent().ok_or("Ruta inválida")?)
            .map_err(|_| "No se pudo guardar una imagen.")?;
        std::fs::write(target, &bytes).map_err(|_| "No se pudo guardar una imagen.")?;
        assets.insert(
            path,
            Asset {
                url,
                sha256: digest(&bytes),
            },
        );
        if let Ok(mut p) = progress.lock() {
            p.completed = index + 1;
        }
    }
    let data = GameData {
        schema_version: 1,
        catalog: Catalog {
            version: version.clone(),
            locale: "es_AR".into(),
            source: format!("{base}/data/es_AR/champion.json"),
            retrieved_at: time::OffsetDateTime::now_utc()
                .format(&time::format_description::well_known::Rfc3339)
                .map_err(|_| "Fecha inválida")?,
            sha256: digest(&raw),
            champions: cs,
        },
        asset_base: None,
        items: its,
        trees: ts,
        assets,
    };
    data.validate()?;
    let bytes = serde_json::to_vec(&data).map_err(|_| "No se pudo guardar el paquete")?;
    std::fs::write(staging.path().join("game-data.json"), &bytes)
        .map_err(|_| "No se pudo guardar el paquete")?;
    let folder = format!("{}-{}", version, &digest(&bytes)[..12]);
    let destination = cache.join(&folder);
    if !destination.exists() {
        std::fs::rename(staging.path(), &destination)
            .map_err(|_| "No se pudo activar el paquete descargado")?;
    }
    let mut data = data;
    data.asset_base = Some(destination.to_string_lossy().into());
    Ok(data)
}

pub fn activate(data: &GameData, cache: &Path) -> Result<(), String> {
    if let Some(root) = &data.asset_base {
        let folder = PathBuf::from(root)
            .file_name()
            .ok_or("Paquete inválido")?
            .to_string_lossy()
            .into_owned();
        let mut file =
            tempfile::NamedTempFile::new_in(cache).map_err(|_| "No se pudo guardar el índice")?;
        file.write_all(&serde_json::to_vec(&folder).map_err(|_| "Índice inválido")?)
            .map_err(|_| "No se pudo guardar el índice")?;
        file.persist(cache.join("active.json"))
            .map_err(|_| "No se pudo activar la actualización")?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn package_is_consistent_and_traversal_is_rejected() {
        let data = GameData::bundled().unwrap();
        assert!(data.assets.len() > 300);
        assert!(!safe_path("../a.png"));
        assert!(!safe_path("a\\b.png"));
        assert!(!safe_path("a:b.png"));
        assert!(!valid_version("16.21/1"));
        let mut bad = data;
        bad.catalog.champions.push(bad.catalog.champions[0].clone());
        assert!(bad.validate().is_err());
    }
    #[test]
    fn corrupt_cache_falls_back_to_bundle() {
        let dir = tempfile::tempdir().unwrap();
        for invalid in ["../outside", ".", ".."] {
            std::fs::write(
                dir.path().join("active.json"),
                serde_json::to_vec(invalid).unwrap(),
            )
            .unwrap();
            assert!(GameData::load(dir.path()).asset_base.is_none());
        }
    }
    #[test]
    fn cached_pack_loads_and_corrupt_asset_restores_bundle() {
        let cache = tempfile::tempdir().unwrap();
        let root = cache.path().join("verified-pack");
        std::fs::create_dir(&root).unwrap();
        let mut data = GameData::bundled().unwrap();
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../public/game")
            .join(&data.catalog.version);
        for path in data.assets.keys() {
            let target = root.join(path);
            std::fs::create_dir_all(target.parent().unwrap()).unwrap();
            std::fs::copy(source.join(path), target).unwrap();
        }
        std::fs::write(
            root.join("game-data.json"),
            serde_json::to_vec(&data).unwrap(),
        )
        .unwrap();
        data.asset_base = Some(root.to_string_lossy().into());
        activate(&data, cache.path()).unwrap();
        assert_eq!(GameData::load(cache.path()).asset_base, data.asset_base);
        std::fs::write(root.join(data.assets.keys().next().unwrap()), b"corrupt").unwrap();
        let restored = GameData::load(cache.path());
        assert!(restored.asset_base.is_none());
        assert_eq!(restored.catalog.version, data.catalog.version);
    }
    #[test]
    #[ignore = "descarga el paquete oficial completo; requiere red"]
    fn downloaded_pack_can_be_activated_and_reloaded() {
        let cache = tempfile::tempdir().unwrap();
        let mut current = GameData::bundled().unwrap();
        let version = current.catalog.version.clone();
        let patch = version.split('.').take(2).collect::<Vec<_>>().join(".");
        current.catalog.version = format!("{patch}.0");
        let progress = Arc::new(Mutex::new(UpdateStatus::default()));
        let next = prepare(&current, Some(&version), cache.path(), progress.clone()).unwrap();
        assert!(next.catalog.version.starts_with(&format!("{patch}.")));
        assert!(next.asset_base.is_some());
        assert_eq!(progress.lock().unwrap().completed, next.assets.len());
        activate(&next, cache.path()).unwrap();
        let loaded = GameData::load(cache.path());
        assert_eq!(loaded.asset_base, next.asset_base);
        assert_eq!(loaded.assets.len(), next.assets.len());
    }
}
