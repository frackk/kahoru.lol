use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::Read,
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    name: String,
    model_file: String,
    model_sha256: String,
    runtime_files: BTreeMap<String, String>,
}
fn manifest() -> Manifest {
    serde_json::from_str(include_str!("../../data/local-model.json"))
        .expect("Manifiesto de modelo inválido")
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    directory: String,
    installed: bool,
    model: String,
}
pub struct Service {
    config: PathBuf,
    lock: Mutex<()>,
    active: Mutex<Option<(String, Arc<AtomicBool>)>>,
    verified: Mutex<Option<(PathBuf, Vec<SystemTime>)>>,
}
impl Service {
    pub fn new(config: PathBuf) -> Self {
        Self {
            config,
            lock: Mutex::new(()),
            active: Mutex::new(None),
            verified: Mutex::new(None),
        }
    }
    fn directory(&self) -> Option<PathBuf> {
        let value: Value = serde_json::from_slice(&std::fs::read(&self.config).ok()?).ok()?;
        Some(PathBuf::from(value["directory"].as_str()?))
    }
    pub fn status(&self) -> Status {
        let m = manifest();
        let root = self.directory();
        Status {
            installed: root.as_ref().is_some_and(|p| {
                p.join(&m.model_file).is_file() && p.join("runtime/llama-server.exe").is_file()
            }),
            directory: root
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default(),
            model: m.name,
        }
    }
    pub fn configure(&self, directory: &str) -> Result<Status, String> {
        let _guard = self
            .lock
            .try_lock()
            .map_err(|_| "Hay una generación en curso")?;
        let root = Path::new(directory)
            .canonicalize()
            .map_err(|_| "La carpeta del modelo no existe")?;
        self.verify(&root, || true)?;
        let parent = self.config.parent().ok_or("Configuración no disponible")?;
        std::fs::create_dir_all(parent).map_err(|_| "No se pudo guardar la configuración")?;
        let mut file = tempfile::NamedTempFile::new_in(parent)
            .map_err(|_| "No se pudo guardar la configuración")?;
        use std::io::Write;
        file.write_all(
            serde_json::to_string(&json!({"directory":root}))
                .map_err(|_| "Ruta inválida")?
                .as_bytes(),
        )
        .map_err(|_| "No se pudo guardar la configuración")?;
        file.persist(&self.config)
            .map_err(|_| "No se pudo activar el modelo")?;
        Ok(self.status())
    }
    fn verify(&self, root: &Path, allowed: impl Fn() -> bool) -> Result<(), String> {
        let m = manifest();
        let files: Vec<_> = std::iter::once((root.join(m.model_file), m.model_sha256))
            .chain(
                m.runtime_files
                    .into_iter()
                    .map(|(f, h)| (root.join("runtime").join(f), h)),
            )
            .collect();
        let times: Vec<_> = files
            .iter()
            .map(|(p, _)| {
                p.metadata()
                    .and_then(|m| m.modified())
                    .map_err(|_| "Faltan archivos del modelo local")
            })
            .collect::<Result<_, _>>()?;
        if self
            .verified
            .lock()
            .map_err(|_| "Modelo no disponible")?
            .as_ref()
            .is_some_and(|(p, t)| p == root && t == &times)
        {
            return Ok(());
        }
        for (path, expected) in files {
            let mut file = std::fs::File::open(path).map_err(|_| "No se pudo leer el modelo")?;
            let mut hash = Sha256::new();
            let mut buffer = vec![0u8; 1024 * 1024];
            loop {
                if !allowed() {
                    return Err("Verificación cancelada".into());
                }
                let n = file
                    .read(&mut buffer)
                    .map_err(|_| "No se pudo verificar el modelo")?;
                if n == 0 {
                    break;
                }
                hash.update(&buffer[..n]);
            }
            if format!("{:x}", hash.finalize()) != expected {
                return Err("El modelo o su runtime no coincide con la versión verificada. Volvé a preparar los archivos.".into());
            }
        }
        *self.verified.lock().map_err(|_| "Modelo no disponible")? = Some((root.to_owned(), times));
        Ok(())
    }
    pub fn cancel(&self, id: &str) {
        if let Ok(active) = self.active.lock() {
            if let Some((key, token)) = active.as_ref() {
                if key == id {
                    token.store(true, Ordering::Relaxed);
                }
            }
        }
    }
    pub fn generate(
        &self,
        id: String,
        context: String,
        allowed: impl Fn() -> bool,
    ) -> Result<String, String> {
        if context.len() > 64_000 || context.len() < 30 || id.len() > 100 {
            return Err("Contexto de preparación inválido".into());
        }
        let configuration = crate::configuration_model::read(&context)?;
        let facts = if configuration.is_none() {
            read_facts(&context)?
        } else {
            vec![]
        };
        let schema = configuration
            .as_ref()
            .map(|c| crate::configuration_model::schema(c))
            .unwrap_or_else(|| selection_schema(&facts));
        let prompt = if configuration.is_some() {
            include_str!("../../data/configuration-prompt.txt")
        } else {
            include_str!("../../data/strategy-prompt.txt")
        };
        let _guard = self
            .lock
            .try_lock()
            .map_err(|_| "Ya hay una estrategia en preparación")?;
        if !allowed() {
            return Err("La estrategia se prepara antes de entrar a partida".into());
        }
        let token = Arc::new(AtomicBool::new(false));
        *self.active.lock().map_err(|_| "Modelo no disponible")? =
            Some((id.clone(), token.clone()));
        let run = || {
            let root = self
                .directory()
                .ok_or("Configurá el modelo local en Ajustes")?;
            self.verify(&root, || !token.load(Ordering::Relaxed) && allowed())?;
            if token.load(Ordering::Relaxed) || !allowed() {
                return Err("Preparación cancelada".into());
            }
            let listener = TcpListener::bind("127.0.0.1:0")
                .map_err(|_| "No se pudo reservar el puerto local")?;
            let port = listener
                .local_addr()
                .map_err(|_| "Puerto no disponible")?
                .port();
            let key = format!(
                "{:x}",
                Sha256::digest(format!("{id}{:?}", SystemTime::now()))
            );
            let mut command = Command::new(root.join("runtime/llama-server.exe"));
            command
                .current_dir(root.join("runtime"))
                .args(["-m"])
                .arg(root.join(manifest().model_file))
                .args([
                    "--host",
                    "127.0.0.1",
                    "--port",
                    &port.to_string(),
                    "--api-key",
                    &key,
                    "--no-webui",
                    "--no-warmup",
                    "--log-disable",
                    "--reasoning",
                    "off",
                    "--parallel",
                    "1",
                    "--threads-http",
                    "2",
                    "-t",
                    "4",
                    "-c",
                    "16384",
                    "-ngl",
                    "99",
                    "--timeout",
                    "40",
                ])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            drop(listener);
            let child = command
                .spawn()
                .map_err(|_| "No se pudo iniciar el runtime local")?;
            let mut process = ModelProcess::new(child)?;
            let started = Instant::now();
            let valid = || {
                !token.load(Ordering::Relaxed)
                    && allowed()
                    && started.elapsed() < Duration::from_secs(50)
            };
            let http = reqwest::blocking::Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_millis(300))
                .build()
                .map_err(|_| "HTTP local no disponible")?;
            let base = format!("http://127.0.0.1:{port}");
            loop {
                if !valid() {
                    return Err("Preparación cancelada o fuera de tiempo".into());
                }
                if process
                    .child
                    .try_wait()
                    .map_err(|_| "Runtime interrumpido")?
                    .is_some()
                {
                    return Err("El runtime no pudo cargar el modelo. Revisá memoria y controladores gráficos.".into());
                }
                if http
                    .get(format!("{base}/health"))
                    .bearer_auth(&key)
                    .send()
                    .is_ok_and(|r| r.status().is_success())
                {
                    break;
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let result = (|| {
                    let client = reqwest::blocking::Client::builder()
                        .no_proxy()
                        .redirect(reqwest::redirect::Policy::none())
                        .timeout(Duration::from_secs(40))
                        .build()
                        .map_err(|_| "HTTP local no disponible")?;
                    let response=client.post(format!("{base}/v1/chat/completions")).bearer_auth(key).json(&json!({"messages":[{"role":"system","content":prompt},{"role":"user","content":context}],"temperature":0.2,"seed":42,"max_tokens":200,"stream":false,"response_format":{"type":"json_schema","json_schema":{"name":"priorities","strict":true,"schema":schema}}})).send().map_err(|_|"La generación local se interrumpió")?.error_for_status().map_err(|_|"El modelo rechazó el contexto")?;
                    let mut bytes = vec![];
                    response
                        .take(64_001)
                        .read_to_end(&mut bytes)
                        .map_err(|_| "Respuesta local incompleta")?;
                    if bytes.len() > 64_000 {
                        return Err("Respuesta local demasiado extensa".into());
                    }
                    let value: Value =
                        serde_json::from_slice(&bytes).map_err(|_| "Respuesta local inválida")?;
                    if value["choices"][0]["finish_reason"] != "stop" {
                        return Err("El modelo no terminó el texto dentro del límite".into());
                    }
                    let answer = value["choices"][0]["message"]["content"]
                        .as_str()
                        .unwrap_or_default();
                    if let Some(candidates) = &configuration {
                        return crate::configuration_model::select(candidates, answer);
                    }
                    select_facts(
                        &facts,
                        value["choices"][0]["message"]["content"]
                            .as_str()
                            .unwrap_or_default(),
                    )
                })();
                let _ = tx.send(result);
            });
            loop {
                if !valid() {
                    return Err("Preparación cancelada o fuera de tiempo".into());
                }
                match rx.recv_timeout(Duration::from_millis(150)) {
                    Ok(result) => return result,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        return Err("La generación se interrumpió".into())
                    }
                    Err(_) => {}
                }
            }
        };
        let result = run();
        if let Ok(mut a) = self.active.lock() {
            *a = None;
        }
        result
    }
}
#[derive(Deserialize)]
struct Fact {
    id: String,
    phase: String,
    text: String,
}
fn read_facts(context: &str) -> Result<Vec<Fact>, String> {
    let value: Value = serde_json::from_str(context).map_err(|_| "Contexto inválido")?;
    let facts: Vec<Fact> =
        serde_json::from_value(value["facts"].clone()).map_err(|_| "Faltan hechos estratégicos")?;
    let mut ids = std::collections::HashSet::new();
    if facts.len() > 20
        || facts.iter().any(|f| {
            f.id.len() > 20
                || !ids.insert(&f.id)
                || f.text.is_empty()
                || f.text.len() > 1500
                || f.text.contains('<')
                || !["opening", "objectives", "fights"].contains(&f.phase.as_str())
        })
        || ["opening", "objectives", "fights"]
            .iter()
            .any(|phase| !facts.iter().any(|f| f.phase == *phase))
    {
        return Err("Hechos estratégicos incompletos".into());
    }
    Ok(facts)
}
fn selection_schema(facts: &[Fact]) -> Value {
    let properties:serde_json::Map<String,Value>=["opening","objectives","fights"].into_iter().map(|phase|(phase.into(),json!({"type":"array","minItems":1,"maxItems":if phase == "fights" {2} else {1},"items":{"type":"string","enum":facts.iter().filter(|f|f.phase==phase).map(|f|&f.id).collect::<Vec<_>>()}}))).collect();
    json!({"type":"object","properties":properties,"required":["opening","objectives","fights"],"additionalProperties":false})
}
fn select_facts(facts: &[Fact], text: &str) -> Result<String, String> {
    let value: Value =
        serde_json::from_str(text).map_err(|_| "El modelo no seleccionó prioridades válidas")?;
    if value.as_object().is_none_or(|o| o.len() != 3) {
        return Err("Respuesta de prioridades no compatible".into());
    }
    let mut selected = std::collections::HashSet::new();
    let mut paragraphs = vec![];
    for phase in ["opening", "objectives", "fights"] {
        let ids = value[phase]
            .as_array()
            .filter(|a| !a.is_empty() && a.len() <= if phase == "fights" { 2 } else { 1 })
            .ok_or("Faltan prioridades de una fase")?;
        let mut lines = vec![];
        for id in ids {
            let id = id.as_str().ok_or("Prioridad inválida")?;
            let fact = facts
                .iter()
                .find(|f| f.id == id && f.phase == phase)
                .ok_or("El modelo eligió un hecho fuera de contexto")?;
            if !selected.insert(id) {
                return Err("Prioridad repetida".into());
            }
            lines.push(fact.text.as_str());
        }
        paragraphs.push(lines.join(" "));
    }
    Ok(paragraphs.join("\n\n"))
}

