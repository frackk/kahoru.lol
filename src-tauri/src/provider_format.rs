use serde_json::{Map, Value};
use std::collections::HashMap;

// El proveedor usa constructores con una cabecera de campos; nunca se evalúan como código.
pub fn decode(text: &str) -> Result<Value, String> {
    if text.len() > 2_000_000 {
        return Err("Respuesta estadística demasiado grande".into());
    }
    if let Ok(value) = serde_json::from_str(text) {
        return Ok(value);
    }
    let mut classes = HashMap::new();
    let mut body = vec![];
    for line in text.lines() {
        if let Some(definition) = line.strip_prefix("class ") {
            let (name, fields) = definition
                .split_once(':')
                .ok_or("Cabecera estadística inválida")?;
            let fields: Vec<String> = fields.split(',').map(|f| f.trim().to_string()).collect();
            if classes.insert(name.trim().to_string(), fields).is_some() {
                return Err("Cabecera duplicada".into());
            }
        } else if !line.trim().is_empty() {
            body.push(line);
        }
    }
    let input = body.join("\n");
    let mut parser = Parser {
        bytes: input.as_bytes(),
        index: 0,
        classes,
        nodes: 0,
    };
    let value = parser.value(0)?;
    parser.space();
    if parser.index != parser.bytes.len() {
        return Err("Contenido estadístico inesperado".into());
    }
    Ok(value)
}
struct Parser<'a> {
    bytes: &'a [u8],
    index: usize,
    classes: HashMap<String, Vec<String>>,
    nodes: usize,
}
impl Parser<'_> {
    fn space(&mut self) {
        while self
            .bytes
            .get(self.index)
            .is_some_and(u8::is_ascii_whitespace)
        {
            self.index += 1;
        }
    }
    fn eat(&mut self, token: u8) -> bool {
        self.space();
        if self.bytes.get(self.index) == Some(&token) {
            self.index += 1;
            true
        } else {
            false
        }
    }
    fn value(&mut self, depth: usize) -> Result<Value, String> {
        self.nodes += 1;
        if depth > 40 || self.nodes > 50000 {
            return Err("Estructura estadística demasiado compleja".into());
        }
        self.space();
        if self.eat(b'[') {
            return Ok(Value::Array(self.sequence(b']', depth)?));
        }
        let start = self.index;
        if self.bytes.get(start) == Some(&b'"') {
            self.index += 1;
            let mut escaped = false;
            while let Some(&b) = self.bytes.get(self.index) {
                self.index += 1;
                if b == b'"' && !escaped {
                    return serde_json::from_slice(&self.bytes[start..self.index])
                        .map_err(|_| "Texto estadístico inválido".into());
                }
                escaped = b == b'\\' && !escaped;
            }
            return Err("Texto estadístico incompleto".into());
        }
        while self
            .bytes
            .get(self.index)
            .is_some_and(|b| b.is_ascii_alphanumeric() || b"_+-.".contains(b))
        {
            self.index += 1;
        }
        if self.index == start {
            return Err("Valor estadístico inválido".into());
        }
        let token = std::str::from_utf8(&self.bytes[start..self.index])
            .map_err(|_| "Codificación inválida")?;
        if let Ok(v) = serde_json::from_str::<Value>(token) {
            return Ok(v);
        }
        if !self.eat(b'(') {
            return Err("Constructor estadístico inválido".into());
        }
        let fields = self
            .classes
            .get(token)
            .ok_or("Tipo estadístico desconocido")?
            .clone();
        let values = self.sequence(b')', depth)?;
        if fields.len() != values.len() {
            return Err("Campos estadísticos incompletos".into());
        }
        let mut object = Map::new();
        for (name, value) in fields.into_iter().zip(values) {
            if object.insert(name, value).is_some() {
                return Err("Campo estadístico duplicado".into());
            }
        }
        Ok(Value::Object(object))
    }
    fn sequence(&mut self, end: u8, depth: usize) -> Result<Vec<Value>, String> {
        let mut values = vec![];
        if self.eat(end) {
            return Ok(values);
        }
        loop {
            values.push(self.value(depth + 1)?);
            if self.eat(end) {
                return Ok(values);
            }
            if !self.eat(b',') {
                return Err("Separador estadístico inválido".into());
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn decodes_nested_rows_without_executing_text() {
        let v=decode("class Report: champion,data\nclass Row: ids,play,win\n\nReport(\"VIEGO\",[Row([6672,6676],200,100)])").unwrap();
        assert_eq!(v["data"][0]["play"], 200);
        assert!(decode("class Row: value\nRow(1);system(\"anything\")").is_err());
        assert!(decode("class Row: a,b\nRow(1)").is_err());
        assert!(decode("Missing(1)").is_err());
    }
}
