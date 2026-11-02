use crate::session::{DraftSlot, Role};
use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;
use std::{path::PathBuf, time::Duration};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSnapshot {
    pub connected: bool,
    pub phase: String,
    pub version: Option<String>,
    pub allies: Vec<DraftSlot>,
    pub enemies: Vec<DraftSlot>,
    pub bans: Vec<u32>,
    pub player_role: Option<Role>,
    pub message: String,
}

impl Default for ClientSnapshot {
    fn default() -> Self {
        Self {
            connected: false,
            phase: "Unknown".into(),
            version: None,
            allies: vec![],
            enemies: vec![],
            bans: vec![],
            player_role: None,
            message: "Esperando al cliente de League of Legends.".into(),
        }
    }
}

struct Credentials {
    port: u16,
    password: String,
}

fn parse_lockfile(text: &str) -> Result<Credentials, &'static str> {
    let fields: Vec<_> = text.trim().split(':').collect();
    if fields.len() != 5 || fields[4] != "https" || fields[3].is_empty() {
        return Err("Archivo de conexión no válido.");
    }
    let port = fields[2]
        .parse::<u16>()
        .ok()
        .filter(|p| *p > 0)
        .ok_or("Puerto local no válido.")?;
    Ok(Credentials {
        port,
        password: fields[3].into(),
    })
}

pub fn discover() -> Option<PathBuf> {
    let mut roots = vec![
        PathBuf::from(r"C:\Riot Games\League of Legends"),
        PathBuf::from(r"C:\Program Files (x86)\Riot Games\League of Legends"),
    ];
    if let Some(data) = std::env::var_os("PROGRAMDATA") {
        if let Ok(raw) =
            std::fs::read_to_string(PathBuf::from(data).join(r"Riot Games\RiotClientInstalls.json"))
        {
            if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                if let Some(paths) = value.get("associated_client").and_then(Value::as_object) {
                    roots.extend(paths.keys().map(PathBuf::from));
                }
            }
        }
    }
    roots
        .into_iter()
        .map(|p| p.join("lockfile"))
        .find(|p| p.is_file())
}

pub fn http_client() -> Result<Client, reqwest::Error> {
    let cert = reqwest::Certificate::from_pem(include_bytes!("../certificates/riotgames.pem"))?;
    Client::builder()
        .add_root_certificate(cert)
        .no_proxy()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(2))
        .build()
}

fn read(client: &Client, credentials: &Credentials, endpoint: &str) -> Result<Value, &'static str> {
    client
        .get(format!("https://127.0.0.1:{}{endpoint}", credentials.port))
        .basic_auth("riot", Some(&credentials.password))
        .send()
        .map_err(|_| "No se pudo validar o alcanzar la conexión local.")?
        .error_for_status()
        .map_err(|_| "El cliente no ofrece la información solicitada.")?
        .json()
        .map_err(|_| "El cliente devolvió una respuesta no compatible.")
}

pub fn poll(client: &Client, previous: &ClientSnapshot) -> ClientSnapshot {
    let attempt = || -> Result<ClientSnapshot, &'static str> {
        let path = discover().ok_or("Esperando al cliente de League of Legends.")?;
        let raw = std::fs::read_to_string(path)
            .map_err(|_| "El cliente está iniciando o reiniciando.")?;
        let credentials = parse_lockfile(&raw)?;
        let value = read(client, &credentials, "/lol-gameflow/v1/gameflow-phase")?;
        let phase = value.as_str().ok_or("Fase del cliente no compatible.")?;
        let mut next = if matches!(
            phase,
            "GameStart" | "InProgress" | "WaitingForStats" | "PreEndOfGame" | "EndOfGame"
        ) && previous.connected
        {
            previous.clone()
        } else {
            ClientSnapshot::default()
        };
        next.connected = true;
        next.phase = phase.into();
        next.message = "Cliente conectado · Solo lectura".into();
        next.version = read(client, &credentials, "/lol-patch/v1/game-version")
            .ok()
            .and_then(|v| v.as_str().map(String::from));
        if phase == "ChampSelect" {
            let draft = read(client, &credentials, "/lol-champ-select/v1/session")?;
            populate(&mut next, &draft)?;
        }
        // Una transición entre consultas no debe publicar un draft de otra fase.
        if read(client, &credentials, "/lol-gameflow/v1/gameflow-phase")?.as_str() != Some(phase) {
            return Err("El cliente está cambiando de fase.");
        }
        Ok(next)
    };
    match attempt() {
        Ok(next) => next,
        Err(message) => {
            let mut next = previous.clone();
            next.connected = false;
            next.message = message.into();
            next
        }
    }
}

