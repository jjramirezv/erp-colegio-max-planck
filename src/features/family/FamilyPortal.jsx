import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { EnrollmentView } from "../student/StudentPortal";
import { BUTTON, CARD, Empty } from "../student/portal/ui";
import { loadFamilyPortal } from "./familyApi";

const RELATION = { madre: "Madre", padre: "Padre", apoderado: "Apoderado(a)", otro: "Familiar" };
const STORAGE_KEY = "mp-family-child";
const firstName = (name = "") => name.split(/\s+/)[0] || name;
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
function rememberedChild() { try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; } }

// Portal de familia: mismas vistas del estudiante, con selector de hijo.
export default function FamilyPortal({ user, section, onNavigate }) {
  const [children, setChildren] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [childId, setChildId] = useState(rememberedChild);
  useEffect(() => {
    let active = true;
    setChildren(null); setError("");
    loadFamilyPortal().then((result) => { if (active) setChildren(result); }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [user.id, attempt]);
  const child = children?.find((item) => item.id === childId) || children?.[0];
  function select(id) { setChildId(id); try { localStorage.setItem(STORAGE_KEY, id); } catch { /* preferencia opcional */ } }

  return <div className="mx-auto max-w-[1240px] space-y-5 pb-10">
    {error ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]">{error}<button className={BUTTON} onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div>
      : !children ? <p role="status" className="text-[13px] text-muted">Cargando la información de tus hijos…</p>
      : !children.length ? <Empty icon={Users} title="Aún no hay estudiantes vinculados">Tu cuenta todavía no está vinculada a ningún estudiante. Comunícate con la secretaría del colegio indicando tu DNI y el de tu hijo(a).</Empty>
      : <>
        {children.length > 1 ? <nav aria-label="Mis hijos" className="flex flex-wrap gap-2">{children.map((item) => { const active = item.id === child.id; const classroom = item.enrollments[0]?.classroom; return <button key={item.id} type="button" aria-pressed={active} onClick={() => select(item.id)} className={`${CARD} flex min-w-[220px] items-center gap-3 px-4 py-3 text-left transition hover:border-brand-800 ${active ? "!border-brand-900 ring-2 ring-brand-900" : ""}`}>
          <span className={`grid h-10 w-10 flex-none place-items-center rounded-full text-[13px] font-black ${active ? "bg-brand-900 text-white" : "bg-brand-100 text-brand-900"}`}>{initials(item.name)}</span>
          <span className="min-w-0"><strong className="block truncate text-[14px] text-brand-950">{item.name}</strong><small className="block truncate text-[12px] text-muted">{classroom || "Sin matrícula"}</small></span>
        </button>; })}</nav> : <p className="m-0 flex items-center gap-2 text-[13px] text-muted"><Users size={15} />{RELATION[child.relation] || "Familia"} de <strong className="text-brand-900">{child.name}</strong></p>}
        <EnrollmentView key={child.id} user={user} data={child.enrollments} section={section} onNavigate={onNavigate} child={firstName(child.name)} />
      </>}
  </div>;
}
