import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import os from "node:os";
import path from "node:path";

const env = loadEnv("test", process.cwd());
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const featured = { id: 7, title: "No habrá clases el lunes", body: "Por feriado regional. Las clases se reanudan el martes.", signature: "Dirección", publishedAt: "2026-09-24T12:00:00Z", audience: ["estudiante", "familia"], featured: true, seen: false };
const regular = { id: 8, title: "Salida pedagógica", body: "Traer autorización firmada.", signature: "Jelibeth Ramirez · Primaria · 1er y 2do A", section: "Primaria · 1er y 2do A", publishedAt: "2026-09-23T12:00:00Z", audience: ["estudiante"], featured: false, seen: false };

async function setup(page, role, name, extra = {}) {
  const user = { id: `00000000-0000-4000-8000-00000000009${role.length}`, email: `${role}@test.invalid`, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
  const state = { saves: [], seen: [], errors: [], inbox: extra.inbox || [], sent: extra.sent || [] };
  page.on("pageerror", (error) => state.errors.push(error.message));
  await page.route(`${env.VITE_SUPABASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return json({});
    if (url.pathname.endsWith("/perfiles")) return json({ id: user.id, nombre_completo: name, rol: role, activo: true });
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/listar_comunicados")) return json({ inbox: state.inbox, sent: state.sent });
    if (url.pathname.endsWith("/marcar_comunicado_visto")) { const id = route.request().postDataJSON().comunicado; state.seen.push(id); state.inbox = state.inbox.map((item) => item.id === id ? { ...item, seen: true } : item); return json(null); }
    if (url.pathname.endsWith("/guardar_comunicado")) { const body = route.request().postDataJSON(); state.saves.push(body); state.sent = [{ id: 20, title: body.titulo, body: body.contenido, signature: "Dirección", audience: body.destinos, sectionId: body.seccion, published: body.publicar, featured: body.destacado, featuredFrom: body.desde, featuredTo: body.hasta, seenCount: 0, mine: true, publishedAt: new Date().toISOString() }]; return json(20); }
    if (url.pathname.endsWith("/catalogo_importacion_estudiantes")) return json({ years: [{ id: 1, name: "2026" }], sections: [{ id: 3, yearId: 1, level: "Primaria", grade: "1er y 2do", section: "A" }] });
    if (url.pathname.endsWith("/cargar_panel_estudiante")) return json([]);
    return json([]);
  });
  await page.addInitScript(({ storageKey, user }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ sub: user.id, role: "authenticated", exp })) + ".test-signature";
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: "test-only", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  }, { storageKey, user });
  return state;
}

test("el estudiante ve el aviso importante al ingresar y luego su bandeja", async ({ page }) => {
  const state = await setup(page, "estudiante", "Lucía Prueba", { inbox: [featured, regular] });
  await page.goto("/");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("No habrá clases el lunes");
  await page.screenshot({ path: path.join(os.tmpdir(), "announcement-popup.png") });
  await dialog.getByRole("button", { name: "Entendido" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.seen).toEqual([7]);
  await page.getByRole("button", { name: "Comunicados", exact: true }).first().click();
  await expect(page.getByText("Salida pedagógica")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo comunicado" })).toHaveCount(0);
  await page.getByRole("button", { name: /Salida pedagógica/ }).click();
  expect(state.seen).toEqual([7, 8]);
  await page.reload();
  await expect(page.getByText("Aún no tienes una matrícula disponible")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("Dirección publica un aviso al ingresar para estudiantes y familias", async ({ page }) => {
  const state = await setup(page, "direccion", "Dirección General");
  await page.goto("/");
  await page.getByRole("button", { name: "Comunicados", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo comunicado" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo comunicado" });
  await dialog.getByLabel("Título").fill("No habrá clases el lunes");
  await dialog.getByLabel("Mensaje").fill("Por feriado regional.");
  await expect(dialog.getByRole("button", { name: "Estudiantes" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Docentes" }).click();
  await dialog.getByLabel(/Mostrar como aviso al ingresar/).check();
  await expect(dialog.getByLabel("Vista previa del aviso")).toContainText("No habrá clases el lunes");
  await page.screenshot({ path: path.join(os.tmpdir(), "announcement-editor.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Publicar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.saves[0]).toMatchObject({ titulo: "No habrá clases el lunes", destinos: ["estudiante", "familia", "docente"], seccion: null, destacado: true, publicar: true });
  await expect(page.getByText(/Aviso al ingresar/)).toBeVisible();
  expect(state.errors).toEqual([]);
});
