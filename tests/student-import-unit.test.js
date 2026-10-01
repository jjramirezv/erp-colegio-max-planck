import { test } from "node:test";
import assert from "node:assert/strict";
import { HEADERS, parseCSV, prepareRows, toCSV } from "../src/features/student-import/csv.js";
const section = { yearId: 1, level: "Primaria", grade: "Primero", section: "A" };
test("CSV simple se admite solo cuando el salón se selecciona en pantalla", () => {
  const csv = "dni;nombres;apellidos;correo;clave\n99001001;Ana;Prueba;;";
  assert.equal(parseCSV(csv, { classroomInFile: false })[0].dni, "99001001");
  assert.throws(() => parseCSV(csv), /encabezados/);
});
test("Excel CSV preserva ceros, tildes, comillas, separadores y saltos internos", () => {
  const csv = toCSV([HEADERS, ["00123456", 'Ana "María"', "Pérez; Díaz", "", "", "Primaria", "Primero", "A"]]);
  const [row] = parseCSV(csv);
  assert.equal(row.dni, "00123456"); assert.equal(row.nombres, 'Ana "María"'); assert.equal(row.apellidos, "Pérez; Díaz");
  assert.equal(prepareRows([row], [section], 1)[0].status, "pending");
  const comma = HEADERS.join(",") + '\n00123456,"Ana\nMaría",Pérez,,,Primaria,Primero,A';
  assert.equal(parseCSV(comma)[0].nombres, "Ana\nMaría");
});
test("rechaza duplicados, DNI inválido, claves cortas y secciones inexistentes", () => {
  const row = { row: 2, dni: "12345678", nombres: "Ana", apellidos: "Pérez", correo: "", clave: "", nivel: "Primaria", grado: "Primero", seccion: "A" };
  assert.ok(prepareRows([row, { ...row, row: 3 }], [section], 1).every((r) => r.status === "invalid"));
  const [invalid] = prepareRows([{ ...row, dni: "123", clave: "corta", seccion: "Z" }], [section], 1);
  assert.match(invalid.message, /8 dígitos/); assert.match(invalid.message, /Clave/); assert.match(invalid.message, /salón/);
});
test("admite 3000 filas y rechaza 3001; no convierte fórmulas en ejecutables", () => {
  const records = Array.from({ length: 3000 }, (_, i) => [String(10000000 + i), "Nombre", "Apellido", "", "", "Primaria", "Primero", "A"]);
  assert.equal(parseCSV(toCSV([HEADERS, ...records])).length, 3000);
  assert.throws(() => parseCSV(toCSV([HEADERS, ...records, records[0]])), /3000/);
  assert.match(toCSV([["=SUM(A1)", "+CMD", "@foo"]]), /'=SUM/);
  assert.throws(() => parseCSV('dni,nombres\n123,Ana'), /encabezados/);
  assert.throws(() => parseCSV(HEADERS.join(",") + '\n"123'), /cerrar/);
});
test("columnas opcionales del apoderado: valida DNI, nombre y parentesco", () => {
  const csv = "dni;nombres;apellidos;correo;clave;dni_apoderado;nombre_apoderado;parentesco\n12345678;Ana;Pérez;;;87654321;Rosa Pérez;Mamá\n12345679;Luis;Pérez;;;87654321;Rosa Pérez;madre\n12345680;Eva;Soto;;;123;X;tía";
  const records = parseCSV(csv, { classroomInFile: false }).map((row) => ({ ...row, nivel: "Primaria", grado: "Primero", seccion: "A" }));
  const [ana, luis, eva] = prepareRows(records, [section], 1);
  assert.equal(ana.status, "pending"); assert.equal(ana.parentRelation, "madre"); assert.equal(ana.parentEmail, "87654321@familias.maxplanck.edu.pe");
  assert.equal(luis.status, "pending");
  assert.equal(eva.status, "invalid"); assert.match(eva.message, /DNI del apoderado/); assert.match(eva.message, /nombre del apoderado/); assert.match(eva.message, /Parentesco/);
  assert.throws(() => parseCSV("dni;nombres;apellidos;correo;clave;telefono\n1;a;b;;;9", { classroomInFile: false }), /Opcionales/);
});
