import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv("test", process.cwd());
const user = { id: "00000000-0000-4000-8000-000000000077", email: "docente@test.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: user.id, role: "authenticated", exp })).toString("base64url") + ".sig";

async function setup(page) {
  const state = { updates: [], recover: [], logout: 0 };
  await page.route(`${env.VITE_SUPABASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url()); const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    if (url.pathname.endsWith("/auth/v1/user") && method === "PUT") { state.updates.push(route.request().postDataJSON()); return json(user); }
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/auth/v1/recover")) { state.recover.push({ ...route.request().postDataJSON(), redirect: url.searchParams.get("redirect_to") }); return json({}); }
    if (url.pathname.endsWith("/auth/v1/logout")) { state.logout++; return route.fulfill({ status: 204, body: "" }); }
    if (url.pathname.endsWith("/perfiles")) return json({ id: user.id, nombre_completo: "Docente de prueba", rol: "docente", activo: true });
    return json([]);
  });
  return state;
}

test("el enlace de recuperación pide la nueva contraseña antes de entrar", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/#access_token=${token}&expires_at=${exp}&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery`);
  await expect(page.getByRole("heading", { name: "Crear nueva contraseña" })).toBeVisible();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Clave2026!");
  await page.getByLabel("Repite la contraseña").fill("Otra2026!");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("alert")).toContainText("no coinciden");
  await page.getByLabel("Repite la contraseña").fill("Clave2026!");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada. Ingresa con tu nueva contraseña.")).toBeVisible();
  expect(state.updates[0]).toMatchObject({ password: "Clave2026!" });
  expect(state.logout).toBe(1);
});

test("¿Olvidaste tu contraseña? envía el enlace a esta misma dirección", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  await page.getByLabel("Correo institucional").fill("docente@test.invalid");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText(/te enviamos un enlace/)).toBeVisible();
  expect(state.recover[0].email).toBe("docente@test.invalid");
  expect(state.recover[0].redirect).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/$/);
  await page.getByRole("button", { name: "← Volver a ingresar" }).click();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
});

test("un enlace vencido muestra un aviso claro", async ({ page }) => {
  await setup(page);
  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByText(/El enlace de recuperación venció/)).toBeVisible();
});
