import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import os from "node:os";
import path from "node:path";

const env = loadEnv("test", process.cwd());
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000003", email: "87654321@familias.maxplanck.edu.pe", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const course = (id, name, grade) => ({ id, name, teachers: "Docente de prueba", weeklyHours: 4, schedule: [{ id: id * 10, day: 1, start: "08:00:00", end: "09:30:00" }], evaluations: [{ id: id * 100, title: "Examen semanal 1", date: "2026-09-04", period: "Tercer bimestre", state: "programada", grade, note: "Muy bien" }, { id: id * 100 + 1, title: "Examen semanal 9", date: "2026-12-30", period: "Tercer bimestre", state: "programada", grade: null }] });
const children = [
  { id: "child-1", name: "Lucía Prueba Rojas", relation: "madre", enrollments: [{ id: 1, year: "Año lectivo 2026", classroom: "Primaria · 1er y 2do A", courses: [course(1, "Matemática", "18"), course(2, "Comunicación", "12")], attendance: [{ id: 1, date: "2026-09-22", status: "tardanza", lateMinutes: 5 }] }] },
  { id: "child-2", name: "Mateo Prueba Flores", relation: "madre", enrollments: [{ id: 2, year: "Año lectivo 2026", classroom: "Inicial · Alegría A", courses: [course(3, "Personal Social", "9")], attendance: [] }] },
];
async function setup(page, records = children) {
  const state = { unexpected: [], errors: [], fail: false };
  page.on("pageerror", (error) => state.errors.push(error.message));
  await page.route(`${env.VITE_SUPABASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return json({});
    if (url.pathname.endsWith("/perfiles")) return json({ id: user.id, nombre_completo: "Rosa Pérez Rojas", rol: "familia", activo: true });
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/obtener_marca_institucional") || url.pathname.endsWith("/obtener_parametros_generales")) return json({});
    if (url.pathname.endsWith("/cargar_panel_familia")) return state.fail ? json({ message: "Sin conexión" }, 503) : json(records);
    if (url.pathname.endsWith("/listar_comunicados")) return json({ inbox: [{ id: 1, title: "Reunión de padres", body: "Viernes 7 p. m.", signature: "Dirección", publishedAt: "2026-09-20T12:00:00Z", audience: ["familia"], featured: false, seen: true }], sent: [] });
    if (url.pathname.includes("actividades_calendario") || url.pathname.includes("destinatarios_actividad")) return json([]);
    state.unexpected.push(url.pathname); return json([]);
  });
  await page.addInitScript(({ storageKey, user }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ sub: user.id, role: "authenticated", exp })) + ".test-signature";
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: "test-only", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  }, { storageKey, user });
  return state;
}

test("familia cambia de hijo y consulta notas, asistencia, horario y comunicados", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hola, Rosa" })).toBeVisible();
  await expect(page.getByText(/Así va el día de Lucía|Lucía no tiene clases/)).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "family-home.png"), fullPage: true });
  await page.getByRole("button", { name: "Calificaciones", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Calificaciones de Lucía" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Matemática, Examen semanal 1: 18" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mis hijos" }).getByRole("button", { name: /Mateo/ }).click();
  await expect(page.getByRole("heading", { name: "Calificaciones de Mateo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Personal Social, Examen semanal 1: 9" })).toBeVisible();
  await expect(page.getByText("Matemática")).toHaveCount(0);
  await page.getByRole("button", { name: "Asistencia", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Asistencia de Mateo" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mis hijos" }).getByRole("button", { name: /Lucía/ }).click();
  await expect(page.getByText("Tardanza · 5 min")).toBeVisible();
  await page.getByRole("button", { name: "Horario", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Horario de Lucía" })).toBeVisible();
  await page.getByRole("button", { name: "Comunicados", exact: true }).first().click();
  await expect(page.getByText("Reunión de padres")).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar|Editar|Pagos/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("un solo hijo, sin hijos vinculados y reintento de error", async ({ page }) => {
  const state = await setup(page, [children[1]]);
  state.fail = true;
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("No se pudo cargar");
  state.fail = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText(/de Mateo Prueba Flores/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mis hijos" })).toHaveCount(0);
});

test("sin estudiantes vinculados y vista móvil", async ({ page }) => {
  await setup(page, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Aún no hay estudiantes vinculados")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
