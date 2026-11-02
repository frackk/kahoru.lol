use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashSet};

#[derive(Deserialize)]
pub struct Reason {
    id: String,
    text: String,
}
#[derive(Deserialize)]
pub struct Candidate {
    id: String,
    reasons: Vec<Reason>,
}
pub fn read(context: &str) -> Result<Option<Vec<Candidate>>, String> {
    if context.len() > 64_000 {
        return Err("Contexto de configuraciones demasiado extenso".into());
    }
    let value: Value = serde_json::from_str(context).map_err(|_| "Contexto inválido")?;
    if value["kind"] != "configuration" {
        return Ok(None);
    }
    let candidates: Vec<Candidate> = serde_json::from_value(value["candidates"].clone())
        .map_err(|_| "Configuraciones incompletas")?;
    let mut ids = HashSet::new();
    if candidates.is_empty()
        || candidates.len() > 12
        || candidates.iter().any(|p| {
            let mut reasons = HashSet::new();
            p.id.len() > 160
                || p.id.is_empty()
                || !p.id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
                || !ids.insert(&p.id)
                || p.reasons.is_empty()
                || p.reasons.len() > 30
                || p.reasons.iter().any(|r| {
                    r.id.len() > 10
                        || r.id.is_empty()
                        || !reasons.insert(&r.id)
                        || r.text.is_empty()
                        || r.text.len() > 2000
                })
        })
    {
        return Err("Configuraciones fuera del contrato".into());
    }
    Ok(Some(candidates))
}
pub fn schema(candidates: &[Candidate]) -> Value {
    let reasons: BTreeSet<_> = candidates
        .iter()
        .flat_map(|p| p.reasons.iter().map(|r| &r.id))
        .collect();
    json!({"type":"object","properties":{"planId":{"type":"string","enum":candidates.iter().map(|p|&p.id).collect::<Vec<_>>()},"reasonIds":{"type":"array","minItems":1,"maxItems":3,"items":{"type":"string","enum":reasons}}},"required":["planId","reasonIds"],"additionalProperties":false})
}
pub fn select(candidates: &[Candidate], answer: &str) -> Result<String, String> {
    let value: Value =
        serde_json::from_str(answer).map_err(|_| "Respuesta de configuración inválida")?;
    if value.as_object().is_none_or(|o| o.len() != 2) {
        return Err("Respuesta fuera del contrato".into());
    }
    let candidate = candidates
        .iter()
        .find(|p| value["planId"] == p.id)
        .ok_or("La IA eligió una configuración desconocida")?;
    let reasons = value["reasonIds"]
        .as_array()
        .filter(|r| !r.is_empty() && r.len() <= 3)
        .ok_or("Faltan motivos de elección")?;
    let mut selected = HashSet::new();
    for reason in reasons {
        let id = reason.as_str().ok_or("Motivo inválido")?;
        if !selected.insert(id) || !candidate.reasons.iter().any(|r| r.id == id) {
            return Err("Motivo ajeno a la configuración elegida".into());
        }
    }
    serde_json::to_string(&value).map_err(|_| "No se pudo devolver el análisis".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn choices_and_reasons_must_belong_to_the_same_candidate() {
        let context = r#"{"kind":"configuration","candidates":[{"id":"config-1","reasons":[{"id":"a","text":"Armadura"}]},{"id":"config-2","reasons":[{"id":"b","text":"Movilidad"}]}]}"#;
        let candidates = read(context).unwrap().unwrap();
        assert!(select(&candidates, r#"{"planId":"config-1","reasonIds":["a"]}"#).is_ok());
        assert!(select(&candidates, r#"{"planId":"config-1","reasonIds":["b"]}"#).is_err());
        assert!(select(&candidates, r#"{"planId":"inventado","reasonIds":["a"]}"#).is_err());
        assert!(select(
            &candidates,
            r#"{"planId":"config-1","reasonIds":["a","a"]}"#
        )
        .is_err());
    }
}
