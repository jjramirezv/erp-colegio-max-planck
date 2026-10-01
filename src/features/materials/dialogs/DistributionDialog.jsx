import { Check, LoaderCircle, PackageCheck } from "lucide-react";
import { useState } from "react";
import { DELIVERY_STATUS_STYLES } from "../constants";
import { distributionStatus, distributionStatusLabel } from "../utils";
import { Dialog } from "./Dialog";

const FIELD_LABEL_CLASS = "text-[10px] font-bold text-[#34413c]";
const FIELD_INPUT_CLASS =
  "h-[43px] w-full min-w-0 rounded border border-line-strong bg-white px-[11px] text-[12px] text-ink placeholder:text-[#949d99]";
const BUTTON_CLASS =
  "inline-flex min-h-[42px] min-w-[125px] items-center justify-center gap-2 rounded-[5px] border border-brand-800 bg-surface px-[15px] text-[12px] font-bold leading-none text-brand-900 transition-colors enabled:hover:bg-brand-50 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30";

export function DistributionDialog({ material, busy, onClose, onSubmit }) {
  const current = material.physicalDistribution;
  const [planned, setPlanned] = useState(String(current?.planned ?? 1));
  const [delivered, setDelivered] = useState(String(current?.delivered ?? 0));
  const [recipient, setRecipient] = useState(current?.recipient || "");
  const [validationError, setValidationError] = useState("");
  const plannedValue = Number(planned);
  const deliveredValue = Number(delivered);
  const derivedStatus = distributionStatus(plannedValue, deliveredValue);
  const validQuantities =
    Number.isInteger(plannedValue) && plannedValue > 0 && Number.isInteger(deliveredValue) && deliveredValue >= 0 && deliveredValue <= plannedValue;

  function submit(event) {
    event.preventDefault();
    if (!validQuantities) {
      setValidationError("Revisa las cantidades: planificada debe ser mayor que cero y entregada no puede superarla.");
      return;
    }
    setValidationError("");
    onSubmit({
      plannedQuantity: plannedValue,
      deliveredQuantity: deliveredValue,
      recipient: recipient.trim(),
      status: derivedStatus,
    });
  }

  return (
    <Dialog title="Actualizar reparto" description={`${material.grade || "Grado"} · Sección ${material.section || "—"} · ${material.title}`} onClose={onClose}>
      <form className="grid gap-[15px] px-[18px] pt-[17px] md:px-5 md:pt-[19px]" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-[7px]">
            <span className={FIELD_LABEL_CLASS}>Cantidad planificada</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              className={FIELD_INPUT_CLASS}
              value={planned}
              onChange={(event) => {
                setPlanned(event.target.value);
                setValidationError("");
              }}
            />
          </label>
          <label className="grid gap-[7px]">
            <span className={FIELD_LABEL_CLASS}>Cantidad entregada</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max={plannedValue > 0 ? plannedValue : undefined}
              step="1"
              required
              className={FIELD_INPUT_CLASS}
              value={delivered}
              onChange={(event) => {
                setDelivered(event.target.value);
                setValidationError("");
              }}
            />
          </label>
        </div>
        <label className="grid gap-[7px]">
          <span className={FIELD_LABEL_CLASS}>Receptor (opcional)</span>
          <input
            maxLength="160"
            className={FIELD_INPUT_CLASS}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Ej. Tutor de 3.º A"
          />
        </label>
        <div
          className={`grid min-h-[58px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-[10px] rounded-[5px] border p-[10px_12px] ${DELIVERY_STATUS_STYLES[derivedStatus]}`}
        >
          <PackageCheck className="h-[21px] w-[21px] text-brand-800" />
          <span className="grid gap-[2px]">
            <small className="text-[9px] text-muted">Estado calculado</small>
            <strong className="text-[12px]">{distributionStatusLabel(derivedStatus)}</strong>
          </span>
          <b className="text-[12px]">
            {Number.isFinite(deliveredValue) ? deliveredValue : 0} / {Number.isFinite(plannedValue) ? plannedValue : 0}
          </b>
        </div>
        {validationError ? (
          <p className="-mt-1 text-[10px] leading-[1.4] text-[#a72c25]" role="alert">
            {validationError}
          </p>
        ) : null}
        <footer className="sticky bottom-0 -mx-[18px] mt-5 flex justify-end gap-[10px] border-t border-line bg-[#fbfcfb] p-[13px_18px] pb-[calc(13px+env(safe-area-inset-bottom))] md:static md:-mx-5 md:p-[14px_20px] md:pb-[14px]">
          <button type="button" className={`flex-1 md:flex-none ${BUTTON_CLASS}`} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`flex-1 border-brand-800 bg-brand-800 text-white enabled:hover:border-brand-950 enabled:hover:bg-brand-950 md:flex-none ${BUTTON_CLASS}`}
            disabled={busy || !validQuantities}
          >
            {busy ? <LoaderCircle className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" /> : <Check className="h-[17px] w-[17px]" />} Guardar reparto
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export default DistributionDialog;
