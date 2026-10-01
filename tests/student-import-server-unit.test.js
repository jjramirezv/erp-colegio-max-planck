import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("../supabase/functions/importar-estudiantes/index.ts", import.meta.url), "utf8").replace(/^import .*\n/, ""));
const row = { row: 2, importId: "00000000-0000-4000-8000-000000000123", dni: "12345678", name: "Ana Pérez", email: "ana@test.invalid", password: "ClavePrueba!2026", level: "Primaria", grade: "Primero", section: "A" };
function harness() {
  const state = { role: "direccion", authenticated: true, created: 0, saved: 0, account: null, failSave: false, planError: null, passwords: {}, events: [], guardians: {}, links: [], parentAccounts: 0 };
  const admin = {
    from: (table) => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { rol: state.role, activo: true } }) }), in: async (_column, ids) => ({ data: ids.map((id) => ({ id, rol: id.endsWith("999") ? "docente" : "estudiante", dni: "99001001" })) }) }),
      insert: async (record) => { state.events.push({ table, record }); return {}; },
    }),
    rpc: async function (name) {
      if (name === "preparar_apoderado") return { data: { userId: state.guardians[arguments[1].correo] || null } };
      if (name === "vincular_apoderado") { state.links.push(arguments[1]); return { data: null }; }
      if (name === "preparar_fila_estudiante") return state.planError ? { error: { message: state.planError } } : { data: { userId: state.account?.id, sectionId: 1, enrolled: state.saved > 0 } };
      if (state.failSave) return { error: { message: "Sin vacantes" } };
      state.saved++; return { data: {} };
    },
    auth: { admin: {
      createUser: async (values) => { if (values.email.endsWith("@familias.maxplanck.edu.pe")) { state.parentAccounts++; const id = `parent-${state.parentAccounts}`; state.guardians[values.email] = id; state.parentPasswords = values.password; return { data: { user: { id } } }; } state.created++; state.account = { id: "new-user", app_metadata: values.app_metadata }; return { data: { user: state.account } }; },
      getUserById: async () => ({ data: { user: state.account } }),
      updateUserById: async (id, values) => { state.passwords[id] = values.password; return { data: { user: { id, email: `${id.slice(-3)}@test.invalid` } } }; },
    } },
  };
  const caller = { auth: { getUser: async () => state.authenticated ? { data: { user: { id: "actor" } } } : { data: {}, error: {} } } };
  let handler;
  vm.runInNewContext(source, { createClient: (_url, key) => key === "secret" ? admin : caller, Deno: { env: { get: (key) => key === "SUPABASE_URL" ? "https://test.invalid" : key === "SUPABASE_ANON_KEY" ? "public" : key === "SUPABASE_SERVICE_ROLE_KEY" ? "secret" : undefined }, serve: (fn) => { handler = fn; } }, Response, crypto });
  const send = (body) => handler(new Request("https://test.invalid", { method: "POST", headers: { Authorization: "Bearer test" }, body: JSON.stringify(body) }));
  return { state, send, request: async (action = "importar", rows = [row]) => send({ action, yearId: 1, rows }) };
}
test("servidor niega sesiones inválidas y roles ajenos sin crear cuentas", async () => {
  const h = harness(); h.state.authenticated = false;
  assert.equal((await h.request()).status, 401);
  h.state.authenticated = true; h.state.role = "estudiante";
  assert.equal((await h.request()).status, 403); assert.equal(h.state.created, 0);
});
test("revisión no escribe y respeta límite de lote y validación de identidad", async () => {
  const h = harness(); h.state.role = "coordinador_academico";
  assert.equal((await (await h.request("validar")).json()).results[0].status, "ready");
  assert.equal(h.state.created, 0); assert.equal(h.state.saved, 0);
  assert.equal((await h.request("importar", Array(11).fill(row))).status, 400);
  h.state.planError = "El DNI ya está vinculado a otro correo.";
  assert.equal((await (await h.request()).json()).results[0].status, "error"); assert.equal(h.state.created, 0);
});
test("fallo parcial y respuesta perdida permiten reintentar sin crear otra cuenta ni resetear claves", async () => {
  const h = harness(); h.state.failSave = true;
  let result = await (await h.request()).json();
  assert.equal(result.results[0].status, "error"); assert.equal(result.results[0].accountCreated, true);
  h.state.failSave = false;
  result = await (await h.request()).json();
  assert.equal(result.results[0].status, "done"); assert.equal(result.results[0].accountCreated, true); assert.equal(h.state.created, 1);
  assert.ok(!JSON.stringify(result).includes(row.password));
  // Una importación diferente conserva las credenciales existentes y no las supone nuevas.
  result = await (await h.request("importar", [{ ...row, importId: "00000000-0000-4000-8000-000000000124" }])).json();
  assert.equal(result.results[0].accountCreated, false); assert.equal(h.state.created, 1);
});
test("restablecer al DNI solo para cuentas de estudiante y sin guardar la clave", async () => {
  const h = harness();
  const student = "00000000-0000-4000-8000-000000000101"; const teacher = "00000000-0000-4000-8000-000000000999";
  const { credentials } = await (await h.send({ action: "regenerar", userIds: [student, teacher] })).json();
  assert.equal(credentials[0].password, "99001001");
  assert.equal(credentials[1].error, "No es una cuenta de estudiante."); assert.equal(h.state.passwords[teacher], undefined);
  assert.equal(h.state.events.length, 1); assert.ok(!JSON.stringify(h.state.events).includes(credentials[0].password));
  h.state.role = "docente";
  assert.equal((await h.send({ action: "regenerar", userIds: [student] })).status, 403);
});
test("apoderado: una cuenta de familia por DNI y clave inicial igual al DNI", async () => {
  const h = harness();
  const guardian = { parentDni: "87654321", parentName: "Rosa Pérez", parentRelation: "madre" };
  await (await h.request("validar", [{ ...row, ...guardian }])).json();
  assert.equal(h.state.parentAccounts, 0);
  let result = await (await h.request("importar", [{ ...row, ...guardian }])).json();
  assert.equal(result.results[0].parentCreated, true); assert.equal(result.results[0].parentEmail, "87654321@familias.maxplanck.edu.pe");
  assert.equal(h.state.parentPasswords, "87654321");
  h.state.account = null;
  result = await (await h.request("importar", [{ ...row, row: 3, dni: "12345679", email: "hermano@test.invalid", importId: "00000000-0000-4000-8000-000000000125", ...guardian }])).json();
  assert.equal(result.results[0].parentCreated, false); assert.equal(h.state.parentAccounts, 1);
  assert.equal(h.state.links.length, 2); assert.equal(h.state.links[1].apoderado, "parent-1"); assert.equal(h.state.links[1].parentesco, "madre");
  result = await (await h.request("validar", [{ ...row, parentDni: "12345678", parentName: "Rosa" }])).json();
  assert.equal(result.results[0].status, "error");
});
