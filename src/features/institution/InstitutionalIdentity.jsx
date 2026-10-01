import { Check, ChevronDown, CircleAlert, ImagePlus, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  EMPTY_IDENTITY,
  institutionalLogoUrl,
  loadInstitutionalIdentity,
  saveInstitutionalBrand,
  uploadInstitutionalLogo,
} from "./identityApi";

const INPUT_CLASS = "min-h-12 w-full rounded-[5px] border border-line-strong bg-white px-3 text-[12px] font-semibold text-ink outline-none transition focus:border-brand-800 focus:shadow-[0_0_0_3px_rgba(4,120,87,0.10)]";

function ReadOnlyDatum({ label, value }) {
  return <div className="min-w-0 border-b border-line py-3 last:border-b-0"><dt className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</dt><dd className="mb-0 mt-1 break-words text-[10px] font-semibold text-ink">{value || "Sin registrar"}</dd></div>;
}

export default function InstitutionalIdentity({ user, onIdentityChange }) {
  const remote = isSupabaseConfigured && user?.authSource === "supabase";
  const [identity, setIdentity] = useState({ ...EMPTY_IDENTITY });
  const [savedName, setSavedName] = useState(EMPTY_IDENTITY.displayName);
  const [displayName, setDisplayName] = useState(EMPTY_IDENTITY.displayName);
  const [logoFile, setLogoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(remote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(remote ? "" : "Inicia sesión con una cuenta de Dirección conectada a Supabase.");
  const [notice, setNotice] = useState("");
  const dirty = Boolean(logoFile) || displayName.trim() !== savedName;
  const logoUrl = useMemo(() => previewUrl || institutionalLogoUrl(identity.logoPath, identity.updatedAt), [identity.logoPath, identity.updatedAt, previewUrl]);

  const refresh = useCallback(async () => {
    if (!remote) return;
    setLoading(true); setError("");
    try {
      const values = await loadInstitutionalIdentity();
      setIdentity(values); setDisplayName(values.displayName); setSavedName(values.displayName); setLogoFile(null);
    } catch (failure) {
      setError(failure.message || "No se pudo cargar la identidad institucional.");
    } finally { setLoading(false); }
  }, [remote]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    if (!dirty) return undefined;
    const protect = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  function chooseLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("El logo debe ser PNG, JPG o WEBP.");
    if (file.size > 2 * 1024 * 1024) return setError("El logo no debe superar los 2 MB.");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setLogoFile(file); setPreviewUrl(URL.createObjectURL(file)); setError(""); setNotice("");
  }

  async function save(event) {
    event.preventDefault();
    if (!remote || saving) return;
    const cleanName = displayName.trim();
    if (!cleanName) return setError("Escribe el nombre visible del colegio.");
    setSaving(true); setError(""); setNotice("");
    try {
      const logoPath = logoFile ? await uploadInstitutionalLogo(logoFile) : identity.logoPath;
      const brand = await saveInstitutionalBrand({ displayName: cleanName, logoPath });
      setIdentity((current) => ({ ...current, displayName: brand.displayName, logoPath: brand.logoPath, updatedAt: brand.updatedAt }));
      setDisplayName(brand.displayName); setSavedName(brand.displayName); setLogoFile(null); setPreviewUrl("");
      onIdentityChange?.(brand);
      setNotice("La marca se actualizó en el portal.");
    } catch (failure) {
      setError(failure.message || "No se pudieron guardar los cambios.");
    } finally { setSaving(false); }
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(""); setLogoFile(null); setDisplayName(savedName); setError(""); setNotice("");
  }

  return (
    <section className="mx-auto max-w-[1100px] pb-14 text-ink" aria-busy={loading}>
      <PageHeading standard
        title="Identidad institucional"
        description="Actualiza únicamente el nombre visible y el logo del colegio"
      />

      {error ? <div className="mb-4 flex items-start gap-2 rounded-[6px] border border-[#efb0ad] bg-red-soft p-3 text-[10px] text-[#8f2020]" role="alert"><CircleAlert className="h-4 w-4 flex-none" /><span className="flex-1">{error}</span>{remote ? <button className="font-extrabold underline" onClick={refresh}>Reintentar</button> : null}</div> : null}
      {notice ? <div className="mb-4 flex items-center gap-2 rounded-[6px] border border-[#a9cbbf] bg-brand-50 p-3 text-[10px] font-bold text-brand-900" role="status"><Check className="h-4 w-4" />{notice}</div> : null}

      {loading ? (
        <div className="grid min-h-[330px] place-content-center justify-items-center gap-3 rounded-[9px] border border-line-strong bg-white text-muted"><LoaderCircle className="h-7 w-7 animate-spin text-brand-800" /><span className="text-[10px]">Cargando…</span></div>
      ) : (
        <form onSubmit={save} className="grid gap-4">
          <section className="overflow-hidden rounded-[10px] border border-line-strong bg-white shadow-[0_12px_35px_rgba(7,54,42,0.06)]">
            <div className="h-1.5 bg-[linear-gradient(90deg,#064e3b_0_56%,#f3bd24_56%_78%,#237db3_78%)]" />
            <div className="grid gap-7 p-5 sm:p-7 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
              <label className="group mx-auto grid h-[160px] w-[160px] cursor-pointer place-items-center overflow-hidden rounded-[10px] border border-dashed border-[#9db4ac] bg-[#f8faf9] text-center hover:border-brand-800 hover:bg-brand-50 md:mx-0">
                {logoUrl ? <img className="h-full w-full object-contain p-3" src={logoUrl} alt="Logo institucional" /> : <span className="grid justify-items-center gap-2 text-[10px] font-bold text-muted"><ImagePlus className="h-7 w-7 text-brand-800" />Seleccionar logo<small className="font-normal">PNG, JPG o WEBP · 2 MB</small></span>}
                <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} />
              </label>

              <div className="min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#176d9f]">Marca visible</span>
                <h2 className="mb-1 mt-2 break-words font-sans text-[24px] font-extrabold tracking-[-0.04em] text-brand-950">{displayName.trim() || "Nombre del colegio"}</h2>
                <p className="mb-5 mt-0 text-[10px] leading-relaxed text-muted">Este nombre y logo aparecerán en el acceso, encabezado y menú del ERP. La landing los mostrará al volver a cargar.</p>
                <label className="grid max-w-[560px] gap-1.5"><span className="text-[9px] font-bold text-[#52615c]">Nombre visible del colegio</span><input autoComplete="organization" maxLength="120" required className={INPUT_CLASS} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setNotice(""); }} /></label>
                <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!dirty || saving} className="min-h-10 rounded-[5px] px-4 text-[9px] font-bold text-[#176d9f] hover:bg-[#edf7fc] disabled:opacity-40" onClick={discard}>Descartar</button><button type="submit" disabled={!remote || !dirty || saving} className="inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-[#237db3] px-5 text-[9px] font-extrabold text-white hover:bg-[#176d9f] disabled:opacity-45">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Guardando…" : "Guardar cambios"}</button></div>
              </div>
            </div>
          </section>

          <details className="group overflow-hidden rounded-[8px] border border-line-strong bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 marker:content-none"><span className="grid h-9 w-9 place-items-center rounded-[6px] bg-brand-50 text-brand-800"><ShieldCheck className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-[11px] text-brand-950">Datos legales y administrativos</strong><small className="text-[9px] text-muted">Consulta protegida · no se modifican desde esta pantalla</small></span><ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" /></summary>
            <div className="grid border-t border-line px-5 pb-3 sm:grid-cols-2 sm:gap-x-8">
              <dl className="m-0"><ReadOnlyDatum label="Razón social" value={identity.officialName} /><ReadOnlyDatum label="RUC" value={identity.ruc} /><ReadOnlyDatum label="Código modular" value={identity.modularCode} /><ReadOnlyDatum label="Código de local" value={identity.localCode} /></dl>
              <dl className="m-0"><ReadOnlyDatum label="UGEL" value={identity.ugel} /><ReadOnlyDatum label="Dirección" value={identity.address} /><ReadOnlyDatum label="Correo institucional" value={identity.email} /><ReadOnlyDatum label="Teléfono" value={identity.phone} /></dl>
            </div>
          </details>
        </form>
      )}
    </section>
  );
}
