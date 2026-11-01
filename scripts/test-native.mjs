import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const port = 19223;
const executable = new URL(
  process.argv[2] === "--release"
    ? "../src-tauri/target/release/kahoru-lol.exe"
    : "../src-tauri/target/debug/kahoru-lol.exe",
  import.meta.url,
);
const { fileURLToPath } = await import("node:url");
const child = spawn(fileURLToPath(executable), [], {
  windowsHide: true,
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  },
  stdio: "ignore",
});
let launchError;
child.on("error", (error) => {
  launchError = error;
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* El proceso todavía está creando WebView2. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "WebView2 no inició el puerto de prueba");
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
  await page.getByRole("button", { name: "Acerca de", exact: true }).click();
  await page.getByRole("heading", { name: "made by frack.one" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Windows: diez picks, fases, desconexión, limpieza, ajustes y avisos verificados.",
  );
} finally {
  if (browser) await browser.close();
  child.kill();
}
