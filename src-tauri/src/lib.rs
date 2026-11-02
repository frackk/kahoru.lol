mod catalog;
mod client;
mod game_data;
mod session;

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
    session: Mutex<Session>,
    live: Arc<Mutex<client::ClientSnapshot>>,
    update: Arc<Mutex<UpdateStatus>>,
    cache: PathBuf,
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
        game_data::prepare(&current, live.version.as_deref(), &cache, progress)
    })
    .await;
    let result: Result<GameData, String> = (|| {
        let data = prepared.map_err(|_| "La actualización se interrumpió.")??;
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
        game_data::activate(&data, &state.cache)?;
        *state.game.lock().map_err(|_| "Datos no disponibles")? = data.clone();
        session.draft.patch = data.catalog.version.clone();
        Ok(data)
    })();
    if let Ok(mut s) = state.update.lock() {
        s.running = false;
        s.message = match &result {
            Ok(data) => format!(
                "Datos oficiales comprobados: {}. Estadísticas de meta sin proveedor conectado.",
                data.catalog.version
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
            let session = Mutex::new(Session::new(game.catalog.version.clone()));
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
            update_game_data
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar kahoru.lol");
}
