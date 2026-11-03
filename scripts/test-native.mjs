import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { chromium } from "playwright-core";

const { version: appVersion } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const port = 19223;
const userData = await mkdtemp(join(tmpdir(), "kahoru-test-"));
const temporary = resolve(userData);
if (
  dirname(temporary) !== resolve(tmpdir()) ||
  !basename(temporary).startsWith("kahoru-test-")
)
  throw new Error("La carpeta temporal no pertenece a esta prueba.");
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
      .find((candidate) => /localhost|127\.0\.0\.1/.test(candidate.url()));
    if (page) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(page, "No se encontró la ventana principal");
  await page
    .getByText(`DESARROLLO · v${appVersion}`, { exact: true })
    .waitFor();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    globalThis.localStorage.setItem("kahoru.configuration-auto.v1", "false"),
  );
  if (process.argv.includes("--sources")) {
    const coverage = [];
    for (const [championId, role] of [
      [54, "TOP"],
      [60, "JUNGLE"],
      [103, "MID"],
      [222, "BOT"],
      [89, "SUPPORT"],
    ]) {
      const value = await page.evaluate(
        ({ championId, role }) =>
          globalThis.__TAURI_INTERNALS__.invoke("get_champion_analysis", {
            championId,
            role,
            refresh: false,
          }),
        { championId, role },
      );
      assert.equal(value.schemaVersion, 3);
      const data = value.analysis.data;
      assert.ok(Array.isArray(data.skills.order));
      assert.ok(data.skills.play >= 100);
      coverage.push({
        championId,
        role,
        skillLevels: data.skills.order.length,
        skillSamples: data.skills.play,
        matchupRows:
          (data.weak_counters?.length ?? 0) +
          (data.strong_counters?.length ?? 0),
        patch: data.trends.win.version,
      });
    }
    await mkdir("test-results", { recursive: true });
    await writeFile(
      "test-results/source-coverage.json",
      JSON.stringify(coverage, null, 2),
    );
    console.log(
      "Proveedor: habilidades y matchups recibidos en los cinco roles.",
    );
  }
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
  await page.locator(".ban-list button").first().waitFor();
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
  const withProvider = process.argv.includes("--provider");
  const picks = withProvider
    ? (process.argv.includes("--past-draft")
        ? [133, 234, 30, 21, 161, 54, 31, 202, 115, 497]
        : [82, 234, 80, 222, 432, 113, 141, 134, 21, 50]
      ).map((id) => catalog.champions.find((c) => c.id === id))
    : catalog.champions.slice(0, 10);
  if (withProvider)
    await page
      .getByLabel("Tu posición", { exact: true })
      .selectOption("JUNGLE");
  for (let index = 0; index < 10; index++) {
    const slot = page
      .locator(".team-panel")
      .nth(index < 5 ? 0 : 1)
      .locator(".slot")
      .nth(index % 5);
    await slot.locator(".slot-main").click();
    await page
      .getByRole("textbox", { name: "Buscar campeón" })
      .fill(picks[index].name);
    await page
      .getByRole("button", { name: picks[index].name, exact: true })
      .click();
    await slot
      .getByRole("button", {
        name: `Confirmar ${picks[index].name}`,
        exact: true,
      })
      .click();
  }
  await page.getByRole("heading", { name: "Draft confirmado" }).waitFor();
  await page.locator(".client-pages > summary").click();
  const official = page.locator(".client-pages .panel").first();
  assert.equal(await official.locator("img").count(), 11);
  await official.locator("img").evaluateAll(async (images) => {
    for (const img of images) img.loading = "eager";
    await Promise.all(images.map((img) => img.decode()));
  });
  let chosenHeading;
  let chosenAssets;
  let preparedSkills;
  if (
    process.argv.includes("--roles-model") ||
    process.argv.includes("--roles-configuration-model")
  ) {
    for (const role of ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"]) {
      await page.getByLabel("Tu posición", { exact: true }).selectOption(role);
      await page.waitForTimeout(500);
      await page
        .getByText("Consultando análisis por campeón y posición…", {
          exact: true,
        })
        .waitFor({ state: "hidden", timeout: 30000 });
      if (process.argv.includes("--roles-configuration-model")) {
        await page
          .getByRole("button", {
            name: "Analizar configuración con IA",
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () =>
            !globalThis.document
              .querySelector(".configuration-analysis button")
              ?.textContent?.includes("Comparando"),
          null,
          { timeout: 120000 },
        );
        assert.match(
          await page.locator(".configuration-analysis").innerText(),
          /Configuración elegida con el análisis local/,
        );
        await mkdir("test-results", { recursive: true });
        await writeFile(
          "test-results/configuration-" + role + ".txt",
          await page.locator(".configuration-analysis").innerText(),
        );
        await writeFile(
          "test-results/configuration-" + role + "-plan.txt",
          await page.locator(".selected-plan").innerText(),
        );
        console.log("Configuración local por rol:", role);
        continue;
      }
      await page
        .getByRole("button", { name: "Preparar con IA local", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          !globalThis.document
            .querySelector(".strategy button")
            ?.textContent?.includes("Preparando"),
        null,
        { timeout: 120000 },
      );
      assert.match(
        await page.locator(".strategy").innerText(),
        /Prioridades elegidas entre hechos del motor/,
      );
      await mkdir("test-results", { recursive: true });
      await writeFile(
        `test-results/strategy-${role}.txt`,
        await page.locator(".strategy").innerText(),
      );
      console.log("Modelo local por rol:", role);
    }
    await page
      .getByLabel("Tu posición", { exact: true })
      .selectOption("JUNGLE");
  }
  if (withProvider) {
    await page.locator(".selected-plan").waitFor({ timeout: 30000 });
    const alternatives = page.locator(".preparation > .plan-tabs button");
    await alternatives.last().click();
    chosenHeading = await page.locator(".selected-plan h2").innerText();
    assert.equal(await page.locator(".selected-plan .shards img").count(), 3);
    preparedSkills = await page.locator(".skill-order table").innerText();
    assert.equal(await page.locator(".skill-point").count(), 18);
    assert.equal(await page.locator(".skill-order thead th").count(), 19);
    await page
      .locator('.selected-plan select[aria-label="Orden de hechizos"]')
      .selectOption("flashF");
    assert.equal(
      await page.evaluate(() =>
        globalThis.localStorage.getItem("kahoru.spell-order.v1"),
      ),
      "flashF",
    );
    chosenAssets = await page
      .locator(".selected-plan img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
  }
  if (
    process.argv.includes("--configuration-model") ||
    process.argv.includes("--configuration-auto")
  ) {
    if (process.argv.includes("--configuration-auto")) {
      await page
        .getByRole("checkbox", {
          name: "Analizar con IA al completar el draft",
          exact: true,
        })
        .check();
      await page
        .getByRole("button", {
          name: "Comparando configuraciones…",
          exact: true,
        })
        .waitFor({ timeout: 10000 });
    } else {
      await page
        .getByRole("button", {
          name: "Analizar configuración con IA",
          exact: true,
        })
        .click();
    }
    await page.waitForFunction(
      () =>
        !globalThis.document
          .querySelector(".configuration-analysis button")
          ?.textContent?.includes("Comparando"),
      null,
      { timeout: 120000 },
    );
    assert.match(
      await page.locator(".configuration-analysis").innerText(),
      /Configuración elegida con el análisis local/,
    );
    chosenHeading = await page.locator(".selected-plan h2").innerText();
    chosenAssets = await page
      .locator(".selected-plan img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
    await mkdir("test-results", { recursive: true });
    await writeFile(
      "test-results/configuration-model.txt",
      await page.locator(".configuration-analysis").innerText(),
    );
    await page
      .locator(".configuration-analysis")
      .screenshot({ path: "test-results/configuration-model.png" });
    console.log("IA local: configuración completa elegida y validada.");
    if (process.argv.includes("--configuration-auto"))
      await page
        .getByRole("checkbox", {
          name: "Analizar con IA al completar el draft",
          exact: true,
        })
        .uncheck();
  }
  if (process.argv.includes("--model")) {
    const modelStarted = performance.now();
    await page
      .getByRole("button", { name: "Preparar con IA local", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !globalThis.document
          .querySelector(".strategy button")
          ?.textContent?.includes("Preparando"),
      null,
      { timeout: 120000 },
    );
    assert.match(
      await page.locator(".strategy").innerText(),
      /Prioridades elegidas entre hechos del motor/,
    );
    assert.equal(
      await page.locator(".strategy > p:not(.small-note)").count(),
      3,
    );
    console.log("Modelo local: tres fases preparadas desde hechos validados.");
    console.log(
      `Preparación local: ${Math.round(performance.now() - modelStarted)} ms, incluida la primera verificación de archivos.`,
    );
    await mkdir("test-results", { recursive: true });
    await writeFile(
      "test-results/strategy-model.txt",
      await page.locator(".strategy").innerText(),
    );
    await page
      .locator(".strategy")
      .screenshot({ path: "test-results/strategy-model.png" });
  }
  const favorite = withProvider
    ? catalog.champions.find((c) => c.id === 64)
    : catalog.champions.find((c) => c.id === 99);
  await page
    .getByLabel("Añadir al pool", { exact: true })
    .selectOption(String(favorite.id));
  await page.getByRole("checkbox", { name: /^Solo mi pool/ }).check();
  assert.equal(await page.locator(".rank-card").count(), 1);
  await page
    .getByRole("button", { name: "Datos del juego", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Quitar favorito " + favorite.name,
      exact: true,
    })
    .click();
  const swapIndex = withProvider ? 4 : 1;
  const firstSlot = page.locator(".allies .slot").first();
  await firstSlot.locator(".slot-main").click();
  if (withProvider)
    await page
      .getByLabel("Posición para intercambiar", { exact: true })
      .selectOption("4");
  await page.getByRole("button", { name: "Intercambiar", exact: true }).click();
  await firstSlot.getByText(picks[swapIndex].name, { exact: true }).waitFor();
  assert.equal(
    await firstSlot.locator("strong").innerText(),
    picks[swapIndex].name,
  );
  await page.getByRole("button", { name: "Intercambiar", exact: true }).click();
  await firstSlot.getByText(picks[0].name, { exact: true }).waitFor();
  assert.equal(await firstSlot.locator("strong").innerText(), picks[0].name);
  await page.getByRole("textbox", { name: "Buscar campeón" }).fill("");
  await mkdir("test-results", { recursive: true });
  await page.locator(".topbar").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/native-draft.png",
    fullPage: true,
  });
  if (process.argv.includes("--model"))
    await page
      .getByRole("button", { name: "Rehacer con IA local", exact: true })
      .click();
  await page.getByRole("button", { name: "Pasar a carga" }).click();
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await page.getByRole("heading", { name: "Partida", exact: true }).waitFor();
  if (process.argv.includes("--model"))
    await page
      .getByText(/Prioridades elegidas entre hechos del motor/)
      .waitFor();
  if (preparedSkills)
    assert.equal(
      await page.locator(".skill-order table").innerText(),
      preparedSkills,
    );
  if (chosenHeading) {
    if (
      process.argv.includes("--roles-model") &&
      !process.argv.includes("--model")
    ) {
      assert.doesNotMatch(
        await page.locator(".strategy").innerText(),
        /Línea: coordinar intercambios/,
      );
      assert.match(
        await page.locator(".strategy").innerText(),
        /Dominio del Soberano/,
      );
      assert.doesNotMatch(
        await page.locator(".strategy").innerText(),
        /Prioridades elegidas entre hechos del motor/,
      );
    }
    await page
      .locator(".selected-plan")
      .getByRole("heading", { name: chosenHeading, exact: true })
      .waitFor();
    assert.deepEqual(
      await page
        .locator(".selected-plan img")
        .evaluateAll((images) => images.map((img) => img.getAttribute("src"))),
      chosenAssets,
      "Runas, compras, orden y spells deben conservarse al cargar la partida",
    );
  }
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
    await page
      .getByText(/Datos oficiales comprobados:/)
      .waitFor({ timeout: 150000 });
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
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
