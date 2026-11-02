mod catalog;
mod client;
mod session;

use catalog::Catalog;
use session::{Action, Session};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    catalog: Catalog,
    session: Mutex<Session>,
    live: std::sync::Arc<Mutex<client::ClientSnapshot>>,
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
fn get_catalog(state: State<'_, AppState>) -> Catalog {
    state.catalog.clone()
}

#[tauri::command]
fn get_session(state: State<'_, AppState>) -> Result<Session, String> {
    state
        .session
        .lock()
        .map(|session| session.clone())
        .map_err(|_| "La sesión no está disponible.".into())
}

#[tauri::command]
fn dispatch(action: Action, revision: u64, state: State<'_, AppState>) -> Result<Session, String> {
    let ids = state
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
    let catalog = Catalog::bundled()
        .expect("El catálogo incluido debe superar la validación antes de distribuirse");
    let session = Mutex::new(Session::new(catalog.version.clone()));
    let live = std::sync::Arc::new(Mutex::new(client::ClientSnapshot::default()));
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
    tauri::Builder::default()
        .manage(AppState {
            catalog,
            session,
            live,
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_session,
            dispatch,
            get_live_session
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar kahoru.lol");
}
