import { LoaderCircle } from "lucide-react";

export function LoadingState() {
  return (
    <div
      className="grid min-h-[420px] place-content-center justify-items-center gap-2 p-[30px] text-center text-muted"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="mb-[5px] h-7 w-7 animate-spin text-brand-700 motion-reduce:animate-none" />
      <strong className="text-[14px] font-extrabold text-ink">Cargando materiales</strong>
      <span className="max-w-[300px] text-[11px] leading-[1.55]">Consultando la estructura académica y sus recursos.</span>
    </div>
  );
}

export default LoadingState;
