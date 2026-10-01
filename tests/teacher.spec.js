import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";

// Fixtures exclusivos de pruebas. Todas las solicitudes a Supabase se interceptan.
const env = loadEnv("test", process.cwd());
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "docente@test.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const course = {
  id: 11, name: "Matemática", sectionId: 22, classroom: "Secundaria · Segundo A", year: "2026", yearState: "activo", weeklyHours: 5,
  students: [{ id: 31, studentId: "student-1", name: "Estudiante de prueba uno" }, { id: 32, studentId: "student-2", name: "Estudiante de prueba dos" }],
  schedule: [{ id: 41, day: 1, start: "08:00:00", end: "08:45:00", name: "Primera hora" }],
  evaluations: [{ id: 51, title: "Evaluación de unidad", period: "Primer periodo", state: "en_curso" }, { id: 52, title: "Evaluación cerrada", period: "Primer periodo", state: "cerrada" }],
  scale: { type: "numerica", min: 0, max: 20, decimals: 1, levels: [] },
};

async function setup(page, courses = [course]) {
  const state = { attendance: [], grades: [], attendanceSaves: [], gradeSaves: [], failSave: false, failLoad: false, unexpected: [] };
  await page.route("https://*.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return json({});
    if (path.endsWith("/perfiles")) return json({ id: user.id, nombre_completo: "Docente de prueba", rol: "docente", activo: true });
    if (path.endsWith("/auth/v1/user")) return json(user);
    if (path.endsWith("/obtener_marca_institucional") || path.endsWith("/obtener_parametros_generales")) return json({});
    if (path.endsWith("/cargar_panel_docente")) return state.failLoad ? json({ message: "Consulta temporalmente no disponible" }, 503) : json(courses);
    if (path.endsWith("/listar_comunicados")) return json({ inbox: [], sent: [] });
    if (path.endsWith("/asistencias_estudiantes")) return json(state.attendance);
    if (path.endsWith("/calificaciones_evaluaciones")) return json(state.grades);
    if (path.endsWith("/guardar_asistencia_docente")) {
      const payload = route.request().postDataJSON(); state.attendanceSaves.push(payload);
      if (state.failSave) return json({ message: "No se pudo guardar la asistencia" }, 500);
      state.attendance = payload.registros_solicitados.map((row) => ({ matricula_id: row.enrollmentId, estado: row.status, minutos_tardanza: row.lateMinutes, observacion: row.note }));
      return json(state.attendance.length);
    }
    if (path.endsWith("/guardar_calificaciones_docente")) {
      const payload = route.request().postDataJSON(); state.gradeSaves.push(payload);
      state.grades = payload.registros_solicitados.map((row) => ({ matricula_id: row.enrollmentId, valor: row.value, observacion: row.note }));
      return json(state.grades.length);
    }
    state.unexpected.push(path);
    return json({ message: "Solicitud no prevista en la prueba" }, 500);
  });
  await page.addInitScript(({ storageKey, user }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ sub: user.id, role: "authenticated", exp })) + ".test-signature";
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: "test-only", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  }, { storageKey, user });
  return state;
}

