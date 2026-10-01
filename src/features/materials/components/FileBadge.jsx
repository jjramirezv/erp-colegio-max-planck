import { FileText } from "lucide-react";

export function FileBadge({ type = "PDF", compact = false }) {
  return (
    <span
      className={`relative grid place-items-center text-[#1b2521] ${compact ? "h-[46px] w-[35px]" : "h-[69px] w-[58px]"}`}
      aria-hidden="true"
    >
      <FileText
        className={compact ? "h-[42px] w-[33px] fill-white stroke-[1.35]" : "h-[64px] w-[52px] fill-white stroke-[1.35]"}
      />
      <b
        className={`absolute rounded-[1px] bg-[#df1d1d] text-center font-black leading-none text-white shadow-[0_1px_2px_rgba(110,0,0,0.18)] ${
          compact
            ? "bottom-[5px] left-[3px] min-w-[25px] px-[3px] py-[2px] text-[7px]"
            : "bottom-[9px] left-[6px] min-w-[38px] px-[4px] py-[3px] text-[11px]"
        }`}
      >
        {String(type).slice(0, 4).toUpperCase()}
      </b>
    </span>
  );
}

export default FileBadge;
