import { BookOpenCheck, CheckCircle2, CircleAlert, FileText, HandCoins, LoaderCircle, Pencil, Plus, RefreshCw, Search, Shapes, Trash2 } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import InstitutionalConceptDialog from "./InstitutionalConceptDialog";
import { deleteInstitutionalConcept, loadInstitutionalConcepts, saveInstitutionalConcept, subscribeToInstitutionalConcepts } from "./institutionalConceptsApi";

const CATEGORIES = {
  academico: { label: "Académico", icon: BookOpenCheck, colors: "bg-[#f1faf6] text-brand-800" },
  financiero: { label: "Financiero", icon: HandCoins, colors: "bg-[#fff8df] text-[#946c00]" },
  documentario: { label: "Documentario", icon: FileText, colors: "bg-[#eff8fd] text-[#176d9f]" },
  servicio: { label: "Servicio", icon: Shapes, colors: "bg-[#f5f3ff] text-[#51489a]" },
};

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button type="button" className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function ConceptRow({ concept, onEdit, onDelete }) {
  const category = CATEGORIES[concept.category] || CATEGORIES.academico; const Icon = category.icon;
  return <article className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[1.15fr_.65fr_1.25fr_.45fr_auto] lg:items-center"><div className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${category.colors}`}><Icon className="h-4 w-4" /></span><strong className="truncate font-sans text-[14px] font-bold text-brand-950">{concept.name}</strong></div><span className={`w-fit rounded-full px-2.5 py-1 text-[8px] font-extrabold ${category.colors}`}>{category.label}</span><p className="m-0 truncate text-[9px] text-muted">{concept.description || "Sin descripción adicional"}</p><span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[8px] font-extrabold ${concept.active ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}><i className={`h-1.5 w-1.5 rounded-full ${concept.active ? "bg-brand-700" : "bg-[#82908b]"}`} />{concept.active ? "Activo" : "Inactivo"}</span><div className="flex items-center gap-1 lg:justify-end"><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${concept.name}`}><Pencil className="h-4 w-4" /></button><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0]" onClick={onDelete} aria-label={`Eliminar ${concept.name}`}><Trash2 className="h-4 w-4" /></button></div></article>;
}

export default function InstitutionalConceptsManagement({ user }) {
  const connected = isSupabaseConfigured && user?.authSource === "supabase";
  const [concepts, setConcepts] = useState([]); const [query, setQuery] = useState(""); const [category, setCategory] = useState("todos");
  const deferredQuery = useDeferredValue(query); const [loading, setLoading] = useState(connected); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connected ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase."); const [notice, setNotice] = useState(""); const [dialog, setDialog] = useState(null); const timer = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => { if (!connected) return; if (!quiet) setLoading(true); try { setConcepts(await loadInstitutionalConcepts()); setError(""); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }, [connected]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => connected ? subscribeToInstitutionalConcepts(() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => refresh({ quiet: true }), 180); }) : undefined, [connected, refresh]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const filtered = useMemo(() => { const normalized = deferredQuery.trim().toLocaleLowerCase("es-PE"); return concepts.filter((concept) => (category === "todos" || concept.category === category) && (!normalized || `${concept.name} ${concept.description}`.toLocaleLowerCase("es-PE").includes(normalized))); }, [concepts, category, deferredQuery]);
  const counts = useMemo(() => concepts.reduce((result, concept) => ({ ...result, [concept.category]: (result[concept.category] || 0) + 1 }), {}), [concepts]);

  async function save(values) { setBusy(true); setError(""); setNotice(""); try { await saveInstitutionalConcept(values); setDialog(null); setNotice(values.id ? "Concepto actualizado." : "Concepto institucional creado."); await refresh({ quiet: true }); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); } }
  async function remove(concept) { if (!window.confirm(`¿Eliminar el concepto “${concept.name}”?`)) return; setBusy(true); setError(""); setNotice(""); try { await deleteInstitutionalConcept(concept.id); setNotice("Concepto eliminado."); await refresh({ quiet: true }); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); } }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Conceptos institucionales" description="Organiza las denominaciones que utilizarán los procesos del colegio" action={<button type="button" className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f]" onClick={() => setDialog({ concept: null })}><Plus className="h-4 w-4" /><span>Nuevo concepto</span></button>} />
    {error ? <Notice onRetry={connected ? () => refresh() : undefined}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}

    <section className="mb-4 grid gap-3 rounded-[9px] border border-line-strong bg-white p-4 shadow-[0_8px_24px_rgba(7,54,42,0.04)] lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex min-h-10 items-center gap-2 rounded-[6px] border border-line-strong px-3 focus-within:border-[#237db3]"><Search className="h-4 w-4 text-muted" /><input className="min-w-0 flex-1 border-0 bg-transparent text-[10px] font-semibold outline-none" placeholder="Buscar un concepto" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0"><button type="button" className={`shrink-0 rounded-[5px] px-3 py-2 text-[9px] font-extrabold ${category === "todos" ? "bg-brand-800 text-white" : "bg-[#f3f6f5] text-[#52615c]"}`} onClick={() => setCategory("todos")}>Todos · {concepts.length}</button>{Object.entries(CATEGORIES).map(([id, item]) => <button key={id} type="button" className={`shrink-0 rounded-[5px] px-3 py-2 text-[9px] font-extrabold ${category === id ? item.colors : "bg-[#f3f6f5] text-[#52615c]"}`} onClick={() => setCategory(id)}>{item.label} · {counts[id] || 0}</button>)}</div></section>

    <section className="overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]"><header className="flex min-h-[58px] items-center justify-between border-b border-line px-4 sm:px-5"><div><h2 className="m-0 font-sans text-[14px] font-bold text-brand-950">Catálogo vigente</h2><p className="mb-0 mt-1 text-[8px] text-muted">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</p></div>{loading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand-800" /> : null}</header>
      {loading ? <div className="grid min-h-[280px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Consultando Supabase…</div> : filtered.length ? <><div className="hidden grid-cols-[1.15fr_.65fr_1.25fr_.45fr_auto] gap-3 border-b border-line bg-[#f8faf9] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted lg:grid"><span>Concepto</span><span>Categoría</span><span>Descripción</span><span>Estado</span><span>Acciones</span></div>{filtered.map((concept) => <ConceptRow key={concept.id} concept={concept} onEdit={() => setDialog({ concept })} onDelete={() => remove(concept)} />)}</> : <div className="grid min-h-[260px] place-content-center justify-items-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><Shapes className="h-5 w-5" /></span><h3 className="mb-1 mt-3 font-sans text-[15px] font-bold text-brand-950">{concepts.length ? "No encontramos coincidencias" : "Aún no hay conceptos institucionales"}</h3><p className="m-0 max-w-[350px] text-[9px] text-muted">{concepts.length ? "Cambia la búsqueda o selecciona otra categoría." : "Usa “Nuevo concepto” para crear el catálogo desde cero."}</p></div>}
    </section>
    {dialog ? <InstitutionalConceptDialog concept={dialog.concept} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
