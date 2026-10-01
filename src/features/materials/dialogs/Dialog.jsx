import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export function Dialog({ title, description, onClose, children, wide = false }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const firstControl = dialog?.querySelector("input, select, textarea, button");
    firstControl?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center overflow-auto bg-[rgba(2,35,27,0.68)] p-6 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className={`min-w-0 w-full max-h-[calc(100vh-48px)] overflow-x-hidden overflow-y-auto rounded-[20px] border-0 bg-white shadow-[0_22px_60px_rgba(3,37,28,0.22)] md:rounded-lg md:border md:border-line-strong md:shadow-[0_26px_70px_rgba(0,31,23,0.25)] ${
          wide ? "md:w-[min(720px,100%)]" : "md:w-[min(470px,100%)]"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="sticky top-0 z-[2] flex min-h-[82px] items-start justify-between gap-5 border-b border-line bg-white px-[18px] pb-4 pt-[22px] md:static md:px-5 md:pb-4 md:pt-[19px]">
          <div>
            <h2 id={titleId} className="text-[21px] font-extrabold tracking-[-0.03em] text-[#111915] md:text-[20px]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-[6px] max-w-[560px] text-[11px] leading-[1.5] text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="grid h-[30px] w-[30px] flex-none place-items-center rounded border border-transparent text-[#24332e] hover:border-brand-800 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <X className="h-[18px] w-[18px] stroke-[1.8]" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default Dialog;