fn role(value: &str) -> Option<Role> {
    match value {
        "top" => Some(Role::Top),
        "jungle" => Some(Role::Jungle),
        "middle" => Some(Role::Mid),
        "bottom" => Some(Role::Bot),
        "utility" => Some(Role::Support),
        _ => None,
    }
}

fn populate(next: &mut ClientSnapshot, value: &Value) -> Result<(), &'static str> {
    let parse_team = |key| -> Result<Vec<DraftSlot>, &'static str> {
        let team = value
            .get(key)
            .and_then(Value::as_array)
            .ok_or("Draft no compatible.")?;
        if team.len() > 5 {
            return Err("Modo de juego no compatible.");
        }
        Ok(team
            .iter()
            .map(|p| {
                let confirmed = p
                    .get("championId")
                    .and_then(Value::as_u64)
                    .filter(|id| *id > 0)
                    .and_then(|id| u32::try_from(id).ok());
                let tentative = if key == "myTeam" {
                    p.get("championPickIntent")
                        .and_then(Value::as_u64)
                        .filter(|id| *id > 0)
                        .and_then(|id| u32::try_from(id).ok())
                } else {
                    None
                };
                DraftSlot {
                    champion_id: confirmed.or(tentative),
                    locked: confirmed.is_some()
                        && value
                            .get("actions")
                            .and_then(Value::as_array)
                            .into_iter()
                            .flatten()
                            .filter_map(Value::as_array)
                            .flatten()
                            .any(|a| {
                                a.get("type").and_then(Value::as_str) == Some("pick")
                                    && a.get("completed").and_then(Value::as_bool) == Some(true)
                                    && p.get("cellId").is_some()
                                    && a.get("actorCellId") == p.get("cellId")
                            }),
                    role: if key == "myTeam" {
                        p.get("assignedPosition")
                            .and_then(Value::as_str)
                            .and_then(role)
                    } else {
                        None
                    },
                }
            })
            .collect())
    };
    next.allies = parse_team("myTeam")?;
    next.enemies = parse_team("theirTeam")?;
    let local = value.get("localPlayerCellId").and_then(Value::as_i64);
    next.player_role = value
        .get("myTeam")
        .and_then(Value::as_array)
        .and_then(|team| {
            team.iter()
                .find(|p| local.is_some() && p.get("cellId").and_then(Value::as_i64) == local)
        })
        .and_then(|p| p.get("assignedPosition"))
        .and_then(Value::as_str)
        .and_then(role);
    next.bans = ["myTeamBans", "theirTeamBans"]
        .iter()
        .flat_map(|key| {
            value
                .get("bans")
                .and_then(|b| b.get(*key))
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter_map(Value::as_u64)
        .filter(|id| *id > 0)
        .filter_map(|id| u32::try_from(id).ok())
        .collect();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn observed_custom_draft_is_supported_without_filling_empty_slots() {
        let value =
            serde_json::from_str(include_str!("../../tests/fixtures/client-draft.json")).unwrap();
        let mut snapshot = ClientSnapshot::default();
        populate(&mut snapshot, &value).unwrap();
        assert_eq!(snapshot.allies.len(), 1);
        assert!(snapshot.enemies.is_empty());
        assert!(snapshot.allies[0].champion_id.is_none());
    }
    #[test]
    fn credentials_require_https_and_valid_port() {
        assert!(parse_lockfile("LeagueClient:1:12345:test:https").is_ok());
        for raw in [
            "",
            "LeagueClient:1:0:test:https",
            "LeagueClient:1:12:test:http",
            "LeagueClient:1:12::https",
        ] {
            assert!(parse_lockfile(raw).is_err());
        }
    }
    #[test]
    fn unknown_roles_stay_unknown_and_tentative_picks_are_not_locked() {
        let mut snapshot = ClientSnapshot::default();
        populate(&mut snapshot, &serde_json::json!({"myTeam":[{"cellId":0,"championId":0,"championPickIntent":103,"assignedPosition":"middle"}],"theirTeam":[{"championId":1,"assignedPosition":""}],"localPlayerCellId":0,"bans":{"myTeamBans":[-1,2],"theirTeamBans":[3]}})).unwrap();
        assert!(!snapshot.allies[0].locked);
        assert_eq!(snapshot.player_role, Some(Role::Mid));
        assert_eq!(snapshot.enemies[0].role, None);
        assert_eq!(snapshot.bans, vec![2, 3]);
        assert!(populate(&mut snapshot, &serde_json::json!({})).is_err());
    }
    #[test]
    #[ignore = "requiere League of Legends abierto"]
    fn local_client_answers_with_valid_tls() {
        let snapshot = poll(&http_client().unwrap(), &ClientSnapshot::default());
        assert!(snapshot.connected, "{}", snapshot.message);
        assert!(snapshot.version.is_some());
    }
}
