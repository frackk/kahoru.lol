mod catalog;
mod session;

use catalog::Catalog;
use session::{Action, Session};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    catalog: Catalog,
    session: Mutex<Session>,
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
    tauri::Builder::default()
        .manage(AppState { catalog, session })
        .invoke_handler(tauri::generate_handler![get_catalog, get_session, dispatch])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar kahoru.lol");
}
