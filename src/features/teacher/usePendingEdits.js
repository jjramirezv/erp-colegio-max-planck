import { useEffect } from "react";

export default function usePendingEdits(dirty, busy) {
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event) => {
      if (busy || !window.confirm("Hay cambios sin guardar. ¿Deseas descartarlos?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("mp-before-navigation", navigate);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("mp-before-navigation", navigate); };
  }, [dirty, busy]);
}
