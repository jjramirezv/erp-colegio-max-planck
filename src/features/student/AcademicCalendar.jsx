import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import ActivityWizard from "../calendar/ActivityWizard";
import {
  cancelCalendarActivity,
  loadCalendarActivities,
  saveCalendarActivity,
  subscribeToCalendar,
} from "../calendar/calendarApi";
import {
  audienceLabel,
  buildMonthCells,
  dateKey,
  EVENT_TYPES,
  longDateLabel,
  monthLabel,
  rangeForMonth,
  shortTimeLabel,
} from "../calendar/calendarUtils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function Notice({ tone = "error", children, onRetry }) {
  const danger = tone === "error";
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[11px] ${danger ? "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]" : "border-[#a9d6c5] bg-[#f1faf6] text-brand-900"}`} role={danger ? "alert" : "status"}>
      {danger ? <CircleAlert className="h-4 w-4 shrink-0" /> : <CalendarDays className="h-4 w-4 shrink-0" />}
      <span className="flex-1 font-semibold">{children}</span>
      {onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}
    </div>
  );
}

function EmptyAgenda({ canEdit, connected, onCreate }) {
  return (
    <div className="grid min-h-[310px] place-content-center justify-items-center px-5 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-800"><CalendarDays className="h-6 w-6" /></span>
      <h3 className="mb-1 mt-4 font-sans text-[16px] font-extrabold text-brand-950">No hay actividades este día</h3>
      <p className="m-0 max-w-[300px] text-[10px] leading-relaxed text-muted">
        {connected ? "Selecciona otra fecha o registra una nueva actividad." : "Configura Supabase para consultar el calendario institucional."}
      </p>
      {canEdit && connected ? <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-brand-900 px-4 text-[10px] font-extrabold text-white" onClick={onCreate}><Plus className="h-4 w-4" />Agregar actividad</button> : null}
    </div>
  );
}

export default function AcademicCalendar({ canEdit, studentView = false, user }) {
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [activities, setActivities] = useState([]);
  const [activeType, setActiveType] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [wizard, setWizard] = useState(null);
  const [loading, setLoading] = useState(connected);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta conectada a Supabase para cargar el calendario.");
  const [notice, setNotice] = useState("");
  const realtimeTimer = useRef(null);

  const refresh = useCallback(async ({ quiet = false, target = cursor } = {}) => {
    if (!connected) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const items = await loadCalendarActivities(rangeForMonth(target));
      setActivities(items);
      setError("");
    } catch (requestError) {
      setActivities([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connected, cursor]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!connected) return undefined;
    return subscribeToCalendar(() => {
      window.clearTimeout(realtimeTimer.current);
      realtimeTimer.current = window.setTimeout(() => refresh({ quiet: true }), 180);
    });
  }, [connected, refresh]);

  useEffect(() => () => window.clearTimeout(realtimeTimer.current), []);

  const filteredActivities = useMemo(
    () => activeType === "all" ? activities : activities.filter((activity) => activity.type === activeType),
    [activeType, activities],
  );
  const activitiesByDate = useMemo(() => {
    const grouped = new Map();
    filteredActivities.forEach((activity) => {
      const firstDay = dateKey(activity.startsAt);
      const lastDay = dateKey(activity.endsAt);
      const day = new Date(`${firstDay}T12:00:00`);
      for (let count = 0; count < 370; count += 1) {
        const key = dateKey(day);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(activity);
        if (key === lastDay) break;
        day.setDate(day.getDate() + 1);
      }
    });
    return grouped;
  }, [filteredActivities]);
  const selectedActivities = activitiesByDate.get(selectedDate) || [];
  const monthCells = useMemo(() => buildMonthCells(cursor), [cursor]);

  function selectDay(cell) {
    setSelectedDate(cell.key);
    setExpandedId(null);
    if (!cell.currentMonth) setCursor(new Date(cell.value.getFullYear(), cell.value.getMonth(), 1));
  }

  function moveMonth(delta) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    setSelectedDate(dateKey(next));
    setExpandedId(null);
  }

  function goToday() {
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    setCursor(next);
    setSelectedDate(todayKey);
    setExpandedId(null);
  }

  async function saveActivity(values) {
    setBusy(true);
    try {
      await saveCalendarActivity(values);
      const target = new Date(`${values.startDate}T12:00:00`);
      const targetMonth = new Date(target.getFullYear(), target.getMonth(), 1);
      setCursor(targetMonth);
      setSelectedDate(values.startDate);
      setWizard(null);
      setNotice(values.status === "published" ? "Actividad publicada correctamente." : "Borrador guardado correctamente.");
      await refresh({ quiet: true, target: targetMonth });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelActivity(activity) {
    if (!window.confirm(`¿Cancelar “${activity.title}”? Dejará de mostrarse en el calendario.`)) return;
    setBusy(true);
    try {
      await cancelCalendarActivity(activity.id);
      setExpandedId(null);
      setNotice("La actividad fue cancelada.");
      await refresh({ quiet: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={studentView ? "mx-auto max-w-none" : ""}>
      <PageHeading
        standard={!studentView}
        title={studentView ? "Mi calendario" : "Calendario académico"}
        description={studentView ? "Actividades y fechas importantes del colegio" : "Organiza y comunica las actividades de la comunidad educativa"}
        action={canEdit && connected ? (
          <button className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[5px] bg-brand-900 px-[18px] text-[11px] font-extrabold text-white shadow-[0_7px_18px_rgba(3,80,61,0.16)] hover:bg-brand-950" onClick={() => setWizard({ activity: null, initialDate: selectedDate })}>
            <Plus className="h-4 w-4" /><span>Nueva actividad</span>
          </button>
        ) : null}
      />

      {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="overflow-hidden rounded-[10px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.06)] lg:grid lg:grid-cols-[minmax(300px,0.72fr)_minmax(430px,1.28fr)]">
        <section className="min-w-0 border-b border-line-strong p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[9px] font-extrabold uppercase tracking-[0.16em] text-brand-700">Vista mensual</p>
              <h2 className="mb-0 mt-1 font-sans text-[19px] font-extrabold tracking-[-0.03em] text-brand-950">{monthLabel(cursor)}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-brand-900 hover:bg-brand-50" onClick={() => moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
              <button className="h-9 rounded-full border border-line bg-white px-3 text-[9px] font-extrabold text-brand-900 hover:bg-brand-50" onClick={goToday}>Hoy</button>
              <button className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-brand-900 hover:bg-brand-50" onClick={() => moveMonth(1)} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="mb-4 grid grid-cols-2 gap-1.5 min-[480px]:flex min-[480px]:flex-wrap" aria-label="Filtrar por tipo de actividad">
            <button className={`rounded-full border px-3 py-1.5 text-[9px] font-extrabold ${activeType === "all" ? "border-brand-900 bg-brand-900 text-white" : "border-line bg-white text-muted"}`} onClick={() => setActiveType("all")}>Todos</button>
            {Object.entries(EVENT_TYPES).map(([key, type]) => <button key={key} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-bold ${activeType === key ? `${type.surface} ${type.text}` : "border-line bg-white text-muted"}`} onClick={() => setActiveType(key)}><span className={`h-1.5 w-1.5 rounded-full ${type.dot}`} />{type.label}</button>)}
          </div>

          <div className="grid grid-cols-7 border-b border-line pb-2" aria-hidden="true">
            {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="text-center text-[9px] font-black text-muted">{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {monthCells.map((cell) => {
              const dayActivities = activitiesByDate.get(cell.key) || [];
              const selected = cell.key === selectedDate;
              const isToday = cell.key === todayKey;
              return (
                <button key={cell.key} className={`group relative grid min-h-[47px] place-items-center rounded-[8px] text-[10px] transition ${cell.currentMonth ? "text-ink hover:bg-brand-50" : "text-[#a9b5b1]"} ${selected ? "bg-brand-900 text-white shadow-[0_6px_13px_rgba(3,80,61,0.2)] hover:bg-brand-900" : ""}`} onClick={() => selectDay(cell)} aria-label={`${cell.day}, ${dayActivities.length} actividades`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full font-extrabold ${isToday && !selected ? "ring-1 ring-[#d99a0b] text-[#a56500]" : ""}`}>{cell.day}</span>
                  <span className="absolute bottom-[4px] flex h-1.5 items-center justify-center gap-[2px]">
                    {dayActivities.slice(0, 3).map((activity) => <span key={activity.id} className={`h-1 w-1 rounded-full ${selected ? "bg-white" : EVENT_TYPES[activity.type]?.dot || "bg-brand-700"}`} />)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center justify-between text-[9px] text-muted"><span>{activities.length} {activities.length === 1 ? "actividad en el mes" : "actividades en el mes"}</span>{refreshing ? <span className="inline-flex items-center gap-1"><LoaderCircle className="h-3 w-3 animate-spin" />Actualizando</span> : <span>Zona horaria: Lima</span>}</div>
          </div>
        </section>

        <section className="min-w-0 min-h-[520px] bg-[#fbfcfc]">
          <header className="flex min-h-[86px] min-w-0 items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="m-0 text-[9px] font-extrabold uppercase tracking-[0.16em] text-brand-700">Agenda del día</p>
              <h2 className="mb-0 mt-1 font-sans text-[18px] font-extrabold tracking-[-0.025em] text-brand-950">{longDateLabel(selectedDate)}</h2>
            </div>
            <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-[9px] font-extrabold text-brand-900">{selectedActivities.length} {selectedActivities.length === 1 ? "actividad" : "actividades"}</span>
          </header>

          {loading ? (
            <div className="grid min-h-[360px] place-content-center justify-items-center gap-3 text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-brand-800" /><span className="text-[10px] font-semibold">Cargando calendario…</span></div>
          ) : selectedActivities.length ? (
            <div className="relative px-4 py-5 before:absolute before:bottom-8 before:left-[76px] before:top-8 before:w-px before:bg-line sm:px-7 sm:before:left-[98px]">
              <div className="grid gap-4">
                {selectedActivities.map((activity) => {
                  const type = EVENT_TYPES[activity.type] || EVENT_TYPES.academico;
                  const expanded = expandedId === activity.id;
                  return (
                    <article key={activity.id} className="relative grid grid-cols-[48px_12px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[58px_14px_minmax(0,1fr)] sm:gap-4">
                      <time className="pt-4 text-right text-[9px] font-extrabold leading-tight text-brand-950">{shortTimeLabel(activity)}</time>
                      <span className={`relative z-[1] mt-[18px] h-3 w-3 rounded-full border-[3px] border-[#fbfcfc] ring-1 ring-white ${type.dot}`} />
                      <div className={`w-full cursor-pointer rounded-[8px] border p-4 text-left shadow-[0_5px_14px_rgba(7,54,42,0.04)] transition hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(7,54,42,0.08)] ${type.surface}`} role="button" tabIndex={0} onClick={() => setExpandedId(expanded ? null : activity.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedId(expanded ? null : activity.id); } }} aria-expanded={expanded}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2"><span className={`text-[8px] font-black uppercase tracking-[0.08em] ${type.text}`}>{type.label}</span>{activity.status === "draft" ? <span className="rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-extrabold text-muted">Borrador</span> : null}</div>
                            <h3 className="m-0 truncate font-sans text-[15px] font-extrabold text-brand-950">{activity.title}</h3>
                            <p className="mb-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{activity.location || "Sin lugar"}</span><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{audienceLabel(activity)}</span></p>
                          </div>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`} />
                        </div>
                        {expanded ? (
                          <div className="mt-4 border-t border-current/10 pt-4">
                            <p className="m-0 text-[10px] leading-relaxed text-[#52625d]">{activity.description || "Sin descripción adicional."}</p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-1.5 text-[9px] text-muted"><Clock3 className="h-3.5 w-3.5" />Responsable: {activity.responsible || "Sin asignar"}</span>
                              {canEdit ? <span className="flex gap-2"><button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded-[4px] border border-line-strong bg-white px-3 py-2 text-[9px] font-extrabold text-brand-900" onClick={(event) => { event.stopPropagation(); setWizard({ activity, initialDate: selectedDate }); }}><Pencil className="h-3 w-3" />Editar</button><button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded-[4px] border border-[#efb0ad] bg-white px-3 py-2 text-[9px] font-extrabold text-[#9f2525]" onClick={(event) => { event.stopPropagation(); cancelActivity(activity); }}><Trash2 className="h-3 w-3" />Cancelar</button></span> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : <EmptyAgenda canEdit={canEdit} connected={connected} onCreate={() => setWizard({ activity: null, initialDate: selectedDate })} />}
        </section>
      </div>

      {wizard ? <ActivityWizard activity={wizard.activity} initialDate={wizard.initialDate} user={user} busy={busy} onClose={() => setWizard(null)} onSave={saveActivity} /> : null}
    </div>
  );
}
