import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { chromium } from "playwright-core";

const port = 19223;
const userData = await mkdtemp(join(tmpdir(), "kahoru-test-"));
const executable = new URL(
  process.argv.includes("--release")
    ? "../src-tauri/target/release/kahoru-lol.exe"
    : "../src-tauri/target/debug/kahoru-lol.exe",
  import.meta.url,
);
const { fileURLToPath } = await import("node:url");
const child = spawn(fileURLToPath(executable), [], {
  windowsHide: true,
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --disable-gpu`,
    WEBVIEW2_USER_DATA_FOLDER: userData,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const exited = new Promise((done) => child.once("close", done));
let processOutput = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    processOutput = (processOutput + chunk.toString()).slice(-16_384);
  });
}
let launchError;
child.on("error", (error) => {
  launchError = error;
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (launchError) throw launchError;
    if (child.exitCode !== null)
      throw new Error(
        `La aplicación terminó con código ${child.exitCode}.\n${processOutput}`,
      );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* El proceso todavía está creando WebView2. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, `WebView2 no inició el puerto de prueba.\n${processOutput}`);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  let page;
  for (let attempt = 0; attempt < 50; attempt++) {
    page = context
      .pages()
      .find((candidate) => candidate.url().includes("localhost"));
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(page, "No se encontró la ventana principal");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (process.argv.includes("--live")) {
    const live = page.getByRole("region", {
      name: "Cliente de League of Legends",
    });
    await live.getByText("CONECTADO", { exact: true }).waitFor();
    await mkdir("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/live-client.png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Nuevo draft" }).click();
  const catalog = JSON.parse(
    await readFile(new URL("../data/champions.json", import.meta.url), "utf8"),
  );
  const banned = catalog.champions.at(-1);
  await page.getByRole("button", { name: "Agregar ban", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar campeón" }).fill(banned.name);
  await page.getByRole("button", { name: banned.name, exact: true }).click();
  assert.equal(await page.locator(".ban-list button").count(), 1);
  assert.equal(await page.locator(".champion-grid button").count(), 0);
  await page
    .getByRole("button", { name: `Quitar ban de ${banned.name}` })
    .click();
  await page
    .getByRole("button", { name: "Volver a picks", exact: true })
    .click();
  for (const role of ["TOP", "JUNGLE", "BOT", "SUPPORT", "MID"]) {
    await page.getByLabel("Tu posición", { exact: true }).selectOption(role);
  }
  for (let index = 0; index < 10; index++) {
    const slot = page
      .locator(".team-panel")
      .nth(index < 5 ? 0 : 1)
      .locator(".slot")
      .nth(index % 5);
    await slot.locator(".slot-main").click();
    await page
      .getByRole("textbox", { name: "Buscar campeón" })
      .fill(catalog.champions[index].name);
    await page
      .getByRole("button", { name: catalog.champions[index].name, exact: true })
      .click();
    await slot
      .getByRole("button", {
        name: `Confirmar ${catalog.champions[index].name}`,
        exact: true,
      })
      .click();
  }
  await page.getByRole("heading", { name: "Draft confirmado" }).waitFor();
  await page.getByRole("heading", { name: "Runas completas" }).waitFor();
  await page.getByRole("button", { name: /^Resistir ataques físicos/ }).click();
  await page
    .locator(".selected-plan")
    .getByRole("heading", { name: "Resistir ataques físicos", exact: true })
    .waitFor();
  assert.equal(await page.locator(".selected-plan .rune-row img").count(), 9);
  await page.getByLabel("Añadir al pool", { exact: true }).selectOption("99");
  await page.getByRole("checkbox", { name: /^Solo mi pool/ }).check();
  assert.equal(await page.locator(".rank-card").count(), 1);
  await page
    .getByRole("button", { name: "Datos del juego", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await page
    .getByRole("button", { name: "Quitar favorito Lux", exact: true })
    .waitFor();
  await page
    .locator(".selected-plan")
    .getByRole("heading", { name: "Resistir ataques físicos", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Quitar favorito Lux", exact: true })
    .click();
  const firstSlot = page.locator(".allies .slot").first();
  await firstSlot.locator(".slot-main").click();
  await page.getByRole("button", { name: "Intercambiar", exact: true }).click();
  await firstSlot
    .getByText(catalog.champions[1].name, { exact: true })
    .waitFor();
  assert.equal(
    await firstSlot.locator("strong").innerText(),
    catalog.champions[1].name,
  );
  await page.getByRole("button", { name: "Intercambiar", exact: true }).click();
  await firstSlot
    .getByText(catalog.champions[0].name, { exact: true })
    .waitFor();
  assert.equal(
    await firstSlot.locator("strong").innerText(),
    catalog.champions[0].name,
  );
  await page.getByRole("textbox", { name: "Buscar campeón" }).fill("");
  await mkdir("test-results", { recursive: true });
  await page.locator(".topbar").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/native-draft.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pasar a carga" }).click();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await page.getByRole("heading", { name: "Partida", exact: true }).waitFor();
  await page
    .locator(".selected-plan")
    .getByRole("heading", { name: "Resistir ataques físicos", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await page
    .getByText("Conexión simulada interrumpida.", { exact: false })
    .waitFor();
  assert.equal(await page.locator(".portrait.filled").count(), 10);
  await page.getByRole("button", { name: "Reconectar", exact: true }).click();
  await page.getByRole("button", { name: "Terminar partida" }).click();
  await page
    .getByRole("button", { name: "Volver a inicio", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Sin sesión", exact: true })
    .waitFor();
  assert.equal(await page.locator(".portrait.filled").count(), 0);
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.reload();
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  assert.equal(await page.getByRole("checkbox").isChecked(), true);
  await page.getByRole("checkbox").uncheck();
  await page
    .getByRole("button", { name: "Datos del juego", exact: true })
    .click();
  await page.locator(".library-grid img").first().waitFor();
  await page.locator(".library-grid img").evaluateAll(async (images) => {
    for (const img of images) img.loading = "eager";
    await Promise.all(images.map((img) => img.decode()));
  });
  await page.screenshot({ path: "test-results/native-items.png" });
  if (process.argv.includes("--update")) {
    await page
      .getByRole("button", { name: "Comprobar datos", exact: true })
      .click();
    await page.getByText(/Datos oficiales .* comprobados/).waitFor();
  }
  await page.getByRole("button", { name: "Runas", exact: true }).click();
  await page.locator(".library-grid img").evaluateAll(async (images) => {
    for (const img of images) img.loading = "eager";
    await Promise.all(images.map((img) => img.decode()));
  });
  await page.getByRole("button", { name: "Acerca de", exact: true }).click();
  await page.getByRole("heading", { name: "made by frack.one" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Windows: diez picks, runas, planes conservados, imágenes, fases, reconexión y preferencias verificados.",
  );
} finally {
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/native-process.log", processOutput);
  if (browser) await browser.close();
  child.kill();
  await exited;
  const temporary = resolve(userData);
  if (
    dirname(temporary) !== resolve(tmpdir()) ||
    !basename(temporary).startsWith("kahoru-test-")
  )
    throw new Error("La carpeta temporal no pertenece a esta prueba.");
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
