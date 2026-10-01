import { AlertCircle, CheckCircle2, X } from "lucide-react";

const TYPE_CLASS = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  error: "border-rose-300 bg-rose-50 text-rose-800",
};

export default function StatusMessage({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      className={`mb-3 flex items-center gap-2 border px-3 py-2.5 text-[11px] leading-relaxed ${TYPE_CLASS[message.type] || "border-amber-300 bg-amber-soft text-amber-ink"}`}
      role={message.type === "error" ? "alert" : "status"}
    >
      {message.type === "error" ? <AlertCircle className="h-[17px] w-[17px] shrink-0" /> : <CheckCircle2 className="h-[17px] w-[17px] shrink-0" />}
      <span className="flex-1">{message.text}</span>
      <button type="button" aria-label="Cerrar mensaje" onClick={onClose} className="grid h-[26px] w-[26px] cursor-pointer place-items-center border-0 bg-transparent text-current">
        <X className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
