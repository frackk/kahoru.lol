mod catalog;
mod client;
mod game_data;
mod knowledge;
mod loadout;
mod local_model;
mod provider_format;
mod session;
mod statistics;

use catalog::Catalog;
use game_data::{GameData, UpdateStatus};
use session::{Action, Session};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{Manager, State};

struct AppState {
    game: Mutex<GameData>,
    session: Arc<Mutex<Session>>,
    live: Arc<Mutex<client::ClientSnapshot>>,
    update: Arc<Mutex<UpdateStatus>>,
    cache: PathBuf,
    statistics: Arc<statistics::Statistics>,
    import_lock: Arc<Mutex<()>>,
    knowledge: Mutex<serde_json::Value>,
    model: Arc<local_model::Service>,
}

#[tauri::command]
fn get_local_model(state: State<'_, AppState>) -> local_model::Status {
    state.model.status()
}
#[tauri::command]
async fn configure_local_model(
    directory: String,
    state: State<'_, AppState>,
) -> Result<local_model::Status, String> {
    if busy(&state.live.lock().map_err(|_| "Sesión no disponible")?.phase) {
        return Err("Configurá el modelo fuera del draft y de la partida".into());
    }
    let model = state.model.clone();
    tauri::async_runtime::spawn_blocking(move || model.configure(&directory))
        .await
        .map_err(|_| "Verificación interrumpida")?
}
#[tauri::command]
fn cancel_strategy(request_id: String, state: State<'_, AppState>) {
    state.model.cancel(&request_id);
}
#[tauri::command]
async fn generate_strategy(
    request_id: String,
    session_id: String,
    champion_id: u32,
    context: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let manual = {
        let s = state.session.lock().map_err(|_| "Sesión no disponible")?;
        format!("sim-{}", s.draft.session_id) == session_id
            && matches!(
                s.phase,
                session::Phase::ChampSelect | session::Phase::DraftFinalizing
            )
            && s.draft
                .allies
                .iter()
                .any(|slot| slot.champion_id == Some(champion_id))
    };
    let live = state.live.clone();
    let model = state.model.clone();
    let simulator = state.session.clone();
    tauri::async_runtime::spawn_blocking(move || {
        model.generate(request_id, context, || {
            live.lock().is_ok_and(|s| {
                if manual {
                    !matches!(s.phase.as_str(), "GameStart" | "InProgress" | "Reconnect")
                        && simulator.lock().is_ok_and(|s| {
                            format!("sim-{}", s.draft.session_id) == session_id
                                && matches!(
                                    s.phase,
                                    session::Phase::ChampSelect | session::Phase::DraftFinalizing
                                )
                        })
                } else {
                    s.connected
                        && s.phase == "ChampSelect"
                        && s.session_id.as_deref() == Some(&session_id)
                        && s.player_champion_id == Some(champion_id)
                        && s.map_id == Some(11)
                }
            })
        })
    })
    .await
    .map_err(|_| "La estrategia se interrumpió")?
}

#[tauri::command]
fn get_client_knowledge(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state
        .knowledge
        .lock()
        .map(|k| k.clone())
        .map_err(|_| "Recomendaciones no disponibles".into())
}
#[tauri::command]
async fn get_import_targets(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let directory = state.cache.with_file_name("imports");
    tauri::async_runtime::spawn_blocking(move || {
        loadout::targets(&client::LocalClient::connect()?, &directory)
    })
    .await
    .map_err(|_| "No se pudieron consultar las páginas")?
}
#[tauri::command]
async fn restore_import(
    page_id: u64,
    champion_id: u32,
    session_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let directory = state.cache.with_file_name("imports");
    let live = state.live.clone();
    let guard = state.import_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard.try_lock().map_err(|_| "Ya hay un cambio en curso")?;
        let snapshot = live.lock().map_err(|_| "Sesión no disponible")?;
        if !snapshot.connected
            || snapshot.map_id != Some(11)
            || snapshot.phase != "ChampSelect"
            || snapshot.session_id.as_deref() != Some(&session_id)
            || snapshot.player_champion_id != Some(champion_id)
        {
            return Err("La selección cambió. No se restauró la página.".into());
        }
        drop(snapshot);
        loadout::restore(
            &client::LocalClient::connect()?,
            champion_id,
            page_id,
            &directory,
        )
    })
    .await
    .map_err(|_| "La restauración se interrumpió")?
}
#[tauri::command]
async fn import_loadout(
    request: loadout::Request,
    state: State<'_, AppState>,
) -> Result<loadout::Applied, String> {
    let game = state
        .game
        .lock()
        .map_err(|_| "Datos no disponibles")?
        .clone();
    let live = state.live.clone();
    let guard = state.import_lock.clone();
    let directory = state.cache.with_file_name("imports");
    tauri::async_runtime::spawn_blocking(move||{
        let _guard=guard.try_lock().map_err(|_|"Ya hay una importación en curso")?;
        let snapshot=live.lock().map_err(|_|"Sesión no disponible")?.clone();
        if !snapshot.connected||snapshot.phase!="ChampSelect"||snapshot.session_id.as_deref()!=Some(&request.session_id)||snapshot.player_champion_id!=Some(request.champion_id)||snapshot.map_id!=Some(11){return Err("La selección cambió o no corresponde al cliente real. Actualizá el plan antes de importar.".into());}
        loadout::apply(&client::LocalClient::connect()?,&game,&request,&directory)
    }).await.map_err(|_|"La importación se interrumpió")?
}

