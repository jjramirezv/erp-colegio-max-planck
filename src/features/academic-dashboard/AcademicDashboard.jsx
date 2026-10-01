import {
  ArrowRight, BookOpenCheck, CalendarDays, Check, CircleAlert, GraduationCap,
  LoaderCircle, School, UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { loadAcademicWorkspace } from "../academic/academicApi";
import { EMPTY_WORKSPACE } from "../academic/constants";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

function formatDate(value) {
  if (!value) return "Sin fecha";
  return DATE_FORMATTER.format(new Date(`${value}T00:00:00Z`)).replace(".", "");
}

function Metric({ icon: Icon, value, label, tone }) {
  const tones = {
    green: "bg-brand-100 text-brand-900",
    blue: "bg-[#eaf5fb] text-[#1677a6]",
    yellow: "bg-amber-soft text-[#966b00]",
    mint: "bg-[#edf7f3] text-[#08785b]",
  };
  return (
    <article className="flex min-h-[108px] items-center gap-3 border-b border-r border-line bg-white p-4 [&:nth-child(even)]:border-r-0 [&:nth-child(n+3)]:border-b-0 md:p-5 lg:border-b-0 lg:[&:nth-child(even)]:border-r lg:last:border-r-0">
      <span className={`grid h-11 w-11 flex-none place-items-center rounded-full ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <strong className="block font-sans text-[25px] font-extrabold tracking-[-0.04em] text-ink">{value}</strong>
        <span className="text-[10px] font-bold leading-snug text-muted">{label}</span>
      </div>
    </article>
  );
}

function ReadinessRow({ ready, title, detail }) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3.5 last:border-b-0">
      <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full ${ready ? "bg-brand-800 text-white" : "border border-[#d8c78c] bg-amber-soft text-[#8d6700]"}`}>
        {ready ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div><strong className="block text-[11px] text-ink">{title}</strong><span className="mt-0.5 block text-[10px] leading-relaxed text-muted">{detail}</span></div>
    </li>
  );
}

export default function AcademicDashboard({ user, onNavigate }) {
  const remote = isSupabaseConfigured && user?.authSource === "supabase";
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(remote);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!remote) return;
    setLoading(true);
    setError("");
    try { setWorkspace(await loadAcademicWorkspace()); }
    catch (failure) { setError(failure.message || "No se pudo cargar el panel académico."); }
    finally { setLoading(false); }
  }, [remote]);

  useEffect(() => { refresh(); }, [refresh]);

  const summary = useMemo(() => {
    const teachers = workspace.profiles.filter((item) => item.role === "docente" && item.active).length;
    const year = workspace.years.find((item) => item.active) || null;
    if (!year) return { year: null, enrollments: 0, sections: 0, courses: 0, teachers, assignments: 0 };
    const sections = workspace.sections.filter((item) => String(item.academicYearId) === String(year.id) && item.active);
    const sectionIds = new Set(sections.map((item) => String(item.id)));
    const courses = workspace.offerings.filter((item) => String(item.academicYearId) === String(year.id) && item.active && !item.archivedAt);
    const courseIds = new Set(courses.map((item) => String(item.id)));
    return {
      year,
      sections: sections.length,
      courses: courses.length,
      enrollments: workspace.enrollments.filter((item) => String(item.academicYearId) === String(year.id) && item.status === "active" && !item.archivedAt).length,
      teachers,
      assignments: workspace.assignments.filter((item) => item.active && !item.archivedAt && (courseIds.has(String(item.courseOfferingId)) || sectionIds.has(String(item.sectionId)))).length,
    };
  }, [workspace]);

  return (
    <section className="mx-auto max-w-[1360px] text-ink" aria-busy={loading}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.17em] text-[#1677a6]">Coordinación Académica</span>
          <h1 className="mb-1 mt-1 text-3xl font-extrabold tracking-[-0.045em] text-[#14231e] sm:text-4xl">Panel académico</h1>
          <p className="m-0 text-[13px] text-muted">Vista operativa del año lectivo con información registrada en el sistema.</p>
        </div>
      </header>

      {error ? <div className="mb-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-red-soft p-3 text-[11px] leading-relaxed text-[#8f2020]" role="alert"><CircleAlert className="mt-0.5 h-4 w-4 flex-none" />{error}</div> : null}

      <article className="mb-4 overflow-hidden rounded-[8px] border border-line-strong bg-white">
        <div className="h-1.5 bg-[linear-gradient(90deg,#075b46_0_52%,#f3bd24_52%_78%,#2387b7_78%)]" />
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-brand-100 text-brand-900"><CalendarDays className="h-5 w-5" /></span>
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-brand-800">Año lectivo actual</span>
              <h2 className="mb-0 mt-1 font-sans text-[21px] font-extrabold">{loading ? "Cargando…" : summary.year ? summary.year.name : "Sin año lectivo activo"}</h2>
              <p className="mb-0 mt-1 text-[10px] text-muted">{summary.year ? `${formatDate(summary.year.startsOn)} — ${formatDate(summary.year.endsOn)}` : "Alta Dirección debe configurar o activar un año lectivo."}</p>
            </div>
          </div>
          {summary.year ? <span className="w-fit rounded-full bg-brand-800 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-white">Activo</span> : null}
        </div>
      </article>

      <section className="mb-4 grid grid-cols-2 overflow-hidden rounded-[8px] border border-line bg-white lg:grid-cols-4" aria-label="Resumen académico">
        <Metric icon={UsersRound} value={loading ? "—" : summary.enrollments} label="Estudiantes matriculados" tone="green" />
        <Metric icon={School} value={loading ? "—" : summary.sections} label="Salones habilitados" tone="yellow" />
        <Metric icon={BookOpenCheck} value={loading ? "—" : summary.courses} label="Cursos programados" tone="blue" />
        <Metric icon={GraduationCap} value={loading ? "—" : summary.teachers} label="Docentes activos" tone="mint" />
      </section>

      {loading ? (
        <div className="grid min-h-[270px] place-content-center justify-items-center gap-2 rounded-[8px] border border-line bg-white text-muted"><LoaderCircle className="h-7 w-7 animate-spin text-brand-800 motion-reduce:animate-none" /><span className="text-[11px]">Cargando información académica…</span></div>
      ) : !remote ? (
        <div className="grid min-h-[270px] place-content-center justify-items-center gap-2 rounded-[8px] border border-line bg-white p-8 text-center"><CircleAlert className="h-7 w-7 text-amber" /><strong className="text-[13px]">Conecta Supabase para consultar el panel</strong><span className="max-w-[380px] text-[11px] leading-relaxed text-muted">Esta vista no utiliza información de demostración.</span></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <article className="rounded-[8px] border border-line-strong bg-white p-5 md:p-6">
            <div className="mb-2 flex items-center justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#1677a6]">Estado operativo</span><h2 className="mb-0 mt-1 font-sans text-[17px] font-extrabold">Preparación académica</h2></div><BookOpenCheck className="h-5 w-5 text-[#1677a6]" /></div>
            <ul className="m-0 list-none p-0">
              <ReadinessRow ready={Boolean(summary.year)} title="Año lectivo" detail={summary.year ? `${summary.year.name} está disponible para trabajar.` : "Aún no existe una vigencia académica activa."} />
              <ReadinessRow ready={summary.sections > 0} title="Grados y salones" detail={summary.sections > 0 ? `${summary.sections} salones habilitados en el año actual.` : "Alta Dirección debe crear los salones del año."} />
              <ReadinessRow ready={summary.courses > 0} title="Carga académica" detail={summary.courses > 0 ? `${summary.courses} cursos vinculados a los salones.` : "Aún no hay cursos programados para los salones."} />
              <ReadinessRow ready={summary.assignments > 0} title="Asignación docente" detail={summary.assignments > 0 ? `${summary.assignments} responsabilidades docentes registradas.` : "Aún no hay responsables académicos asignados."} />
            </ul>
          </article>

          <aside className="rounded-[8px] border border-line-strong bg-white p-5 md:p-6">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#966b00]">Accesos disponibles</span>
            <h2 className="mb-1 mt-1 font-sans text-[17px] font-extrabold">Trabajo académico</h2>
            <p className="mb-5 mt-0 text-[10px] leading-relaxed text-muted">Por ahora están habilitados los procesos que ya funcionan con Supabase.</p>
            <div className="grid gap-2">
              <button type="button" onClick={() => onNavigate("Calendario")} className="flex min-h-14 items-center justify-between rounded-[6px] border border-brand-900 bg-brand-900 px-4 text-left text-white hover:bg-brand-950"><span><small className="block text-[8px] font-black uppercase tracking-wider text-[#bfe0d5]">Planificación</small><strong className="mt-0.5 block text-[11px]">Calendario académico</strong></span><ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => onNavigate("Materiales")} className="flex min-h-14 items-center justify-between rounded-[6px] border border-[#c99a12] bg-amber-soft px-4 text-left text-[#765500] hover:bg-[#ffefb4]"><span><small className="block text-[8px] font-black uppercase tracking-wider">Aula virtual</small><strong className="mt-0.5 block text-[11px]">Materiales educativos</strong></span><ArrowRight className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 rounded-[6px] bg-[#eaf5fb] p-3 text-[10px] leading-relaxed text-[#1d6485]"><strong className="block">Siguiente ítem</strong>Gestión de matrícula académica.</div>
          </aside>
        </div>
      )}
    </section>
  );
}
