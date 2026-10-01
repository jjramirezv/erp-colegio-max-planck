import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { roles } from "../../data";
import PageHeading from "../../components/PageHeading";
import { compatiblePermissions, institutionalSeed } from "./data/seed";

export default function InstitutionalSettings({ permissions, onPermissionsChange }) {
  const [tab, setTab] = useState("Identidad");
  const [settings, setSettings] = useState(() => { try { return JSON.parse(localStorage.getItem("mp-institution-settings-v1")) || institutionalSeed; } catch { return institutionalSeed; } });
  const [draftPermissions, setDraftPermissions] = useState(permissions);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const tabs = ["Identidad", "Estructura académica", "Evaluación y horarios", "Documentos", "Roles y permisos", "Sistema y respaldos"];
  const modules = [...new Set(Object.values(compatiblePermissions).flat())];
  function setGroup(group, key, value) { setSettings((current) => ({ ...current, [group]: { ...current[group], [key]: value } })); setSaved(false); }
  async function save() { setSaving(true); setSaved(false); setSaveError(""); try { await onPermissionsChange?.(draftPermissions); localStorage.setItem("mp-institution-settings-v1", JSON.stringify(settings)); setSaved(true); } catch (error) { setSaveError(error.message || "No se pudo guardar la configuración."); } finally { setSaving(false); } }
  function toggleLevel(index) { setSettings((current) => ({ ...current, levels: current.levels.map((level, itemIndex) => (itemIndex === index ? { ...level, active: !level.active } : level)) })); setSaved(false); }
  function updateDocument(index, key, value) { setSettings((current) => ({ ...current, documents: current.documents.map((document, itemIndex) => (itemIndex === index ? { ...document, [key]: value } : document)) })); setSaved(false); }
  function togglePermission(role, module) { const current = draftPermissions[role] || []; const next = current.includes(module) ? current.filter((item) => item !== module) : [...current, module]; setDraftPermissions({ ...draftPermissions, [role]: next }); setSaved(false); }

  const fieldLabel = "grid gap-[7px] text-[9px] font-bold text-[#31443d]";
  const fieldInput = "h-[42px] w-full border border-line bg-white px-[11px] font-[inherit] text-[#14251f]";

  return (
    <>
      <PageHeading
        title="Configuración institucional"
        description="Identidad, estructura académica, periodos y permisos del portal"
        action={
          <button className="flex h-[42px] items-center justify-center gap-2 border-0 bg-brand-900 px-[18px] text-sm font-bold text-white hover:bg-[#07664e] max-md:w-[42px] max-md:px-0" onClick={save} disabled={saving}>
            <CheckCircle2 size={17} /><span className="max-md:hidden">{saving ? "Guardando…" : "Guardar configuración"}</span>
          </button>
        }
      />
      {saved && <div className="-mt-[5px] mb-[14px] flex items-center gap-2 border border-[#a9d8b8] bg-[#eef9f2] px-[13px] py-[10px] text-[10px] text-[#176b38]"><CheckCircle2 className="w-4" />Configuración guardada correctamente.</div>}
      {saveError && <div className="-mt-[5px] mb-[14px] flex items-center gap-2 border border-[#e0aaa5] bg-[#fff2f0] px-[13px] py-[10px] text-[10px] text-[#9c312c]"><X className="w-4" />{saveError}</div>}
      <nav className="mb-[15px] flex max-w-[1180px] overflow-auto border-b border-line">
        {tabs.map((item) => (
          <button key={item} className={`flex-none border-0 border-b-[3px] border-transparent bg-transparent px-[17px] py-3 text-[10px] font-bold text-muted ${tab === item ? "border-brand-900 text-brand-900" : ""}`} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>

      {tab === "Identidad" && (
        <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-white">
          <header className="border-b border-line p-[17px] md:px-5">
            <h2 className="m-0 mb-1 font-display text-[15px] font-bold text-brand-900">Datos generales e identidad</h2>
            <p className="m-0 text-[9px] text-muted">Información oficial utilizada en documentos y comunicaciones.</p>
          </header>
          <div className="grid grid-cols-1 gap-x-[18px] gap-y-[15px] p-4 md:grid-cols-2 md:p-5">
            <label className={`md:col-span-2 ${fieldLabel}`}>Razón social / nombre institucional<input className={fieldInput} value={settings.identity.name} onChange={(event) => setGroup("identity", "name", event.target.value)} /></label>
            <label className={fieldLabel}>Nombre corto<input className={fieldInput} value={settings.identity.shortName} onChange={(event) => setGroup("identity", "shortName", event.target.value)} /></label>
            <label className={fieldLabel}>Código modular<input className={fieldInput} value={settings.identity.modularCode} onChange={(event) => setGroup("identity", "modularCode", event.target.value)} /></label>
            <label className={fieldLabel}>RUC<input className={fieldInput} value={settings.identity.ruc} onChange={(event) => setGroup("identity", "ruc", event.target.value)} /></label>
            <label className={fieldLabel}>Teléfono<input className={fieldInput} value={settings.identity.phone} onChange={(event) => setGroup("identity", "phone", event.target.value)} /></label>
            <label className={`md:col-span-2 ${fieldLabel}`}>Dirección<input className={fieldInput} value={settings.identity.address} onChange={(event) => setGroup("identity", "address", event.target.value)} /></label>
            <label className={`md:col-span-2 ${fieldLabel}`}>Correo institucional<input className={fieldInput} type="email" value={settings.identity.email} onChange={(event) => setGroup("identity", "email", event.target.value)} /></label>
          </div>
        </section>
      )}

      {tab === "Estructura académica" && (
        <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-white">
          <header className="border-b border-line p-[17px] md:px-5">
            <h2 className="m-0 mb-1 font-display text-[15px] font-bold text-brand-900">Niveles, grados y secciones</h2>
            <p className="m-0 text-[9px] text-muted">Estructura vigente para inicial, primaria y secundaria.</p>
          </header>
          <div className="px-[15px] pt-[6px] md:px-5">
            {settings.levels.map((level, index) => (
              <article key={level.name} className="grid grid-cols-[38px_1fr] items-center gap-3 border-b border-line py-[13px] md:grid-cols-[42px_minmax(180px,1fr)_130px]">
                <button aria-label={`${level.active ? "Desactivar" : "Activar"} ${level.name}`} className={`h-[19px] w-[34px] cursor-pointer rounded-[20px] border-0 p-[2px] ${level.active ? "bg-brand-900" : "bg-[#cbd5d1]"}`} onClick={() => toggleLevel(index)}>
                  <i className={`block h-[15px] w-[15px] rounded-full bg-white transition-transform duration-[180ms] ${level.active ? "translate-x-[15px]" : ""}`} />
                </button>
                <div className="grid gap-[3px] md:col-start-2">
                  <strong className="text-[10px]">{level.name}</strong>
                  <span className="text-[8px] text-muted">{level.grades}</span>
                </div>
                <label className="grid grid-cols-[auto_60px] items-center gap-2 text-[8px] text-muted md:col-start-3">
                  Secciones
                  <input className="h-[34px] border border-line px-2" type="number" min="0" value={level.sections} onChange={(event) => setSettings((current) => ({ ...current, levels: current.levels.map((item, itemIndex) => (itemIndex === index ? { ...item, sections: Number(event.target.value) } : item)) }))} />
                </label>
              </article>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-x-[18px] gap-y-[15px] border-t border-line p-4 md:grid-cols-2 md:p-5">
            <label className={fieldLabel}>Año lectivo<input className={fieldInput} value={settings.academic.year} onChange={(event) => setGroup("academic", "year", event.target.value)} /></label>
            <label className={fieldLabel}>Sistema de periodos<select className={fieldInput} value={settings.academic.period} onChange={(event) => setGroup("academic", "period", event.target.value)}><option>Bimestres</option><option>Trimestres</option><option>Semestres</option></select></label>
            <label className={fieldLabel}>Inicio de clases<input className={fieldInput} type="date" value={settings.academic.start} onChange={(event) => setGroup("academic", "start", event.target.value)} /></label>
            <label className={fieldLabel}>Fin de clases<input className={fieldInput} type="date" value={settings.academic.end} onChange={(event) => setGroup("academic", "end", event.target.value)} /></label>
          </div>
        </section>
      )}

      {tab === "Evaluación y horarios" && (
        <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-white">
          <header className="border-b border-line p-[17px] md:px-5">
            <h2 className="m-0 mb-1 font-display text-[15px] font-bold text-brand-900">Evaluación, áreas y jornadas</h2>
            <p className="m-0 text-[9px] text-muted">Parámetros académicos base para notas y horarios.</p>
          </header>
          <div className="grid grid-cols-1 gap-x-[18px] gap-y-[15px] p-4 md:grid-cols-2 md:p-5">
            <label className={fieldLabel}>Periodo actual<input className={fieldInput} value={settings.academic.currentPeriod} onChange={(event) => setGroup("academic", "currentPeriod", event.target.value)} /></label>
            <label className={fieldLabel}>Escala de calificación<select className={fieldInput} value={settings.academic.scale} onChange={(event) => setGroup("academic", "scale", event.target.value)}><option>0 a 20</option><option>AD, A, B, C</option></select></label>
            <label className={fieldLabel}>Nota mínima aprobatoria<input className={fieldInput} type="number" min="0" max="20" value={settings.academic.passing} onChange={(event) => setGroup("academic", "passing", event.target.value)} /></label>
            <label className={fieldLabel}>Jornada mañana<input className={fieldInput} value={settings.academic.morning} onChange={(event) => setGroup("academic", "morning", event.target.value)} /></label>
            <label className={fieldLabel}>Jornada tarde<input className={fieldInput} value={settings.academic.afternoon} onChange={(event) => setGroup("academic", "afternoon", event.target.value)} /></label>
            <label className={`md:col-span-2 ${fieldLabel}`}>Áreas curriculares<textarea className={`${fieldInput} h-auto resize-y py-[11px] leading-[1.6]`} rows="4" value={settings.areas} onChange={(event) => { setSettings({ ...settings, areas: event.target.value }); setSaved(false); }} /></label>
          </div>
        </section>
      )}

      {tab === "Documentos" && (
        <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-white">
          <header className="border-b border-line p-[17px] md:px-5">
            <h2 className="m-0 mb-1 font-display text-[15px] font-bold text-brand-900">Documentos y correlativos</h2>
            <p className="m-0 text-[9px] text-muted">Series institucionales para mantener una numeración ordenada.</p>
          </header>
          <div className="overflow-auto px-[14px] pb-4 pt-[10px] md:px-5">
            <div className="grid min-w-[430px] grid-cols-[160px_125px_110px] items-center gap-[14px] p-3 text-[8px] font-bold uppercase text-muted md:min-w-0 md:grid-cols-[minmax(200px,1fr)_180px_150px]">
              <span>Documento</span><span>Serie / prefijo</span><span>Siguiente número</span>
            </div>
            {settings.documents.map((document, index) => (
              <article key={document.name} className="grid min-w-[430px] grid-cols-[160px_125px_110px] items-center gap-[14px] border-t border-line p-3 md:min-w-0 md:grid-cols-[minmax(200px,1fr)_180px_150px]">
                <strong className="text-[9px]">{document.name}</strong>
                <input className="h-9 border border-line px-[9px] text-[9px]" value={document.prefix} onChange={(event) => updateDocument(index, "prefix", event.target.value)} />
                <input className="h-9 border border-line px-[9px] text-[9px]" value={document.next} onChange={(event) => updateDocument(index, "next", event.target.value)} />
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "Roles y permisos" && (
        <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-white">
          <header className="border-b border-line p-[17px] md:px-5">
            <h2 className="m-0 mb-1 font-display text-[15px] font-bold text-brand-900">Acceso por perfil</h2>
            <p className="m-0 text-[9px] text-muted">Activa únicamente módulos compatibles con las responsabilidades de cada usuario.</p>
          </header>
          <div className="overflow-auto">
            <div className="grid min-w-[915px] grid-cols-[minmax(160px,1fr)_repeat(6,125px)] bg-[#f5f8f7] text-brand-900">
              <span className="px-[10px] py-[11px] text-left text-[8px]">Módulo</span>
              {Object.keys(roles).map((role) => <strong key={role} className="px-[10px] py-[11px] text-center text-[8px]">{roles[role]}</strong>)}
            </div>
            {modules.map((module) => (
              <div key={module} className="grid min-w-[915px] grid-cols-[minmax(160px,1fr)_repeat(6,125px)] border-t border-line">
                <span className="px-[14px] py-[11px] text-[9px]">{module}</span>
                {Object.keys(roles).map((role) => {
                  const compatible = compatiblePermissions[role].includes(module);
                  const locked = role === "direccion" && ["Inicio", "Usuarios", "Configuración"].includes(module);
                  return (
                    <label key={role} className={`grid place-items-center border-l border-line ${!compatible ? "bg-[#f8faf9]" : ""}`}>
                      <input className="pointer-events-none absolute opacity-0" type="checkbox" checked={compatible && (draftPermissions[role] || []).includes(module)} disabled={!compatible || locked} onChange={() => togglePermission(role, module)} />
                      <i className={`h-[17px] w-[17px] border ${compatible && (draftPermissions[role] || []).includes(module) ? "border-brand-900 bg-brand-900 shadow-[inset_0_0_0_4px_white]" : !compatible ? "border-[#e3e8e6] bg-[#edf1ef]" : "border-line-strong bg-white"}`} />
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "Sistema y respaldos" && (
        <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-line bg-white">
          <header className="border-b border-line p-[17px] md:px-5">
            <h2 className="m-0 mb-1 font-display text-[15px] font-bold text-brand-900">Parámetros generales y respaldo</h2>
            <p className="m-0 text-[9px] text-muted">Preferencias de operación, seguridad y conservación de información.</p>
          </header>
          <div className="grid grid-cols-1 gap-x-[18px] gap-y-[15px] border-t border-line p-4 md:grid-cols-2 md:p-5">
            <label className={fieldLabel}>Zona horaria<input className={fieldInput} value={settings.system.timezone} onChange={(event) => setGroup("system", "timezone", event.target.value)} /></label>
            <label className={fieldLabel}>Idioma<input className={fieldInput} value={settings.system.language} onChange={(event) => setGroup("system", "language", event.target.value)} /></label>
            <label className={fieldLabel}>Tiempo de sesión<select className={fieldInput} value={settings.system.session} onChange={(event) => setGroup("system", "session", event.target.value)}><option>15 minutos</option><option>30 minutos</option><option>60 minutos</option></select></label>
            <label className={fieldLabel}>Frecuencia de respaldo<select className={fieldInput} value={settings.system.backups} onChange={(event) => setGroup("system", "backups", event.target.value)}><option>Diario · 02:00 a. m.</option><option>Cada 12 horas</option><option>Semanal</option></select></label>
            <label className={fieldLabel}>Retención de datos<input className={fieldInput} value={settings.system.retention} onChange={(event) => setGroup("system", "retention", event.target.value)} /></label>
            <label className={fieldLabel}>Canales de notificación<input className={fieldInput} value={settings.system.notifications} onChange={(event) => setGroup("system", "notifications", event.target.value)} /></label>
          </div>
          <div className="mx-4 mb-4 grid grid-cols-[28px_1fr] items-center gap-[10px] border border-[#b9d9c5] bg-[#f2faf5] p-[14px] text-brand-900 md:mx-5 md:mb-5 md:grid-cols-[34px_1fr_auto]">
            <CheckCircle2 className="w-[22px]" />
            <div className="grid gap-[3px]">
              <strong className="text-[9px]">Último respaldo verificado</strong>
              <span className="text-[8px] text-muted">20 de agosto de 2026 · 02:00 a. m. · Integridad correcta</span>
            </div>
            <button className="h-[34px] border border-[#8bb39e] bg-white px-3 text-[8px] font-bold text-brand-900 max-md:col-span-2">Ver historial</button>
          </div>
        </section>
      )}
    </>
  );
}
