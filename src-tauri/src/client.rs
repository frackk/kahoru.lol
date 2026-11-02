use crate::session::{DraftSlot, Role};
use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;
use std::{path::PathBuf, time::Duration};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSnapshot {
    #[serde(skip)]
    game_id: Option<u64>,
    pub session_id: Option<String>,
    pub player_champion_id: Option<u32>,
    pub map_id: Option<u32>,
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
            game_id: None,
            session_id: None,
            player_champion_id: None,
            map_id: None,
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
        let metadata = if matches!(
            phase,
            "ChampSelect"
                | "GameStart"
                | "InProgress"
                | "Reconnect"
                | "WaitingForStats"
                | "PreEndOfGame"
                | "EndOfGame"
        ) {
            Some(read(client, &credentials, "/lol-gameflow/v1/session")?)
        } else {
            None
        };
        let mut next = carry_session(previous, phase, metadata.as_ref());
        next.connected = true;
        next.phase = phase.into();
        next.message = "Cliente conectado".into();
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

fn carry_session(
    previous: &ClientSnapshot,
    phase: &str,
    metadata: Option<&Value>,
) -> ClientSnapshot {
    let id = metadata
        .and_then(|v| v.get("gameData"))
        .and_then(|g| g.get("gameId"))
        .and_then(Value::as_u64)
        .filter(|id| *id > 0);
    let draft_continues = previous.connected
        && previous.phase == "ChampSelect"
        && (previous.game_id.is_none() || id.is_none() || previous.game_id == id);
    let same_game = id.is_some() && previous.game_id == id;
    let in_game = matches!(
        phase,
        "GameStart" | "InProgress" | "Reconnect" | "WaitingForStats" | "PreEndOfGame" | "EndOfGame"
    );
    let preserve = in_game && (draft_continues || same_game);
    let mut next = if preserve {
        previous.clone()
    } else {
        ClientSnapshot::default()
    };
    next.game_id = id;
    next.map_id = metadata
        .and_then(|m| m.get("map"))
        .and_then(|m| m.get("id"))
        .and_then(Value::as_u64)
        .and_then(|n| u32::try_from(n).ok());
    if phase == "ChampSelect" || in_game {
        next.session_id = if draft_continues || preserve {
            previous.session_id.clone()
        } else {
            None
        };
        if next.session_id.is_none() {
            next.session_id = id.map(|id| format!("lcu-{id}"));
        }
        if next.session_id.is_none() && phase == "ChampSelect" {
            next.session_id = Some(format!(
                "lcu-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos()
            ));
        }
    }
    next
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
    next.player_champion_id = value
        .get("myTeam")
        .and_then(Value::as_array)
        .and_then(|team| {
            team.iter()
                .position(|p| local.is_some() && p.get("cellId").and_then(Value::as_i64) == local)
        })
        .and_then(|i| next.allies.get(i))
        .and_then(|slot| slot.champion_id);
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

pub struct LocalClient {
    http: Client,
    credentials: Credentials,
}
impl LocalClient {
    pub fn connect() -> Result<Self, String> {
        let path = discover().ok_or("Abrí el cliente de League of Legends.")?;
        let credentials = parse_lockfile(
            &std::fs::read_to_string(path).map_err(|_| "No se pudo leer la conexión local")?,
        )
        .map_err(str::to_string)?;
        Ok(Self {
            http: http_client().map_err(|_| "No se pudo iniciar la conexión local")?,
            credentials,
        })
    }
    pub fn get(&self, path: &str) -> Result<Value, String> {
        read(&self.http, &self.credentials, path).map_err(str::to_string)
    }
    pub fn change(
        &self,
        method: reqwest::Method,
        path: &str,
        body: &Value,
    ) -> Result<Value, String> {
        let response = self
            .http
            .request(
                method,
                format!("https://127.0.0.1:{}{path}", self.credentials.port),
            )
            .basic_auth("riot", Some(&self.credentials.password))
            .json(body)
            .send()
            .map_err(|_| "Se perdió la conexión durante la importación")?;
        if !response.status().is_success() {
            return Err("El cliente rechazó el cambio. Comprobá la fase y las ranuras de páginas disponibles.".into());
        }
        let bytes = response
            .bytes()
            .map_err(|_| "No se pudo comprobar el cambio")?;
        if bytes.is_empty() {
            Ok(Value::Null)
        } else {
            serde_json::from_slice(&bytes)
                .map_err(|_| "Respuesta de importación no compatible".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn game_identity_preserves_a_prepared_draft_across_loading_and_reconnect() {
        let mut draft = ClientSnapshot {
            connected: true,
            phase: "ChampSelect".into(),
            session_id: Some("draft-before-id".into()),
            player_champion_id: Some(103),
            ..Default::default()
        };
        let metadata = serde_json::json!({"gameData":{"gameId":42},"map":{"id":11}});
        let mut game = carry_session(&draft, "InProgress", Some(&metadata));
        assert_eq!(game.session_id, draft.session_id);
        assert_eq!(game.player_champion_id, Some(103));
        game.phase = "InProgress".into();
        game.connected = false;
        assert_eq!(
            carry_session(&game, "InProgress", Some(&metadata)).session_id,
            draft.session_id
        );
        let other = serde_json::json!({"gameData":{"gameId":43},"map":{"id":11}});
        assert!(carry_session(&game, "InProgress", Some(&other))
            .player_champion_id
            .is_none());
        draft.phase = "Lobby".into();
        assert!(carry_session(&draft, "Lobby", None).session_id.is_none());
    }
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
