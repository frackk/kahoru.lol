import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const root = new URL("../.local/ai/", import.meta.url);
await mkdir(root, { recursive: true });
async function checksum(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path, {
    highWaterMark: 4 * 1024 * 1024,
  }))
    hash.update(bytes);
  return hash.digest("hex");
}
const files = [
  {
    name: "runtime.zip",
    url: "https://github.com/ggml-org/llama.cpp/releases/download/b11960/llama-b11960-bin-win-vulkan-x64.zip",
    sha256: "bac6914b5e83523eb008c6789eaa12669f93fbc196c3b9e8237b6672323b33e9",
  },
  {
    name: "model-4b.gguf",
    url: "https://huggingface.co/lmstudio-community/Qwen3-4B-Instruct-2507-GGUF/resolve/4edb920b6f14e3b9284d4502a6485103d72cde05/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    sha256: "8cdb57cbb880d313736a9bc4e3d3d2485f145b5e19cf33783746e753e82641fc",
  },
];
for (const f of files) {
  const target = new URL(f.name, root);
  let valid = false;
  try {
    valid = (await checksum(target)) === f.sha256;
  } catch {
    /* Descargar cuando no hay un archivo verificado. */
  }
  if (valid) {
    console.log(f.name, "verificado");
    continue;
  }
  const r = await fetch(f.url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
  if (!r.ok || !r.body) throw Error(`No se pudo descargar ${f.name}`);
  const hash = createHash("sha256");
  const stream = Readable.fromWeb(r.body);
  stream.on("data", (b) => hash.update(b));
  const partial = new URL(f.name + ".part", root);
  await pipeline(stream, createWriteStream(partial));
  if (hash.digest("hex") !== f.sha256)
    throw Error(`Checksum inválido: ${f.name}`);
  await rename(partial, target);
  console.log(f.name, "descargado y verificado");
}
await writeFile(
  new URL("sources.json", root),
  JSON.stringify(
    {
      runtime: "llama.cpp b11960 MIT",
      model:
        "Qwen3 4B Instruct 2507 Q4_K_M, Apache-2.0; cuantización de bartowski / LM Studio Community",
      files,
    },
    null,
    2,
  ),
);
if (process.platform !== "win32")
  throw Error("El runtime preparado es para Windows x64.");
const extract = `
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($env:KAHORU_MODEL_DIR)
$destination = [IO.Path]::GetFullPath((Join-Path $root 'runtime'))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $root 'runtime.zip'))
try {
  foreach ($entry in $zip.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
    if (-not $target.StartsWith($destination + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta de archivo no permitida' }
  }
  foreach ($entry in $zip.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
    if ($entry.Name) {
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    } else { [IO.Directory]::CreateDirectory($target) | Out-Null }
  }
} finally { $zip.Dispose() }
`;
await promisify(execFile)(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-Command", extract],
  {
    windowsHide: true,
    env: { ...process.env, KAHORU_MODEL_DIR: fileURLToPath(root) },
  },
);
for (const [name, url] of [
  [
    "LICENSE-llama.cpp.txt",
    "https://raw.githubusercontent.com/ggml-org/llama.cpp/b11960/LICENSE",
  ],
  [
    "LICENSE-Qwen.txt",
    "https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507/raw/main/LICENSE",
  ],
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw Error(`No se pudo obtener ${name}`);
  await writeFile(new URL(name, root), await response.text());
}
console.log("Modelo preparado en", fileURLToPath(root));
const manifest = JSON.parse(
  await readFile(new URL("../data/local-model.json", import.meta.url), "utf8"),
);
for (const [name, hash] of Object.entries(manifest.runtimeFiles)) {
  if ((await checksum(new URL(`runtime/${name}`, root))) !== hash)
    throw Error(`Runtime no compatible: ${name}`);
}
if (process.argv.includes("--activate")) {
  const folder = join(process.env.LOCALAPPDATA, "one.frack.kahoru");
  await mkdir(folder, { recursive: true });
  const target = join(folder, "local-model.json");
  await writeFile(
    target + ".new",
    JSON.stringify({ directory: fileURLToPath(root) }),
  );
  await rename(target + ".new", target);
  console.log("Modelo activado para kahoru.lol en este equipo.");
}
