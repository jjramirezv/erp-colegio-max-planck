import { LoaderCircle, Upload } from "lucide-react";
import { useState } from "react";
import { Dialog } from "./Dialog";

const FIELD_LABEL_CLASS = "text-[10px] font-bold text-[#34413c]";
const FIELD_INPUT_CLASS =
  "h-[43px] w-full min-w-0 rounded border border-line-strong bg-white px-[11px] text-[12px] text-ink placeholder:text-[#949d99]";
const BUTTON_CLASS =
  "inline-flex min-h-[42px] min-w-[125px] items-center justify-center gap-2 rounded-[5px] border border-brand-800 bg-surface px-[15px] text-[12px] font-bold leading-none text-brand-900 transition-colors enabled:hover:bg-brand-50 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30";

export function VersionDialog({ material, busy, onClose, onSubmit }) {
  const currentVersion = Number.parseFloat(material.version || "1");
  const suggestedVersion = Number.isFinite(currentVersion) ? (currentVersion + 0.1).toFixed(1) : "1.1";
  const [version, setVersion] = useState(suggestedVersion);
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState(null);

  function submit(event) {
    event.preventDefault();
    onSubmit({ version, summary, file });
  }

  return (
    <Dialog title="Subir nueva versión" description={`Actualiza "${material.title}" sin perder el historial anterior.`} onClose={onClose}>
      <form className="grid gap-[15px] px-[18px] pt-[17px] md:px-5 md:pt-[19px]" onSubmit={submit}>
        <label className="grid gap-[7px]">
          <span className={FIELD_LABEL_CLASS}>Número de versión</span>
          <input
            required
            className={FIELD_INPUT_CLASS}
            value={version}
            pattern="[0-9]+([.][0-9]+){0,2}"
            title="Usa 1, 1.2 o 1.2.3"
            onChange={(event) => setVersion(event.target.value)}
            placeholder="2.2"
          />
        </label>
        <label className="grid gap-[7px]">
          <span className={FIELD_LABEL_CLASS}>Resumen de cambios</span>
          <textarea
            required
            rows="4"
            maxLength={320}
            className="min-h-[76px] w-full min-w-0 resize-y rounded border border-line-strong bg-white px-[11px] py-[10px] text-[12px] leading-[1.5] text-ink placeholder:text-[#949d99]"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe brevemente qué cambió."
          />
        </label>
        <label className="relative flex min-h-[72px] cursor-pointer items-center gap-3 rounded-[5px] border border-dashed border-[#84a599] bg-brand-50 p-[13px_15px] text-brand-800">
          <input
            type="file"
            required
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <Upload className="h-[22px] w-[22px] flex-none" />
          <span className="grid min-w-0 gap-1">
            <strong className="truncate text-[11px]">{file?.name || "Seleccionar archivo actualizado"}</strong>
            <small className="text-[9px] text-muted">La versión anterior se conservará en el historial.</small>
          </span>
        </label>
        <footer className="sticky bottom-0 -mx-[18px] mt-5 flex justify-end gap-[10px] border-t border-line bg-[#fbfcfb] p-[13px_18px] pb-[calc(13px+env(safe-area-inset-bottom))] md:static md:-mx-5 md:p-[14px_20px] md:pb-[14px]">
          <button type="button" className={`flex-1 md:flex-none ${BUTTON_CLASS}`} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`flex-1 border-brand-800 bg-brand-800 text-white enabled:hover:border-brand-950 enabled:hover:bg-brand-950 md:flex-none ${BUTTON_CLASS}`}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" /> : <Upload className="h-[17px] w-[17px]" />} Subir versión
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export default VersionDialog;
