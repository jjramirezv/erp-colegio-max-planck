export default function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`border border-line bg-white ${className}`}>
      <header className="flex h-[52px] items-center justify-between border-b border-line px-[17px]">
        <h2 className="m-0 font-display text-sm font-bold text-brand-900">{title}</h2>
        {action && <button className="border-0 bg-transparent text-[11px] font-bold text-brand-800">{action}</button>}
      </header>
      {children}
    </section>
  );
}
