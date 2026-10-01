import { STATUS_BADGE_STYLES } from "../constants";
import { statusKey } from "../utils";

/**
 * `plain` renderiza solo el texto coloreado (sin chip), usado dentro del
 * historial de versiones de MaterialInspector.
 */
export function StatusBadge({ status, plain = false }) {
  const key = statusKey(status);
  const styles = STATUS_BADGE_STYLES[key];
  if (plain) {
    return <span className={`text-[12px] font-bold md:text-[8px] ${styles.text}`}>{status || "Borrador"}</span>;
  }
  return (
    <span
      className={`inline-flex min-h-[25px] items-center whitespace-nowrap rounded border px-2 py-1 text-[9px] font-bold leading-none ${styles.chip}`}
    >
      {status || "Borrador"}
    </span>
  );
}

export default StatusBadge;
