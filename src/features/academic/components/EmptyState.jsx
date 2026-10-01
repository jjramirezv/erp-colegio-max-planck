import { ClipboardList } from "lucide-react";

export default function EmptyState({ icon: Icon = ClipboardList, title, text }) {
  return (
    <div className="grid min-h-[260px] place-content-center justify-items-center gap-2 p-8 text-center text-muted">
      <Icon className="h-[29px] w-[29px] text-brand-900" />
      <strong className="text-xs text-ink">{title}</strong>
      <span className="max-w-[340px] text-[11px] leading-relaxed">{text}</span>
    </div>
  );
}
