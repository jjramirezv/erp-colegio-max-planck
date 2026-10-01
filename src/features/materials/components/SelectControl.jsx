import { useId } from "react";
import { ChevronDown } from "lucide-react";

export function SelectControl({ icon: Icon, label, value, options, onChange, compact = false }) {
  const id = useId();
  return (
    <label
      className={`relative flex min-w-0 items-center rounded-[5px] border border-line bg-surface text-ink ${
        compact ? "h-9 w-[132px]" : "h-[42px]"
      }`}
      htmlFor={id}
    >
      <span className="sr-only">{label}</span>
      {!compact ? (
        <Icon aria-hidden="true" className="ml-[13px] h-[18px] w-[18px] flex-none stroke-[1.75] text-[#24312d]" />
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className={`h-full w-full min-w-0 appearance-none truncate bg-transparent pl-[11px] pr-[31px] font-medium text-inherit outline-none ${
          compact ? "text-[10px]" : "text-[12px]"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-[10px] h-[15px] w-[15px]" />
    </label>
  );
}

export default SelectControl;
