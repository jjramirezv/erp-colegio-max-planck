export const CARD = "min-w-0 rounded-[10px] border border-line bg-white shadow-[0_8px_24px_rgba(7,54,42,0.04)]";
export const BUTTON = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[7px] border border-line-strong bg-white px-4 text-[13px] font-bold text-brand-900 transition hover:border-brand-800 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

export function Card({ title, icon: Icon, action, children, className = "", bodyClassName = "p-5" }) {
  return <section className={`${CARD} ${className}`}>
    {title ? <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-line px-5">
      <h2 className="m-0 flex items-center gap-2.5 text-[15px] font-extrabold tracking-[-0.01em] text-brand-950">{Icon ? <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand-900"><Icon className="h-4 w-4" /></span> : null}{title}</h2>
      {action}
    </header> : null}
    <div className={bodyClassName}>{children}</div>
  </section>;
}

export function StatCard({ icon: Icon, label, value, hint, tone = "bg-brand-100 text-brand-900", onClick }) {
  const Tag = onClick ? "button" : "article";
  return <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`${CARD} flex min-h-[104px] flex-col items-start gap-3 p-4 text-left sm:flex-row sm:items-center sm:gap-4 md:p-5 ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-brand-800" : ""}`}>
    <span className={`grid h-11 w-11 flex-none place-items-center rounded-full ${tone}`}><Icon className="h-5 w-5" /></span>
    <span className="min-w-0">
      <strong className="block text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-brand-950">{value}</strong>
      <span className="block text-[12px] font-bold text-muted">{label}</span>
      {hint ? <small className="block text-[11px] text-muted">{hint}</small> : null}
    </span>
  </Tag>;
}

export function Empty({ icon: Icon, title, children }) {
  return <div className="grid min-h-[170px] place-content-center justify-items-center gap-2 rounded-[10px] border border-dashed border-line-strong bg-canvas px-6 py-8 text-center">
    {Icon ? <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-brand-900"><Icon className="h-5 w-5" /></span> : null}
    {title ? <strong className="text-[14px] text-brand-950">{title}</strong> : null}
    <p className="m-0 max-w-[420px] text-[13px] leading-relaxed text-muted">{children}</p>
  </div>;
}

export function Pill({ active, children, onClick, className = "" }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[12px] font-bold transition ${active ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-white text-[#42524c] hover:border-brand-800"} ${className}`}>{children}</button>;
}

// Iniciales legibles: "Ciencia y Tecnología" → CT, "Matemática" → MA.
function courseInitials(name) {
  const words = name.split(/\s+/).filter((word) => word.length > 2);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || name).slice(0, 2)).toUpperCase();
}

export function CourseBadge({ name, tone, size = "h-11 w-11 text-[13px]" }) {
  return <span aria-hidden="true" className={`grid flex-none place-items-center rounded-[9px] font-black ${size} ${tone.block.split(" ")[0]} ${tone.text}`}>{courseInitials(name)}</span>;
}