#[tauri::command]
async fn get_champion_analysis(
    champion_id: u32,
    role: String,
    refresh: bool,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    if matches!(
        state
            .live
            .lock()
            .map_err(|_| "Sesión no disponible")?
            .phase
            .as_str(),
        "InProgress" | "GameStart" | "Reconnect"
    ) {
        return Err("El análisis se prepara antes de entrar a partida.".into());
    }
    let slug = state
        .game
        .lock()
        .map_err(|_| "Datos no disponibles")?
        .catalog
        .champions
        .iter()
        .find(|c| c.id == champion_id)
        .map(|c| c.slug.clone())
        .ok_or("Campeón no disponible")?;
    let provider = state.statistics.clone();
    tauri::async_runtime::spawn_blocking(move || provider.analysis(&slug, &role, refresh))
        .await
        .map_err(|_| "Consulta estadística interrumpida")?
}

#[tauri::command]
fn get_live_session(state: State<'_, AppState>) -> Result<client::ClientSnapshot, String> {
    state
        .live
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "La conexión local no está disponible.".into())
}
#[tauri::command]
fn get_catalog(state: State<'_, AppState>) -> Result<Catalog, String> {
    state
        .game
        .lock()
        .map(|g| g.catalog.clone())
        .map_err(|_| "Los datos no están disponibles.".into())
}
#[tauri::command]
fn get_game_data(state: State<'_, AppState>) -> Result<GameData, String> {
    state
        .game
        .lock()
        .map(|g| g.clone())
        .map_err(|_| "Los datos no están disponibles.".into())
}
#[tauri::command]
fn get_update_status(state: State<'_, AppState>) -> Result<UpdateStatus, String> {
    state
        .update
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "El estado no está disponible.".into())
}
fn busy(phase: &str) -> bool {
    !matches!(phase, "Unknown" | "None" | "Lobby" | "EndOfGame")
}
#[tauri::command]
async fn update_game_data(state: State<'_, AppState>) -> Result<GameData, String> {
    let live = state
        .live
        .lock()
        .map_err(|_| "La sesión no está disponible")?
        .clone();
    if busy(&live.phase)
        || !matches!(
            state
                .session
                .lock()
                .map_err(|_| "Sesión no disponible")?
                .phase,
            session::Phase::Idle | session::Phase::PostGame
        )
    {
        return Err("Comprobá los datos fuera del draft y de la partida.".into());
    }
    let current = state
        .game
        .lock()
        .map_err(|_| "Datos no disponibles")?
        .clone();
    {
        let mut status = state.update.lock().map_err(|_| "Estado no disponible")?;
        if status.running {
            return Err("Ya hay una comprobación en curso.".into());
        }
        *status = UpdateStatus {
            running: true,
            completed: 0,
            total: 0,
            message: "Consultando versiones oficiales".into(),
        };
    }
    let cache = state.cache.clone();
    let progress = state.update.clone();
    let prepared = tauri::async_runtime::spawn_blocking(move || {
        let data = game_data::prepare(&current, live.version.as_deref(), &cache, progress)?;
        let knowledge = knowledge::refresh(&data);
        Ok::<_, String>((data, knowledge))
    })
    .await;
    let mut knowledge_message = String::new();
    let result: Result<GameData, String> = (|| {
        let (data, recommendations) =
            prepared.map_err(|_| "La actualización se interrumpió.")??;
        let live = state.live.lock().map_err(|_| "Sesión no disponible")?;
        let mut session = state.session.lock().map_err(|_| "Sesión no disponible")?;
        if busy(&live.phase)
            || !matches!(
                session.phase,
                session::Phase::Idle | session::Phase::PostGame
            )
        {
            return Err("La sesión empezó. Conservamos los datos que estabas usando.".into());
        }
        let mut next_knowledge = None;
        match recommendations {
            Ok(Some(value)) => {
                knowledge::save(&state.cache.with_file_name("knowledge.json"), &value)?;
                next_knowledge = Some(value);
                knowledge_message = "Runas, posiciones y kits del cliente comprobados.".into();
            }
            Ok(None) => {
                knowledge_message =
                    "Abrí LoL para comprobar también sus páginas recomendadas.".into()
            }
            Err(error) => knowledge_message = format!("Metadatos del cliente pendientes: {error}"),
        }
        game_data::activate(&data, &state.cache)?;
        if let Some(value) = next_knowledge {
            *state
                .knowledge
                .lock()
                .map_err(|_| "Recomendaciones no disponibles")? = value;
        }
        *state.game.lock().map_err(|_| "Datos no disponibles")? = data.clone();
        session.draft.patch = data.catalog.version.clone();
        Ok(data)
    })();
    if let Ok(mut s) = state.update.lock() {
        s.running = false;
        s.message = match &result {
            Ok(data) => format!(
                "Datos oficiales comprobados: {}. {} El análisis estadístico se consulta por campeón y posición.",
                data.catalog.version,knowledge_message
            ),
            Err(e) => e.clone(),
        };
    }
    result
}
#[tauri::command]
fn get_session(state: State<'_, AppState>) -> Result<Session, String> {
    state
        .session
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "La sesión no está disponible.".into())
}
#[tauri::command]
fn dispatch(action: Action, revision: u64, state: State<'_, AppState>) -> Result<Session, String> {
    let ids = state
        .game
        .lock()
        .map_err(|_| "Datos no disponibles")?
        .catalog
        .champions
        .iter()
        .map(|c| c.id)
        .collect::<Vec<_>>();
    let mut session = state
        .session
        .lock()
        .map_err(|_| "La sesión no está disponible.")?;
    session.apply(action, revision, &ids)?;
    Ok(session.clone())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let cache = app.path().app_cache_dir()?.join("game");
            let game = GameData::load(&cache);
            let knowledge = Mutex::new(knowledge::load(
                &cache.with_file_name("knowledge.json"),
                &game,
            ));
            let session = Arc::new(Mutex::new(Session::new(game.catalog.version.clone())));
            let live = Arc::new(Mutex::new(client::ClientSnapshot::default()));
            let worker = live.clone();
            std::thread::spawn(move || {
                let Ok(http) = client::http_client() else {
                    return;
                };
                loop {
                    let previous = match worker.lock() {
                        Ok(s) => s.clone(),
                        Err(_) => return,
                    };
                    let next = client::poll(&http, &previous);
                    let interval = if next.phase == "ChampSelect" {
                        1
                    } else if next.phase == "InProgress" {
                        10
                    } else {
                        3
                    };
                    if let Ok(mut s) = worker.lock() {
                        *s = next;
                    }
                    std::thread::sleep(std::time::Duration::from_secs(interval));
                }
            });
            app.manage(AppState {
                model: Arc::new(local_model::Service::new(
                    cache.with_file_name("local-model.json"),
                )),
                knowledge,
                import_lock: Arc::new(Mutex::new(())),
                statistics: Arc::new(statistics::Statistics::new(
                    cache.with_file_name("statistics"),
                )),
                game: Mutex::new(game),
                session,
                live,
                update: Arc::new(Mutex::new(UpdateStatus::default())),
                cache,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_game_data,
            get_live_session,
            get_session,
            dispatch,
            get_update_status,
            update_game_data,
            get_champion_analysis,
            import_loadout,
            get_import_targets,
            get_client_knowledge,
            restore_import,
            get_local_model,
            configure_local_model,
            cancel_strategy,
            generate_strategy
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar kahoru.lol");
}
