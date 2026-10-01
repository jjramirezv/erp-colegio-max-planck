import { CheckCircle2, CircleAlert, Clock3, FileUp, ListFilter, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import { DEFAULT_GENERAL_SETTINGS, loadGeneralSettings, saveGeneralSettings } from "./generalSettingsApi";

const SELECT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const ITEMS = [
  { key: "sessionTimeoutMinutes", title: "Tiempo de sesión", description: "Cierra una sesión que permanece inactiva para proteger la cuenta.", icon: Clock3, iconClass: "bg-brand-50 text-brand-800", options: [[15, "15 minutos"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"]] },
  { key: "pageSize", title: "Resultados por página", description: "Cantidad inicial de registros mostrados en los listados compatibles.", icon: ListFilter, iconClass: "bg-[#eff8fd] text-[#237db3]", options: [[10, "10 resultados"], [20, "20 resultados"], [50, "50 resultados"]] },
  { key: "maxFileSizeMb", title: "Límite para materiales", description: "Tamaño máximo permitido al cargar archivos educativos.", icon: FileUp, iconClass: "bg-[#fff8df] text-[#946c00]", options: [[5, "5 MB"], [10, "10 MB"], [25, "25 MB"], [50, "50 MB"], [100, "100 MB"]] },
];

function Notice({ children, tone = "error" }) { const success = tone === "success"; return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="font-semibold">{children}</span></div>; }

export default function GeneralSettingsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [saved, setSaved] = useState({ ...DEFAULT_GENERAL_SETTINGS }); const [values, setValues] = useState({ ...DEFAULT_GENERAL_SETTINGS });
  const [loading, setLoading] = useState(connected); const [busy, setBusy] = useState(false); const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase."); const [notice, setNotice] = useState("");
  const dirty = useMemo(() => ITEMS.some((item) => Number(values[item.key]) !== Number(saved[item.key])), [values, saved]);

  const refresh = useCallback(async () => { if (!connected) return; setLoading(true); try { const next = await loadGeneralSettings(); setValues(next); setSaved(next); setError(""); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }, [connected]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const beforeUnload = (event) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", beforeUnload); return () => window.removeEventListener("beforeunload", beforeUnload); }, [dirty]);

  async function save() { if (!dirty || busy) return; setBusy(true); setError(""); setNotice(""); try { const next = await saveGeneralSettings(values); setValues(next); setSaved(next); setNotice("Los parámetros se actualizaron en todo el portal."); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); } }

  return <section className="mx-auto max-w-[1100px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Parámetros generales" description="Ajusta el comportamiento operativo del portal" action={<button type="button" disabled={!dirty || busy || loading} className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-45" onClick={save}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : "Guardar cambios"}</button>} />
    {error ? <Notice>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="overflow-hidden rounded-[10px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><div className="grid h-1 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div><header className="flex items-center gap-3 border-b border-line px-5 py-5 sm:px-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-800"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="m-0 font-sans text-[17px] font-bold text-brand-950">Preferencias del sistema</h2><p className="mb-0 mt-1 text-[9px] text-muted">Los cambios se guardan una sola vez y se aplican a las sesiones del portal.</p></div></header>
      {loading ? <div className="grid min-h-[320px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Consultando Supabase…</div> : <div>{ITEMS.map((item) => { const Icon = item.icon; return <div key={item.key} className="grid gap-4 border-t border-line px-5 py-5 first:border-t-0 sm:px-6 md:grid-cols-[1fr_260px] md:items-center"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${item.iconClass}`}><Icon className="h-4 w-4" /></span><div><h3 className="m-0 font-sans text-[15px] font-bold text-brand-950">{item.title}</h3><p className="mb-0 mt-1 max-w-[520px] text-[9px] leading-relaxed text-muted">{item.description}</p></div></div><label><span className="sr-only">{item.title}</span><select className={SELECT} value={values[item.key]} onChange={(event) => { setValues((current) => ({ ...current, [item.key]: Number(event.target.value) })); setNotice(""); }}>{item.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>; })}</div>}
    </section>
    <p className="mt-3 text-[8px] leading-relaxed text-muted">La identidad, evaluación, calendario y numeración documental se administran en sus propios apartados.</p>
  </section>;
}
