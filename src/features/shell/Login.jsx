import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import Brand from "./Brand";
import { requestPasswordReset } from "../../lib/portalAuth";

const landingUrl = import.meta.env.VITE_LANDING_URL?.trim() || "/";

export default function Login({ onLogin, showDemo, identity, notice = "" }) {
  const [mode, setMode] = useState("login");
  const [sent, setSent] = useState("");
  const [email, setEmail] = useState(showDemo ? "direccion@maxplanck.edu.pe" : "");
  const [password, setPassword] = useState(showDemo ? "Portal2027!" : "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "forgot") { await requestPasswordReset(email.trim()); setSent(email.trim()); }
      else await onLogin({ email: email.trim(), password });
    }
    catch (loginError) { setError(loginError.message || "No se pudo iniciar sesión."); }
    finally { setSubmitting(false); }
  }
  const forgot = mode === "forgot";
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[1.05fr_.95fr]">
      <section className="hidden md:flex flex-col justify-between bg-brand-900 px-[8vw] py-[55px] text-white">
        <a className="text-[13px] text-[#c5ded5] no-underline" href={landingUrl}>← Volver al sitio web</a>
        <Brand inverse large identity={identity} />
        <div>
          <h1 className="m-0 font-sans text-[clamp(42px,5vw,74px)] font-extrabold leading-[1.04] tracking-[-0.06em]">
            Una comunidad,<br />un solo portal.
          </h1>
          <p className="max-w-[490px] leading-[1.8] text-[#c5ded5]">Gestión académica y administrativa para toda la comunidad Max Planck.</p>
        </div>
        <small className="text-[#8db8a9]">Ciencia, ética y humanidad para transformar el mundo.</small>
      </section>
      <section className="grid place-items-center bg-surface p-10 min-h-screen md:min-h-0">
        <form className="w-full max-w-[430px]" onSubmit={submit}>
          <div className="mb-[45px] md:hidden"><Brand identity={identity} /></div>
          <span className="mb-[25px] grid h-[50px] w-[50px] place-items-center bg-brand-100 text-brand-900"><ShieldCheck size={24} /></span>
          <h2 className="m-0 font-sans text-3xl font-extrabold leading-tight tracking-[-0.045em] text-[#14231e] sm:text-4xl">{forgot ? "Recuperar contraseña" : "Ingresar al portal"}</h2>
          <p className="mb-[34px] mt-2 text-sm leading-6 text-[#66766f] sm:text-base">{forgot ? "Te enviaremos un enlace a tu correo para crear una nueva contraseña." : "Utiliza las credenciales asignadas por la institución."}</p>
          {notice && !forgot ? <div role="status" className="mb-4 bg-brand-100 p-3 text-xs font-bold text-brand-900">{notice}</div> : null}
          <label className="my-[17px] grid gap-2 text-xs font-bold text-[#33423d]">
            Correo institucional
            <input className="h-12 border border-[#cad8d3] bg-white px-[13px] text-ink" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          {forgot ? null : <label className="my-[17px] grid gap-2 text-xs font-bold text-[#33423d]">
            Contraseña
            <input className="h-12 border border-[#cad8d3] bg-white px-[13px] text-ink" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>}
          {forgot && sent ? <div role="status" className="bg-brand-100 p-3 text-xs leading-5 text-brand-900">Si <strong>{sent}</strong> está registrado, te enviamos un enlace. Revisa tu bandeja de entrada y la carpeta de spam.</div> : null}
          {forgot ? <p className="text-[11px] leading-5 text-muted">Estudiantes y familias: tu correo de acceso no es un buzón real. Pide en secretaría que restablezcan tu clave.</p> : null}
          {error && <div className="bg-red-soft p-3 text-xs text-red">{error}</div>}
          <button
            className="mt-2 flex h-[50px] w-full items-center justify-center gap-2 border-0 bg-brand-900 font-bold text-white hover:bg-[#07664e] disabled:cursor-wait disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (forgot ? "Enviando…" : "Verificando…") : forgot ? "Enviar enlace" : "Ingresar de forma segura"}
          </button>
          {!showDemo ? <button type="button" className="mt-4 w-full border-0 bg-transparent text-center text-xs font-bold text-brand-800 hover:underline" onClick={() => { setMode(forgot ? "login" : "forgot"); setError(""); setSent(""); }}>{forgot ? "← Volver a ingresar" : "¿Olvidaste tu contraseña?"}</button> : null}
          {showDemo ? (
            <div className="mt-[25px] grid gap-[7px] bg-[#f3f8f6] p-4 text-[11px] text-muted">
              <strong className="text-brand-900">Acceso local</strong>
              <span>Alta Dirección · direccion@maxplanck.edu.pe</span>
              <span>Contraseña · Portal2027!</span>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
