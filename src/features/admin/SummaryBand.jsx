export default function SummaryBand({ module }) {
  const values = module === "Docentes"
    ? [["98", "Docentes activos"], ["42", "Tutores"], ["96%", "Carga asignada"], ["7", "Áreas académicas"]]
    : module === "Familias"
    ? [["1,102", "Familias activas"], ["94%", "Datos completos"], ["37", "Atenciones abiertas"], ["91%", "Pagos al día"]]
    : module === "Administración"
    ? [["1,248", "Matrículas activas"], ["91%", "Recaudación"], ["26", "Trámites abiertos"], ["92%", "Asistencia hoy"]]
    : [["1,248", "Estudiantes"], ["42", "Secciones"], ["92%", "Asistencia hoy"], ["16.4", "Promedio general"]];
  return (
    <section className="mb-[18px] grid grid-cols-2 bg-brand-900 text-white md:grid-cols-4">
      {values.map(([value, label], index) => (
        <div key={label} className={`grid gap-[3px] p-[18px] md:p-[22px] border-white/15 ${index > 0 ? "md:border-l" : ""} ${index === 2 ? "border-t md:border-t-0 md:border-l" : index === 3 ? "border-t md:border-t-0" : ""}`}>
          <strong className="font-display text-xl font-bold md:text-2xl">{value}</strong>
          <span className="text-[11px] text-[#c4ddd5]">{label}</span>
        </div>
      ))}
    </section>
  );
}
