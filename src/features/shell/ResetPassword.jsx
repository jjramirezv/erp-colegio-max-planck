import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import Brand from "./Brand";
import { updatePortalPassword } from "../../lib/portalAuth";

// Pantalla a la que llega el enlace del correo "recuperar contraseña".
export default function ResetPassword({ identity, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError("");
    if (password.length < 8) return setError("Usa al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try { await updatePortalPassword(password); onDone("Contraseña actualizada. Ingresa con tu nueva contraseña."); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const input = "h-12 w-full border border-[#cad8d3] bg-white px-[13px] pr-11 text-ink";
  return <div className="grid min-h-screen place-items-center bg-surface p-6">
    <form className="w-full max-w-[430px]" onSubmit={submit}>
      <div className="mb-10"><Brand identity={identity} /></div>
      <span className="mb-6 grid h-[50px] w-[50px] place-items-center bg-brand-100 text-brand-900"><KeyRound size={24} /></span>
      <h1 className="m-0 text-3xl font-extrabold leading-tight tracking-[-0.045em] text-[#14231e]">Crear nueva contraseña</h1>
      <p className="mb-8 mt-2 text-sm leading-6 text-[#66766f]">Escribe tu nueva contraseña dos veces. Luego ingresarás con ella.</p>
      <label className="my-4 grid gap-2 text-xs font-bold text-[#33423d]">Nueva contraseña
        <span className="relative"><input className={input} type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus />
          <button type="button" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted" onClick={() => setShow((current) => !current)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
      </label>
      <label className="my-4 grid gap-2 text-xs font-bold text-[#33423d]">Repite la contraseña<input className={input} type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
      {error ? <div role="alert" className="bg-red-soft p-3 text-xs text-red">{error}</div> : null}
      <button type="submit" disabled={busy} className="mt-3 flex h-[50px] w-full items-center justify-center border-0 bg-brand-900 font-bold text-white hover:bg-[#07664e] disabled:opacity-60">{busy ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  </div>;
}