struct ModelProcess {
    child: Child,
    #[cfg(windows)]
    job: windows_sys::Win32::Foundation::HANDLE,
}
impl ModelProcess {
    fn new(mut child: Child) -> Result<Self, String> {
        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
            // El cierre del proceso principal también debe liberar cualquier hijo del runtime.
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                if job.is_null()
                    || SetInformationJobObject(
                        job,
                        JobObjectExtendedLimitInformation,
                        &info as *const _ as _,
                        std::mem::size_of_val(&info) as u32,
                    ) == 0
                    || AssignProcessToJobObject(job, child.as_raw_handle()) == 0
                {
                    if !job.is_null() {
                        CloseHandle(job);
                    }
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("No se pudo aislar el proceso del modelo".into());
                }
                Ok(Self { child, job })
            }
        }
        #[cfg(not(windows))]
        {
            Ok(Self { child })
        }
    }
}
impl Drop for ModelProcess {
    fn drop(&mut self) {
        #[cfg(windows)]
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.job);
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unknown_or_wrong_phase_facts() {
        let facts=read_facts(r#"{"facts":[{"id":"a","phase":"opening","text":"Inicio"},{"id":"b","phase":"objectives","text":"Objetivos"},{"id":"c","phase":"fights","text":"Peleas"}]}"#).unwrap();
        assert_eq!(
            select_facts(
                &facts,
                r#"{"opening":["a"],"objectives":["b"],"fights":["c"]}"#
            )
            .unwrap(),
            "Inicio\n\nObjetivos\n\nPeleas"
        );
        assert!(select_facts(
            &facts,
            r#"{"opening":["c"],"objectives":["b"],"fights":["a"]}"#
        )
        .is_err());
        assert!(select_facts(
            &facts,
            r#"{"opening":["inventado"],"objectives":["b"],"fights":["c"]}"#
        )
        .is_err());
    }
    #[test]
    fn empty_installation_is_not_reported_as_ready() {
        let d = tempfile::tempdir().unwrap();
        let s = Service::new(d.path().join("config.json"));
        assert!(!s.status().installed);
        assert!(s.configure(d.path().to_str().unwrap()).is_err());
    }
    #[test]
    #[ignore = "requiere modelo verificado y GPU o CPU compatibles"]
    fn installed_model_generates_preparation() {
        if let Ok(client) = crate::client::LocalClient::connect() {
            assert!(!matches!(
                client
                    .get("/lol-gameflow/v1/gameflow-phase")
                    .unwrap()
                    .as_str(),
                Some("GameStart" | "InProgress" | "Reconnect")
            ));
        }
        let root = std::env::var("KAHORU_MODEL_DIR").unwrap();
        let context =
            std::fs::read_to_string(std::env::var("KAHORU_STRATEGY_CONTEXT").unwrap()).unwrap();
        let temp = tempfile::tempdir().unwrap();
        let service = Service::new(temp.path().join("config.json"));
        service.configure(&root).unwrap();
        let start = Instant::now();
        let text = service
            .generate("integration".into(), context, || true)
            .unwrap();
        println!("{}\nDuración: {:?}", text, start.elapsed());
        assert!(text.contains("Viego"));
    }
}
