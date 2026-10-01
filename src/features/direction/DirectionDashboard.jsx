import {
  ArrowRight, BookOpenCheck, CalendarDays, Check, CircleAlert,
  GraduationCap, Layers3, LoaderCircle, School, UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { createAcademicYear, loadAcademicWorkspace } from "../academic/academicApi";
import { EMPTY_WORKSPACE } from "../academic/constants";

const INPUT_CLASS = "min-h-11 w-full rounded-[5px] border border-line-strong bg-white px-3 text-[12px] font-semibold text-ink outline-none transition focus:border-brand-800 focus:shadow-[0_0_0_3px_rgba(4,120,87,0.10)]";

function currentYearName() {
  return new Intl.DateTimeFormat("es-PE", { year: "numeric", timeZone: "America/Lima" }).format(new Date());
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <article className="flex min-h-[112px] items-center gap-4 rounded-[7px] border border-line bg-white p-4 md:p-5">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-brand-100 text-brand-900"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <strong className="block font-sans text-[25px] font-extrabold tracking-[-0.04em] text-brand-900">{value}</strong>
        <span className="text-[11px] font-semibold text-muted">{label}</span>
      </div>
    </article>
  );
}

function SetupStep({ number, label, ready }) {
  return (
    <li className="flex min-h-12 items-center gap-3 border-b border-line py-2 last:border-b-0">
      <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[10px] font-black ${ready ? "bg-brand-800 text-white" : "border border-line-strong bg-white text-muted"}`}>
        {ready ? <Check className="h-4 w-4" /> : number}
      </span>
      <span className={`text-[11px] font-bold ${ready ? "text-brand-900" : "text-muted"}`}>{label}</span>
    </li>
  );
}

export default function DirectionDashboard({ user, onNavigate }) {
  const remote = isSupabaseConfigured && user?.authSource === "supabase";
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(remote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: currentYearName(), startsOn: "", endsOn: "", periodSystem: "bimestres" });

  const refresh = useCallback(async () => {
    if (!remote) return;
    setLoading(true);
    setError("");
    try { setWorkspace(await loadAcademicWorkspace()); }
    catch (failure) { setError(failure.message || "No se pudo cargar el panel de Dirección."); }
    finally { setLoading(false); }
  }, [remote]);

  useEffect(() => { refresh(); }, [refresh]);

  const activeEnrollments = useMemo(() => workspace.enrollments.filter((item) => item.status === "active" && !item.archivedAt).length, [workspace.enrollments]);
  const teacherCount = useMemo(() => workspace.profiles.filter((item) => item.role === "docente" && item.active).length, [workspace.profiles]);
  const activeCourses = workspace.offerings.filter((item) => item.active && !item.archivedAt).length;
  const setup = {
    year: workspace.years.length > 0,
    levels: workspace.levels.length > 0,
    classrooms: workspace.grades.length > 0 && workspace.sections.length > 0,
    courses: activeCourses > 0,
  };
  const completedSteps = Object.values(setup).filter(Boolean).length;

  async function submitYear(event) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await createAcademicYear(form);
      await refresh();
      setNotice("Año lectivo creado correctamente.");
    } catch (failure) {
      setError(failure.message || "No se pudo crear el año lectivo.");
    } finally { setSaving(false); }
  }

  return (
    <section className="mx-auto max-w-[1360px] text-ink" aria-busy={loading}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.17em] text-brand-800">Alta Dirección</span>
          <h1 className="mb-1 mt-1 text-3xl font-extrabold tracking-[-0.045em] text-[#14231e] sm:text-4xl">Panel de Dirección</h1>
          <p className="m-0 text-[13px] text-muted">Configura el colegio desde cero y revisa únicamente información registrada.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#a9cbbf] bg-brand-50 px-3 py-2 text-[10px] font-bold text-brand-900">
          <span className={`h-2 w-2 rounded-full ${remote ? "bg-brand-700" : "bg-amber"}`} />{remote ? "Supabase conectado" : "Supabase no conectado"}
        </span>
      </header>

      {error ? <div className="mb-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-red-soft p-3 text-[11px] leading-relaxed text-[#8f2020]" role="alert"><CircleAlert className="mt-0.5 h-4 w-4 flex-none" />{error}</div> : null}
      {notice ? <div className="mb-4 flex items-center gap-2 rounded-[6px] border border-[#a9cbbf] bg-brand-50 p-3 text-[11px] font-bold text-brand-900" role="status"><Check className="h-4 w-4" />{notice}</div> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={UsersRound} value={loading ? "—" : activeEnrollments} label="Estudiantes matriculados" />
        <StatCard icon={GraduationCap} value={loading ? "—" : teacherCount} label="Docentes activos" />
        <StatCard icon={School} value={loading ? "—" : workspace.sections.length} label="Secciones creadas" />
        <StatCard icon={BookOpenCheck} value={loading ? "—" : activeCourses} label="Cursos configurados" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(270px,0.75fr)]">
        <article className="overflow-hidden rounded-[8px] border border-line-strong bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-line bg-[#f8faf9] p-5 md:p-6">
            <div>
              <span className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-brand-800"><CalendarDays className="h-4 w-4" />Primer paso</span>
              <h2 className="m-0 font-sans text-[19px] font-extrabold tracking-[-0.025em]">{setup.year ? "Año lectivo configurado" : "Crear el año lectivo"}</h2>
              <p className="mb-0 mt-1 max-w-[580px] text-[11px] leading-relaxed text-muted">{setup.year ? "Ya existe un periodo académico. Puedes continuar con niveles, grados y secciones." : "Este será el punto de partida real. No se crearán niveles, cursos ni alumnos automáticamente."}</p>
            </div>
            <span className="hidden rounded-full bg-brand-100 px-3 py-1.5 text-[9px] font-black text-brand-900 sm:inline">{completedSteps}/4</span>
          </div>

          {loading ? (
            <div className="grid min-h-[270px] place-content-center justify-items-center gap-2 text-muted"><LoaderCircle className="h-7 w-7 animate-spin text-brand-800 motion-reduce:animate-none" /><span className="text-[11px]">Cargando…</span></div>
          ) : !remote ? (
            <div className="grid min-h-[270px] place-content-center justify-items-center gap-2 p-8 text-center"><CircleAlert className="h-7 w-7 text-amber" /><strong className="text-[13px]">Conecta Supabase para comenzar</strong><span className="max-w-[380px] text-[11px] leading-relaxed text-muted">Este panel no utiliza información de demostración.</span></div>
          ) : !setup.year ? (
            <form className="grid gap-4 p-5 md:grid-cols-2 md:p-6" onSubmit={submitYear}>
              <label className="grid gap-1.5"><span className="text-[10px] font-bold text-muted">Nombre del año</span><input className={INPUT_CLASS} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. 2026" required /></label>
              <label className="grid gap-1.5"><span className="text-[10px] font-bold text-muted">Periodos</span><select className={INPUT_CLASS} value={form.periodSystem} onChange={(event) => setForm((current) => ({ ...current, periodSystem: event.target.value }))}><option value="bimestres">Bimestres</option><option value="trimestres">Trimestres</option><option value="semestres">Semestres</option></select></label>
              <label className="grid gap-1.5"><span className="text-[10px] font-bold text-muted">Inicio de clases</span><input type="date" className={INPUT_CLASS} value={form.startsOn} onChange={(event) => setForm((current) => ({ ...current, startsOn: event.target.value }))} required /></label>
              <label className="grid gap-1.5"><span className="text-[10px] font-bold text-muted">Cierre del año</span><input type="date" className={INPUT_CLASS} value={form.endsOn} min={form.startsOn || undefined} onChange={(event) => setForm((current) => ({ ...current, endsOn: event.target.value }))} required /></label>
              <div className="md:col-span-2 md:justify-self-start"><button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[5px] border border-brand-900 bg-brand-900 px-5 text-[11px] font-extrabold text-white hover:bg-brand-950 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{saving ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <CalendarDays className="h-4 w-4" />}{saving ? "Guardando…" : "Crear año lectivo"}</button></div>
            </form>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6">
              {workspace.years.map((year) => <div key={year.id} className="rounded-[6px] border border-[#b7d3c9] bg-brand-50 p-4"><span className="text-[9px] font-black uppercase tracking-wider text-brand-800">{year.active ? "Activo" : "Registrado"}</span><strong className="mt-1 block font-sans text-[20px] text-brand-950">Año {year.name}</strong><span className="mt-1 block text-[10px] text-muted">{year.startsOn} — {year.endsOn}</span></div>)}
              <button type="button" onClick={() => onNavigate("Gestión académica")} className="flex min-h-[102px] items-center justify-between rounded-[6px] border border-brand-900 bg-white p-4 text-left text-brand-900 hover:bg-brand-50"><span><small className="block text-[9px] font-black uppercase tracking-wider">Siguiente</small><strong className="mt-1 block text-[12px]">Revisar estructura académica</strong></span><ArrowRight className="h-5 w-5" /></button>
            </div>
          )}
        </article>

        <aside className="rounded-[8px] border border-line-strong bg-white p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="m-0 font-sans text-[15px] font-extrabold">Ruta de configuración</h2><Layers3 className="h-5 w-5 text-brand-800" /></div>
          <ol className="m-0 list-none p-0"><SetupStep number="1" label="Año lectivo" ready={setup.year} /><SetupStep number="2" label="Niveles educativos" ready={setup.levels} /><SetupStep number="3" label="Grados y secciones" ready={setup.classrooms} /><SetupStep number="4" label="Cursos y responsables" ready={setup.courses} /></ol>
          <p className="mb-0 mt-4 rounded-[5px] bg-amber-soft p-3 text-[10px] leading-relaxed text-amber-ink">Avanzaremos una etapa a la vez. Este panel nunca completará datos por su cuenta.</p>
        </aside>
      </div>
    </section>
  );
}
