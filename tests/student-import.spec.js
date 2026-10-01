import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import path from "node:path";
import os from "node:os";
const env = loadEnv("test", process.cwd());
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000011", email: "coordinacion@test.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const headers = "dni;nombres;apellidos;correo;clave;nivel;grado;seccion\n";
async function setup(page, role = "coordinador_academico") {
  const state = { requests: [], errors: [], fail: false, enrolled: new Set(), students: [
    { id: "00000000-0000-4000-8000-000000000101", name: "Lucía Prueba", dni: "99001001", email: "99001001@estudiantes.maxplanck.edu.pe", active: true, lastSignInAt: null, sectionId: 2, level: "Primaria", grade: "Primero", section: "A" },
    { id: "00000000-0000-4000-8000-000000000102", name: "Mateo Prueba", dni: "99001002", email: "99001002@estudiantes.maxplanck.edu.pe", active: true, lastSignInAt: "2026-09-20T15:00:00Z", sectionId: 2, level: "Primaria", grade: "Primero", section: "A" },
  ] };
  page.on("pageerror", (error) => state.errors.push(error.message));
  await page.route(`${env.VITE_SUPABASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return json({});
    if (url.pathname.endsWith("/perfiles")) return json({ id: user.id, nombre_completo: "Coordinación Prueba", rol: role, activo: true });
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/importaciones_estudiantes")) return json([{ id: 7, archivo: "alumnos.csv", total: 3, cuentas_nuevas: 2, cuentas_existentes: 0, errores: 1, creado_en: "2026-09-24T15:00:00Z", anio: { nombre: "2026" }, autor: { nombre_completo: "Coordinación Prueba" } }]);
    if (url.pathname.endsWith("/importaciones_estudiantes_filas")) return json([{ fila: 2, dni: "99001001", nombre: "Lucía Prueba", correo: "99001001@estudiantes.maxplanck.edu.pe", salon: "Primaria · Primero A", estado: "error", cuenta_nueva: false, mensaje: "La sección no tiene vacantes.", procesado_en: "2026-09-24T15:00:00Z" }]);
    if (url.pathname.endsWith("/catalogo_importacion_estudiantes")) return json({ years: [{ id: 1, name: "2026" }], sections: [{ id: 2, yearId: 1, level: "Primaria", grade: "Primero", section: "A", capacity: 200 }] });
    if (url.pathname.endsWith("/importar-estudiantes")) {
      const body = route.request().postDataJSON(); state.requests.push(body);
      if (state.fail) { state.fail = false; return json({ error: "Conexión interrumpida" }, 503); }
      if (body.action === "iniciar") return json({ batchId: 7 });
      if (body.action === "accesos") return json({ students: state.students });
      if (body.action === "regenerar") return json({ credentials: body.userIds.map((id) => ({ id, email: state.students.find((s) => s.id === id).email, password: "99001001" })) });
      return json({ results: body.rows.map((row) => {
        if (body.action === "validar") return { row: row.row, status: "ready", existing: row.email === "existente@test.invalid", sectionId: 2 };
        const existing = state.enrolled.has(row.dni) || row.email === "existente@test.invalid";
        state.enrolled.add(row.dni);
        return { row: row.row, status: "done", accountCreated: !existing, message: existing ? "Conserva su contraseña actual." : "Cuenta y matrícula creadas." };
      }) });
    }
    return json({});
  });
  await page.addInitScript(({ storageKey, user }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ sub: user.id, role: "authenticated", exp })) + ".test-signature";
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: "test-only", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  }, { storageKey, user });
  await page.goto("/");
  // Dirección tiene Sistema; Coordinación tiene Matrícula.
  await page.getByRole("button", { name: role === "direccion" ? "Sistema" : "Matrícula", exact: true }).click();
  await page.getByRole("button", { name: "Importar estudiantes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Importar estudiantes" })).toBeVisible();
  await expect(page.getByLabel("Archivo de estudiantes")).toBeDisabled();
  await page.getByRole("combobox", { name: "Nivel educativo", exact: true }).selectOption("Primaria");
  await page.getByRole("combobox", { name: "Grado", exact: true }).selectOption("Primero");
  await page.getByRole("combobox", { name: "Sección", exact: true }).selectOption("2");
  await expect(page.getByLabel("Archivo de estudiantes")).toBeEnabled();
  return state;
}
async function upload(page, content) { await page.getByLabel("Archivo de estudiantes").setInputFiles({ name: "alumnos.csv", mimeType: "text/csv", buffer: Buffer.from(headers + content) }); }
test("salón primero, plantilla simple y destino enviado al servidor", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("combobox", { name: "Nivel educativo", exact: true }).selectOption("");
  await expect(page.getByRole("combobox", { name: "Grado", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Sección", exact: true })).toHaveValue("");
  await expect(page.getByLabel("Archivo de estudiantes")).toBeDisabled();
  await page.getByRole("combobox", { name: "Nivel educativo", exact: true }).selectOption("Primaria");
  await page.getByRole("combobox", { name: "Grado", exact: true }).selectOption("Primero");
  await page.getByRole("combobox", { name: "Sección", exact: true }).selectOption("2");
  await page.getByLabel("Archivo de estudiantes").setInputFiles({ name: "simple.csv", mimeType: "text/csv", buffer: Buffer.from("dni;nombres;apellidos;correo;clave\n99001001;Ana;Prueba;;") });
  await expect(page.getByRole("combobox", { name: "Sección", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Revisar datos y duplicados" }).click();
  await expect(page.getByRole("button", { name: "Importar 1 estudiantes" }).first()).toBeEnabled();
  expect(state.requests[0].rows[0]).toMatchObject({ level: "Primaria", grade: "Primero", section: "A" });
  await page.screenshot({ path: path.join(os.tmpdir(), "import-destination-desktop.png") });
  await page.getByRole("button", { name: "Cargar otro archivo" }).click();
  await page.getByRole("combobox", { name: "Destino de la carga" }).selectOption("multiple");
  await upload(page, "99001002;Luis;Prueba;;;Primaria;Primero;A");
  await page.getByRole("button", { name: "Revisar datos y duplicados" }).click();
  await expect(page.getByRole("button", { name: "Importar 1 estudiantes" }).first()).toBeEnabled();
  expect(state.requests[1].rows[0]).toMatchObject({ level: "Primaria", grade: "Primero", section: "A" });
  expect(state.errors).toEqual([]);
});
test("revisa e importa por lotes, conserva cuentas existentes y descarga credenciales", async ({ page }) => {
  const state = await setup(page);
  await upload(page, Array.from({ length: 23 }, (_, i) => `${10000000 + i};Ana ${i};Pérez;${i === 0 ? "existente@test.invalid" : ""};;Primaria;Primero;A`).join("\n"));
  await expect(page.getByRole("button", { name: "Importar 0 estudiantes" }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Revisar datos y duplicados" }).click();
  await expect(page.getByRole("button", { name: "Importar 23 estudiantes" }).first()).toBeEnabled();
  await page.screenshot({ path: path.join(os.tmpdir(), "import-students-desktop.png") });
  const autoDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Importar 23 estudiantes" }).first().click();
  expect((await autoDownload).suggestedFilename()).toBe("credenciales-estudiantes.csv");
  await expect(page.getByText("23 completados", { exact: true })).toBeVisible();
  expect(state.requests.filter((r) => r.action === "importar").map((r) => r.rows.length)).toEqual([10, 10, 3]);
  expect(state.requests.filter((r) => r.action === "iniciar")).toHaveLength(1);
  expect(state.requests.filter((r) => r.action === "importar").every((r) => r.batchId === 7)).toBe(true);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar credenciales nuevas" }).click();
  const stream = await (await downloaded).createReadStream(); const parts = []; for await (const part of stream) parts.push(part);
  const csv = Buffer.concat(parts).toString("utf8");
  expect(csv).toContain("10000001@estudiantes.maxplanck.edu.pe"); expect(csv).not.toContain("existente@test.invalid");
  expect(state.errors).toEqual([]);
});
test("duplicados no se envían al servidor; fallos permiten continuar y vista móvil", async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page, "00123456;Ana;Pérez;;;Primaria;Primero;A\n00123456;Luis;Pérez;;;Primaria;Primero;A");
  await expect(page.getByText("2 por corregir en el archivo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Revisar datos y duplicados" })).toBeDisabled();
  expect(state.requests).toHaveLength(0);
  await page.getByRole("button", { name: "Cargar otro archivo" }).click();
  await upload(page, "00123456;Ana;Pérez;;;Primaria;Primero;A");
  state.fail = true;
  await page.getByRole("button", { name: "Revisar datos y duplicados" }).click();
  await expect(page.getByRole("alert")).toContainText("Conexión interrumpida");
  await page.getByRole("button", { name: "Revisar datos y duplicados" }).click();
  await expect(page.getByRole("button", { name: "Importar 1 estudiantes" }).first()).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(os.tmpdir(), "import-students-mobile.png") });
  expect(state.errors).toEqual([]);
});

test("accesos de estudiantes: filtra, genera nuevas claves y muestra el historial", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Accesos de estudiantes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Accesos de estudiantes" })).toBeVisible();
  await expect(page.getByText("Lucía Prueba")).toBeVisible();
  await page.getByRole("combobox", { name: "Filtrar por ingreso" }).selectOption("never");
  await expect(page.getByText("Mateo Prueba")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Seleccionar todos" }).check();
  page.once("dialog", (dialog) => dialog.accept());
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Restablecer clave al DNI (1)" }).click();
  const stream = await (await downloaded).createReadStream(); const parts = []; for await (const part of stream) parts.push(part);
  const csv = Buffer.concat(parts).toString("utf8");
  expect(csv).toContain("99001001@estudiantes.maxplanck.edu.pe"); expect(csv).toContain('"99001001@estudiantes.maxplanck.edu.pe";"99001001"'); expect(csv).not.toContain("99001002");
  expect(state.requests.find((r) => r.action === "regenerar").userIds).toEqual([state.students[0].id]);
  await page.getByRole("tab", { name: "Historial de cargas" }).click();
  await expect(page.getByText("alumnos.csv")).toBeVisible();
  await page.getByRole("button", { name: "Ver detalle" }).click();
  await expect(page.getByText("La sección no tiene vacantes.")).toBeVisible();
  expect(state.errors).toEqual([]);
});