test("panel vacío real, navegación institucional y comunicados sin ejemplos", async ({ page }) => {
  const state = await setup(page, []);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Panel docente", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Portal docente" })).toBeVisible();
  await expect(page.getByText("Aún no tienes cursos asignados")).toBeVisible();
  await expect(page.getByText("Clase de hoy")).toHaveCount(0);
  await page.getByRole("button", { name: "Comunicados", exact: true }).click();
  await expect(page.getByText("No hay comunicados publicados")).toBeVisible();
  await page.getByRole("button", { name: "Notificaciones", exact: true }).click();
  await expect(page.getByText("No hay comunicados recientes.")).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test("un montaje sin usuario no rompe React ni consulta el panel sin sesión", async ({ page }) => {
  const state = await setup(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hola, Docente", exact: true })).toBeVisible();
  let panelRequests = 0;
  page.on("request", (request) => { if (request.url().includes("/cargar_panel_docente")) panelRequests += 1; });
  await page.evaluate(async () => {
    const { default: React } = await import("/node_modules/.vite/deps/react.js");
    const { default: ReactDOM } = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { default: TeacherWorkspace } = await import("/src/features/teacher/TeacherWorkspace.jsx");
    const host = document.createElement("div"); host.id = "missing-user-test"; document.body.append(host);
    ReactDOM.createRoot(host).render(React.createElement(TeacherWorkspace, { section: "Inicio" }));
  });
  await expect(page.locator("#missing-user-test").getByRole("alert")).toContainText("No se pudo recuperar tu sesión");
  expect(errors).toEqual([]);
  expect(panelRequests).toBe(0);
  expect(state.unexpected).toEqual([]);
});

test("asistencia explícita, guardado, recarga y error sin falso éxito", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Registro de asistencia" }).click();
  const first = page.getByLabel("Asistencia de Estudiante de prueba uno", { exact: true });
  await expect(first.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar asistencia", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Marcar todos presentes" }).click();
  await first.getByRole("radio", { name: "Tardanza" }).click();
  await page.getByLabel("Minutos de tardanza de Estudiante de prueba uno").fill("8");
  await page.getByRole("button", { name: "Guardar asistencia", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Asistencia guardada");
  expect(state.attendanceSaves[0].seccion_id_solicitada).toBe(22);
  expect(state.attendanceSaves[0].registros_solicitados[0]).toMatchObject({ enrollmentId: 31, status: "tardanza", lateMinutes: "8" });
  await page.getByRole("button", { name: "Mis cursos y secciones" }).click();
  await page.getByRole("button", { name: "Registro de asistencia" }).click();
  await expect(first.getByRole("radio", { name: "Tardanza" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Minutos de tardanza de Estudiante de prueba uno")).toHaveValue("8");
  state.failSave = true;
  await first.getByRole("radio", { name: "Falta" }).click();
  await page.getByRole("button", { name: "Guardar asistencia", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar");
  await expect(page.getByText("Asistencia guardada en el registro institucional.")).toHaveCount(0);
});

test("calificaciones por evaluación, escala y bloqueo de evaluaciones cerradas", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button", { name: "Calificaciones", exact: true }).click();
  // Planilla del periodo: estudiantes en filas, evaluaciones en columnas.
  const grade = page.getByLabel("Calificación de Estudiante de prueba uno en Evaluación de unidad");
  await expect(grade).toBeEnabled();
  await grade.fill("25");
  await grade.press("Enter");
  await expect(page.getByLabel("Calificación de Estudiante de prueba dos en Evaluación de unidad")).toBeFocused();
  await page.getByRole("button", { name: "Guardar calificaciones (1)" }).click();
  await expect(page.getByRole("alert")).toContainText("entre 0 y 20");
  expect(state.gradeSaves).toHaveLength(0);
  await grade.fill("17.5");
  await page.getByLabel("Calificación de Estudiante de prueba dos en Evaluación de unidad").fill("14");
  await page.getByRole("button", { name: "Guardar calificaciones (2)" }).click();
  await expect(page.getByRole("status")).toContainText("Calificaciones guardadas: 2 notas");
  expect(state.gradeSaves[0]).toMatchObject({ evaluacion_id_solicitada: 51, registros_solicitados: [{ enrollmentId: 31, value: "17.5" }, { enrollmentId: 32, value: "14" }] });
  await expect(page.getByLabel("Calificación de Estudiante de prueba uno en Evaluación cerrada")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Guardar calificaciones", exact: true })).toBeDisabled();
});

test("un fallo de conexión permite reintentar y no se presenta como cero cursos", async ({ page }) => {
  const state = await setup(page); state.failLoad = true;
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Consulta temporalmente no disponible");
  await expect(page.getByText("Aún no tienes cursos asignados")).toHaveCount(0);
  state.failLoad = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "Matemática", exact: true })).toBeVisible();
});

test("diseño de escritorio y móvil sin desbordamientos", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Matemática", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("docente-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("docente-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Registro de asistencia" }).click();
  await expect(page.getByLabel("Asistencia de Estudiante de prueba uno", { exact: true })).toBeVisible();
  await expect(page.locator("aside")).not.toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("docente-asistencia-mobile.png"), fullPage: true });
});
