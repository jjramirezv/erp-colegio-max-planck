import { CheckCircle2, CircleAlert, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRoundCheck, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeading from "../../components/PageHeading";
import UserDialog from "./UserDialog";
import { createPortalUser, deletePortalUser, loadPortalUsers, updatePortalUser } from "./usersApi";

const ROLE_LABELS = { direccion: "Alta Dirección", coordinador_academico: "Coordinación académica", administrativo: "Área administrativa", docente: "Docente", familia: "Padre / Madre" };
const SELECT = "min-h-10 rounded-[6px] border border-line-strong bg-white px-3 text-[10px] font-bold text-ink outline-none focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.10)]";

function Notice({ children, tone = "error", onRetry }) {
  const success = tone === "success";
  return <div className={`mb-4 flex items-center gap-3 rounded-[7px] border px-4 py-3 text-[10px] ${success ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-900" : "border-[#efb0ad] bg-[#fff6f5] text-[#8f2924]"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="flex-1 font-semibold">{children}</span>{onRetry ? <button className="inline-flex items-center gap-1 font-extrabold" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Reintentar</button> : null}</div>;
}

function initials(name = "") { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—"; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)).replaceAll(".", "") : "Nunca"; }

function UserRow({ user, currentUserId, onEdit, onDelete }) {
  const isCurrent = user.id === currentUserId;
  return <article className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[1.35fr_.8fr_.65fr_.65fr_auto] lg:items-center">
    <div className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[9px] font-extrabold ${isCurrent ? "bg-brand-800 text-white" : "bg-[#eff8fd] text-[#176d9f]"}`}>{initials(user.name)}</span><div className="min-w-0"><strong className="block truncate font-sans text-[14px] font-bold text-brand-950">{user.name}{isCurrent ? <small className="ml-2 text-[8px] font-extrabold text-[#07845f]">Tu cuenta</small> : null}</strong><span className="block truncate text-[8px] text-muted">{user.email}</span></div></div>
    <span className="text-[9px] font-bold text-[#42524c]">{ROLE_LABELS[user.role] || user.role}</span>
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${user.active ? "border-[#a9d6c5] bg-[#f1faf6] text-brand-800" : "border-[#d6dfdc] bg-[#f3f6f5] text-[#66736f]"}`}><i className={`h-1.5 w-1.5 rounded-full ${user.active ? "bg-brand-700" : "bg-[#82908b]"}`} />{user.active ? "Activo" : "Inactivo"}</span>
    <span className="text-[8px] text-muted"><strong className="block text-[8px] text-[#42524c]">Último ingreso</strong>{formatDate(user.lastSignInAt)}</span>
    <div className="flex items-center gap-1 lg:justify-end"><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#237db3] hover:bg-[#eff8fd]" onClick={onEdit} aria-label={`Editar ${user.name}`}><Pencil className="h-4 w-4" /></button><button type="button" disabled={isCurrent} className="grid h-9 w-9 place-items-center rounded-full text-[#a32d28] hover:bg-[#fff1f0] disabled:cursor-not-allowed disabled:opacity-25" onClick={onDelete} aria-label={`Eliminar ${user.name}`} title={isCurrent ? "No puedes eliminar tu propia cuenta" : "Eliminar credencial"}><Trash2 className="h-4 w-4" /></button></div>
  </article>;
}

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]); const [query, setQuery] = useState(""); const [role, setRole] = useState("todos");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [dialog, setDialog] = useState(null);
  const refresh = useCallback(async () => { setLoading(true); try { setUsers(await loadPortalUsers()); setError(""); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
  const filtered = useMemo(() => users.filter((user) => (role === "todos" || user.role === role) && (!normalizedQuery || `${user.name} ${user.email} ${ROLE_LABELS[user.role] || ""}`.toLocaleLowerCase("es-PE").includes(normalizedQuery))), [users, role, normalizedQuery]);
  const activeCount = users.filter((user) => user.active).length;

  async function save(values) {
    setBusy(true); setError(""); setNotice("");
    try { values.userId ? await updatePortalUser(values) : await createPortalUser(values); setDialog(null); setNotice(values.userId ? "Usuario actualizado correctamente." : "Credencial creada y habilitada en el portal."); await refresh(); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }
  async function remove(user) {
    if (!window.confirm(`¿Eliminar permanentemente el acceso de ${user.name}? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await deletePortalUser(user); setNotice("La credencial fue eliminada."); await refresh(); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-[1240px] pb-14 text-ink" aria-busy={loading || busy}>
    <PageHeading standard title="Usuarios y accesos" description="Credenciales del personal y las familias. Los estudiantes se gestionan en Accesos de estudiantes" action={<button type="button" className="inline-flex min-h-[42px] items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 shadow-[0_7px_18px_rgba(139,101,0,0.13)] hover:bg-[#ffd34f]" onClick={() => setDialog({ user: null })}><Plus className="h-4 w-4" /><span>Nuevo usuario</span></button>} />
    {error ? <Notice onRetry={refresh}>{error}</Notice> : null}{notice ? <Notice tone="success">{notice}</Notice> : null}
    <section className="mb-4 grid overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_8px_24px_rgba(7,54,42,0.04)] sm:grid-cols-3">
      <div className="flex items-center gap-3 border-b border-line p-4 sm:border-b-0 sm:border-r"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-800"><UsersRound className="h-4 w-4" /></span><div><strong className="block font-sans text-[18px] text-brand-950">{users.length}</strong><small className="text-[8px] text-muted">Usuarios registrados</small></div></div>
      <div className="flex items-center gap-3 border-b border-line p-4 sm:border-b-0 sm:border-r"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff8df] text-[#a47700]"><UserRoundCheck className="h-4 w-4" /></span><div><strong className="block font-sans text-[18px] text-brand-950">{activeCount}</strong><small className="text-[8px] text-muted">Accesos activos</small></div></div>
      <div className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff8fd] text-[#237db3]"><ShieldCheck className="h-4 w-4" /></span><div><strong className="block font-sans text-[13px] text-brand-950">Control exclusivo</strong><small className="text-[8px] text-muted">Solo Alta Dirección</small></div></div>
    </section>
    <section className="overflow-hidden rounded-[9px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.05)]">
      <header className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_220px] sm:px-5"><label className="flex min-h-10 items-center gap-2 rounded-[6px] border border-line-strong bg-white px-3 focus-within:border-[#237db3]"><Search className="h-4 w-4 text-muted" /><input className="min-w-0 flex-1 border-0 bg-transparent text-[10px] font-semibold outline-none" placeholder="Buscar por nombre, correo o rol" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select className={SELECT} value={role} onChange={(event) => setRole(event.target.value)}><option value="todos">Todos los roles</option>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></header>
      <div className="hidden grid-cols-[1.35fr_.8fr_.65fr_.65fr_auto] gap-3 bg-[#f7faf9] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.07em] text-muted lg:grid"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Actividad</span><span>Acciones</span></div>
      {loading ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-3 text-[10px] text-muted"><LoaderCircle className="h-6 w-6 animate-spin text-[#237db3]" />Consultando credenciales…</div> : filtered.length ? filtered.map((user) => <UserRow key={user.id} user={user} currentUserId={currentUser?.id} onEdit={() => setDialog({ user })} onDelete={() => remove(user)} />) : <div className="grid min-h-[240px] place-content-center justify-items-center px-5 text-center"><KeyRound className="h-8 w-8 text-[#237db3]" /><h3 className="mb-1 mt-3 font-sans text-[15px] text-brand-950">{users.length ? "No encontramos coincidencias" : "Aún no hay usuarios"}</h3><p className="m-0 text-[9px] text-muted">{users.length ? "Prueba otro nombre, correo o rol." : "Crea la primera credencial desde “Nuevo usuario”."}</p></div>}
    </section>
    {dialog ? <UserDialog user={dialog.user} currentUserId={currentUser?.id} busy={busy} requestError={error} onClose={() => { if (!busy) setDialog(null); }} onSave={save} /> : null}
  </section>;
}
