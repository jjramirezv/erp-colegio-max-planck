import { CalendarDays, CheckCircle2, CircleAlert, Clock3, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicYears } from "../academic-years/academicYearsApi";
import ShiftJournalDialog from "./ShiftJournalDialog";
import { deleteShiftJournal, loadShiftsJournals, saveShiftJournal, subscribeToShiftsJournals } from "./shiftsJournalsApi";

const SELECT = "min-h-10 rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-ink outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.10)]";
const DAY_NAMES = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function EmptyShifts({ blocked }) {
  return <div className="grid min-h-[240px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><Clock3 className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-bold text-brand-950">{blocked ? "Primero crea un año lectivo" : "Aún no hay turnos configurados"}</h3><p className="m-0 max-w-[340px] text-[9px] leading-relaxed text-muted">{blocked ? "Los turnos necesitan un año lectivo disponible." : "Usa “Nuevo turno” para definir el horario de funcionamiento."}</p></div>;
}

function ShiftRow({ shift, readOnly, onEdit, onDelete }) {
  const days = shift.weekdays.map((day) => DAY_NAMES[day]).join(" · ");
  return <article className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[1fr_0.85fr_1.25fr_0.55fr_0.55fr] lg:items-center lg:gap-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[7px] bg-brand-50 text-brand-800"><Clock3 className="h-4 w-4" /></span><strong className="font-sans text-[15px] font-bold text-brand-950">{shift.name}</strong></div><span className="text-[10px] font-extrabold text-[#176d9f]">{shift.startTime} – {shift.endTime}</span><div className="flex items-center gap-2 text-[9px] font-bold text-[#42524c]"><CalendarDays className="h-4 w-4 text-[#237db3]" /><span>{days}</span></div><span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${shift.active ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}><i className={`h-1.5 w-1.5 rounded-full ${shift.active ? "bg-brand-700" : "bg-[#82908b]"}`} />{shift.active ? "Activo" : "Inactivo"}</span><div className="flex items-center gap-1 lg:justify-end">{readOnly ? <span className="text-[8px] font-bold text-muted">Solo consulta</span> : <><button className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${shift.name}`}><Pencil className="h-4 w-4" /></button><button className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete} aria-label={`Eliminar ${shift.name}`}><Trash2 className="h-4 w-4" /></button></>}</div></article>;
}

export default function ShiftsJournalsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [years, setYears] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(connected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!connected) return;
    if (!quiet) setLoading(true);
    try {
      const [yearRows, shiftRows] = await Promise.all([loadAcademicYears(), loadShiftsJournals()]);
      setYears(yearRows); setShifts(shiftRows); setError("");
      setSelectedYear((current) => current && yearRows.some((year) => String(year.id) === String(current)) ? current : String(yearRows.find((year) => year.status === "activo")?.id || yearRows.find((year) => year.status === "preparacion")?.id || yearRows[0]?.id || ""));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [connected]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToShiftsJournals(() => { window.clearTimeout(refreshTimer.current); refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180); });
  }, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const currentYear = useMemo(() => years.find((year) => String(year.id) === String(selectedYear)), [years, selectedYear]);
  const visibleShifts = useMemo(() => shifts.filter((shift) => String(shift.yearId) === String(selectedYear)), [shifts, selectedYear]);
  const blocked = !years.some((year) => year.status !== "cerrado");
  const readOnly = currentYear?.status === "cerrado";

  async function save(values) {
    if (!connected) return setError("Conecta el portal con Supabase para guardar el turno.");
    setBusy(true); setError(""); setNotice("");
    try { await saveShiftJournal(values); setDialog(null); setNotice(values.id ? "Turno actualizado." : "Turno creado."); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function remove(shift) {
    if (!window.confirm(`¿Eliminar el turno ${shift.name}? Solo será posible si no está asignado a salones.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await deleteShiftJournal(shift.id); setNotice(`${shift.name} fue eliminado.`); await refresh({ quiet: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Turnos y jornadas" description="Define los turnos institucionales, sus horas y días de funcionamiento" action={<button aria-label="Nuevo turno" disabled={blocked || readOnly} title={blocked ? "Necesitas un año lectivo disponible" : readOnly ? "El año cerrado es solo de consulta" : "Nuevo turno"} className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setDialog({ shift: null })}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nuevo turno</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 flex flex-wrap items-end gap-3 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)]"><label className="grid min-w-[220px] gap-1.5"><span className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">Año lectivo</span><select className={SELECT} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}><option value="">Seleccionar año</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === "cerrado" ? " · cerrado" : ""}</option>)}</select></label><p className="m-0 max-w-[520px] text-[9px] leading-relaxed text-muted">Aquí defines la jornada general. La distribución de cursos por horas se realizará después en <strong className="text-brand-900">Horarios de clases</strong>.</p>{readOnly ? <span className="ml-auto text-[9px] font-bold text-muted">Año cerrado · solo consulta</span> : null}</section>

    <section className="overflow-visible rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Turnos configurados</h2><p className="mb-0 mt-1 text-[8px] text-muted">{visibleShifts.length} turno{visibleShifts.length === 1 ? "" : "s"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>
      {loading ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Cargando…</div> : visibleShifts.length ? <><div className="hidden grid-cols-[1fr_0.85fr_1.25fr_0.55fr_0.55fr] gap-4 border-b border-line bg-[#f8faf9] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted lg:grid"><span>Turno</span><span>Jornada</span><span>Días</span><span>Estado</span><span className="text-right">Acciones</span></div>{visibleShifts.map((shift) => <ShiftRow key={shift.id} shift={shift} readOnly={readOnly} onEdit={() => setDialog({ shift })} onDelete={() => remove(shift)} />)}</> : <EmptyShifts blocked={blocked} />}
    </section>

    {dialog ? <ShiftJournalDialog key={dialog.shift?.id || "new"} shift={dialog.shift} years={years} initialYearId={selectedYear} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
