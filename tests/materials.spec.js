import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import path from "node:path";
import os from "node:os";

const env = loadEnv("test", process.cwd());
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "docente@test.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };

async function setup(page) {
  const state = { inserts: [], uploads: 0, failRead: false, failCreate: false, unexpected: [] };
  const rows = {
    anios_academicos: [{ id: 1, name: "Año lectivo 2026", active: true, starts_on: "2026-01-01" }],
    niveles_educativos: [{ id: 1, name: "Inicial", sort_order: 1, active: true, material_scope: "section" }],
    grados: [{ id: 1, level_id: 1, name: "Alegría", sort_order: 1 }],
    secciones: [{ id: 1, academic_year_id: 1, grade_id: 1, name: "A", active: true }],
    asignaturas: [{ id: 1, name: "Matemática", active: true }, { id: 2, name: "Comunicación", active: true }, { id: 3, name: "Curso ajeno", active: true }],
    cursos_seccion: [1, 2, 3].map((id) => ({ id, academic_year_id: 1, section_id: 1, subject_id: id, active: true })),
    asignaciones_docentes: [1, 2].map((id) => ({ id, course_offering_id: id, teacher_id: user.id, active: true })),
    matriculas_estudiantes: [], materiales_educativos: [], versiones_material: [], publicaciones_material: [], destinatarios_material: [], entregas_material_fisico: [],
    perfiles: [{ id: user.id, full_name: "Docente de prueba", role: "docente", active: true }],
  };
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(); const url = new URL(req.url()); const table = url.pathname.split("/").at(-1);
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return json({});
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (table === "perfiles" && url.searchParams.has("id")) return json({ id: user.id, nombre_completo: "Docente de prueba", rol: "docente", activo: true });
    if (["obtener_marca_institucional", "obtener_parametros_generales"].includes(table)) return json({});
    if (["cargar_panel_docente", "listar_comunicados"].includes(table)) return json([]);
    if (url.pathname.includes("/storage/v1/object/")) { state.uploads++; return json({ Key: url.pathname, Id: "file-1" }); }
    if (table === "publicar_material") { rows.publicaciones_material[0].status = "published"; return json(null); }
    if (Object.hasOwn(rows, table)) {
      if (req.method() === "POST") {
        const body = req.postDataJSON(); state.inserts.push({ table, body });
        if (table === "materiales_educativos") {
          if (state.failCreate) return json({ code: "42501", message: "permission denied" }, 403);
          const m = { id: 91, title: body.titulo, description: body.descripcion, material_kind: body.tipo_material, origin: body.origen, created_by: body.creado_por, subject_id: body.asignatura_id };
          rows[table].push(m); return json(m);
        }
        if (table === "versiones_material") {
          const v = { id: 92, material_id: body.material_id, version_number: 1, version_label: "1.0", storage_path: body.ruta_almacenamiento, original_filename: body.nombre_archivo_original, mime_type: body.tipo_mime, byte_size: body.tamano_bytes, created_by: user.id };
          rows[table].push(v); return json(v);
        }
        if (table === "publicaciones_material") {
          const r = { id: 93, material_id: body.material_id, version_id: body.version_id, status: body.estado };
          rows[table].push(r); return json(r);
        }
        if (table === "destinatarios_material") {
          rows[table].push({ id: 94, release_id: body.publicacion_id, section_id: body.seccion_id, course_offering_id: body.curso_seccion_id }); return json(null);
        }
      }
      if (state.failRead && table === "materiales_educativos") return json({ code: "42501", message: "permission denied" }, 403);
      if (url.searchParams.get("id")?.startsWith("gt.")) return json([]);
      if (table === "cursos_seccion" && url.searchParams.get("id")?.startsWith("eq.")) return json(rows[table].find((r) => String(r.id) === url.searchParams.get("id").slice(3)));
      if (table === "versiones_material" && url.searchParams.has("material_id")) return json([]);
      return json(rows[table]);
    }
    state.unexpected.push(url.pathname); return json({ message: "Unexpected request" }, 500);
  });
  await page.addInitScript(({ storageKey, user }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access_token = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ sub: user.id, role: "authenticated", exp })) + ".test";
    localStorage.setItem(storageKey, JSON.stringify({ access_token, refresh_token: "test", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  }, { storageKey, user });
  return state;
}

async function openMaterials(page) {
  await page.goto("/");
  if ((await page.viewportSize())?.width < 768) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Materiales de clase", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Materiales de clase" })).toBeVisible();
}

test("docente elige curso de Inicial, sube archivo y conserva el destino", async ({ page }) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const state = await setup(page); await openMaterials(page);
  const courses = page.getByRole("navigation", { name: "Mis cursos" }).getByRole("button");
  await expect(courses).toHaveCount(2);
  await expect(courses).toContainText(["Comunicación", "Matemática"]);
  await expect(page.getByText("Curso ajeno")).toHaveCount(0);
  await courses.filter({ hasText: "Comunicación" }).click();
  await page.getByRole("button", { name: "Subir material", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del material").fill("Lectura de prueba");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByLabel("Curso o espacio de materiales")).toHaveValue("2");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await dialog.locator('input[type="file"]').setInputFiles({ name: "lectura.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nPrueba\n%%EOF") });
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog).toContainText("Comunicación");
  // Llegar a Confirmar no debe guardar: se requiere un clic explícito en "Crear material".
  await expect(dialog.getByRole("heading", { name: "Revisar y confirmar" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(state.inserts).toHaveLength(0); expect(state.uploads).toBe(0);
  await dialog.getByRole("button", { name: "Crear material", exact: true }).click({ force: true });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Material creado correctamente.")).toBeVisible();
  expect(state.inserts.find((r) => r.table === "materiales_educativos").body).toMatchObject({ curso_seccion_id: 2, seccion_id: null, origen: "teacher_extra" });
  expect(state.inserts.find((r) => r.table === "destinatarios_material").body).toMatchObject({ curso_seccion_id: 2, seccion_id: "1" });
  expect(state.uploads).toBe(1);
  await expect(page.getByRole("heading", { name: "Lectura de prueba" })).toBeVisible();
  await expect(courses.filter({ hasText: "Comunicación" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: path.join(os.tmpdir(), "colegio-materiales-desktop.png") });
  await courses.filter({ hasText: "Matemática" }).click();
  await expect(page.getByText("Lectura de prueba", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("error de consulta no muestra una lista vacía ni permite crear; permite reintentar", async ({ page }) => {
  const state = await setup(page); state.failRead = true; await openMaterials(page);
  await expect(page.getByRole("alert")).toContainText("Tu perfil no tiene permiso");
  await expect(page.getByText("Aún no hay materiales", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Subir material", exact: true })).toHaveCount(0);
  state.failRead = false;
  await page.getByRole("button", { name: "Volver a cargar materiales" }).click();
  await expect(page.getByRole("button", { name: /Matemática/ })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("selector docente usable en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page); await openMaterials(page);
  await page.getByRole("navigation", { name: "Mis cursos" }).getByRole("button", { name: /Matemática/ }).click();
  await page.getByRole("button", { name: "Subir material", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Nombre del material")).toBeVisible();
  await page.screenshot({ path: path.join(os.tmpdir(), "colegio-materiales-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
