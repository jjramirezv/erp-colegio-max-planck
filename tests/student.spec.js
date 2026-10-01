import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import os from "node:os";
import path from "node:path";

const env = loadEnv("test", process.cwd());
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000002", email: "estudiante@test.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const enrollment = { id: 1, year: "2026", classroom: "Secundaria · Segundo A", attendance: [{ id: 4, date: "2026-09-22", status: "tardanza", lateMinutes: 8 }], courses: [{ id: 2, name: "Matemática", teachers: "Docente de prueba", weeklyHours: 5, schedule: [{ id: 3, day: 1, start: "08:00:00", end: "08:45:00" }], evaluations: [{ id: 5, title: "Evaluación de unidad", date: "2026-09-22", period: "Primer periodo", state: "cerrada", grade: "AD", note: "Buen trabajo" }, { id: 6, title: "Próxima práctica", date: "2026-10-01", period: "Segundo periodo", state: "programada", grade: null }] }] };
async function setup(page, records = [enrollment]) {
  const state = { fail: false, unexpected: [], errors: [] };
  page.on("pageerror", (error) => state.errors.push(error.message));
  await page.route(`${env.VITE_SUPABASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return json({});
    if (url.pathname.endsWith("/perfiles")) return json({ id: user.id, nombre_completo: "Mateo Prueba", rol: "estudiante", activo: true });
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/obtener_marca_institucional") || url.pathname.endsWith("/obtener_parametros_generales")) return json({});
    if (url.pathname.endsWith("/cargar_panel_estudiante")) return state.fail ? json({ message: "Sin conexión" }, 503) : json(records);
    if (url.pathname.endsWith("/listar_comunicados")) return json({ inbox: [], sent: [] });
    state.unexpected.push(url.pathname); return json({ message: "Unexpected request" }, 500);
  });
  await page.addInitScript(({ storageKey, user }) => {
    localStorage.setItem("mp-role-permissions-v1", JSON.stringify({ estudiante: ["Inicio", "Mis cursos", "Horario", "Calificaciones", "Calendario"] }));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ sub: user.id, role: "authenticated", exp })) + ".test-signature";
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: "test-only", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  }, { storageKey, user });
  return state;
}
test("estudiante consulta cursos, horario, notas por periodo y asistencia sin editar", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  await expect(page.getByText("Secundaria · Segundo A", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "student-desktop.png") });
  await page.getByRole("button", { name: "Mis cursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Matemática" })).toBeVisible();
  await page.getByRole("button", { name: "Horario", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mi horario" })).toBeVisible();
  await page.getByRole("button", { name: "Matemática, Lunes de 08:00 a 08:45" }).click();
  await expect(page.getByRole("dialog", { name: "Detalle de Matemática" })).toContainText("Lunes · 08:00 – 08:45");
  await page.screenshot({ path: path.join(os.tmpdir(), "student-schedule.png"), fullPage: true });
  await page.getByRole("button", { name: "Calificaciones", exact: true }).click();
  await expect(page.getByText("AD", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Segundo periodo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Matemática, Próxima práctica: próximamente" })).toBeVisible();
  await page.getByRole("button", { name: "Primer periodo", exact: true }).click();
  await page.getByRole("button", { name: "Matemática, Evaluación de unidad: AD" }).click();
  await expect(page.getByRole("dialog", { name: "Detalle de Evaluación de unidad" })).toContainText("Buen trabajo");
  await page.getByRole("button", { name: "Segundo periodo", exact: true }).click();
  await expect(page.getByText("AD", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Asistencia", exact: true }).click();
  await expect(page.getByText("Tardanza · 8 min")).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar|Editar/ })).toHaveCount(0);
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});
test("sin matrícula, avisos reales y reintento de error", async ({ page }) => {
  const state = await setup(page, []);
  state.fail = true;
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("No se pudo cargar");
  state.fail = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText(/Aún no tienes una matrícula disponible/)).toBeVisible();
  await page.getByRole("button", { name: "Notificaciones", exact: true }).click();
  await expect(page.getByText("No hay comunicados recientes.")).toBeVisible();
  await expect(page.getByText("Semana de aniversario", { exact: true })).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});
test("navegación móvil sin desbordamiento", async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hola, Mateo" })).toBeVisible();
  await expect(page.getByText("Secundaria · Segundo A", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "student-mobile.png") });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Asistencia", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mi asistencia", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Horario", exact: true }).click();
  await page.getByRole("button", { name: "Lun", exact: true }).click();
  await expect(page.getByText("Docente de prueba").last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(state.errors).toEqual([]);
});
