import { CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Save, UserRoundPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

const INPUT = "min-h-11 w-full rounded-[6px] border border-line-strong bg-white px-3 text-[11px] font-semibold text-ink outline-none transition focus:border-[#237db3] focus:shadow-[0_0_0_3px_rgba(35,125,179,0.12)]";
const ROLE_OPTIONS = [
  ["docente", "Docente"], ["coordinador_academico", "Coordinación académica"], ["administrativo", "Área administrativa"], ["familia", "Padre / Madre"], ["direccion", "Alta Dirección"],
];

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const values = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export default function UserDialog({ user, currentUserId, busy, requestError, onClose, onSave }) {
  const editing = Boolean(user);
  const [values, setValues] = useState({ name: user?.name || "", email: user?.email || "", role: user?.role || "docente", active: user?.active ?? true, password: "" });
  const [validation, setValidation] = useState(""); const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [busy, onClose]);
  function change(key, value) { setValues((current) => ({ ...current, [key]: value })); setValidation(""); }
  function submit(event) {
    event.preventDefault();
    if (values.name.trim().length < 3) return setValidation("Escribe el nombre completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return setValidation("Escribe un correo institucional válido.");
    if ((!editing || values.password) && values.password.length < 10) return setValidation("La contraseña temporal debe tener al menos 10 caracteres.");
    onSave({ ...values, userId: user?.id, name: values.name.trim(), email: values.email.trim().toLowerCase() });
  }
  const protectedSelf = user?.id === currentUserId;
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(2,35,27,0.56)] p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
    <form onSubmit={submit} className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_90px_rgba(1,36,27,0.26)] sm:h-auto sm:max-h-[calc(100vh-40px)] sm:max-w-[680px] sm:rounded-[12px]">
      <div className="grid h-1 shrink-0 grid-cols-[1.8fr_1fr_1fr]"><i className="bg-brand-800" /><i className="bg-[#f3bd24]" /><i className="bg-[#237db3]" /></div>
      <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-5 sm:px-7"><div><h2 id="user-dialog-title" className="m-0 font-sans text-[22px] font-bold text-brand-950">{editing ? "Editar usuario" : "Crear usuario"}</h2><p className="mb-0 mt-1 text-[9px] text-muted">{editing ? "Actualiza su acceso y perfil institucional" : "La credencial quedará disponible inmediatamente"}</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full text-brand-900 hover:bg-brand-50" onClick={onClose}><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <section className="mb-5 flex items-center gap-3 rounded-[8px] border border-[#b7d7ea] bg-[#f3f9fc] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#237db3]">{editing ? <KeyRound className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}</span><div><strong className="block text-[10px] text-brand-950">Cuenta protegida por Supabase Auth</strong><span className="text-[9px] text-muted">El correo y la contraseña se administran de forma segura.</span></div></section>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2"><span className="text-[9px] font-extrabold text-[#46554f]">Nombre completo</span><input autoFocus maxLength="120" className={INPUT} value={values.name} onChange={(event) => change("name", event.target.value)} /></label>
          <label className="grid gap-1.5 sm:col-span-2"><span className="text-[9px] font-extrabold text-[#46554f]">Correo institucional</span><input type="email" autoComplete="off" className={INPUT} value={values.email} onChange={(event) => change("email", event.target.value)} /></label>
          <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Rol dentro del portal</span><select disabled={protectedSelf} className={INPUT} value={values.role} onChange={(event) => change("role", event.target.value)}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1.5"><span className="text-[9px] font-extrabold text-[#46554f]">Estado de acceso</span><select disabled={protectedSelf} className={INPUT} value={values.active ? "activo" : "inactivo"} onChange={(event) => change("active", event.target.value === "activo")}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <label className="grid gap-1.5 sm:col-span-2"><span className="text-[9px] font-extrabold text-[#46554f]">{editing ? "Nueva contraseña temporal · opcional" : "Contraseña temporal"}</span><div className="flex gap-2"><div className="relative min-w-0 flex-1"><input type={showPassword ? "text" : "password"} autoComplete="new-password" className={`${INPUT} pr-11`} value={values.password} onChange={(event) => change("password", event.target.value)} /><button type="button" className="absolute right-1 top-1 grid h-9 w-9 place-items-center text-muted" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><button type="button" className="rounded-[5px] border border-[#9cc8df] bg-white px-3 text-[9px] font-extrabold text-[#176d9f] hover:bg-[#eff8fd]" onClick={() => { change("password", generatePassword()); setShowPassword(true); }}>Generar</button></div><small className="text-[8px] text-muted">Mínimo 10 caracteres. Entrégala al usuario por un canal privado.</small></label>
        </div>
        {validation || requestError ? <div className="mt-4 flex gap-2 rounded-[6px] border border-[#efb0ad] bg-[#fff6f5] p-3 text-[9px] font-semibold text-[#8f2924]" role="alert"><CircleAlert className="h-4 w-4 shrink-0" />{validation || requestError}</div> : null}
      </div>
      <footer className="flex min-h-[70px] shrink-0 items-center justify-end gap-2 border-t border-line bg-[#fbfcfb] px-5 sm:px-7"><button type="button" disabled={busy} className="min-h-10 rounded-[5px] border border-line-strong bg-white px-4 text-[10px] font-bold text-brand-900" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-[10px] font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear usuario"}</button></footer>
    </form>
  </div>;
}
