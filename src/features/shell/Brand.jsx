function visibleSchoolName(name) {
  return (name || "Colegio Max Planck").replace(/^colegio\s+/i, "").trim() || "Max Planck";
}

export default function Brand({ inverse = false, large = false, identity }) {
  const schoolName = visibleSchoolName(identity?.displayName);
  const hasLogo = Boolean(identity?.logoUrl);
  return (
    <div className={`flex items-center gap-[11px] ${inverse ? "text-white" : "text-brand-900"} ${large ? "grid justify-items-start gap-[18px]" : ""}`}>
      <span
        className={`grid place-items-center font-[Georgia,serif] font-bold ${hasLogo ? "border-0" : "border"} ${
          large ? `h-[88px] w-[88px] ${hasLogo ? "" : "border-white/40"} text-[34px]` : `h-11 w-11 ${hasLogo ? "" : "border-current"} text-[18px]`
        }`}
      >
        {hasLogo ? <img className="h-full w-full object-contain" src={identity.logoUrl} alt="Logo institucional" /> : "MP"}
      </span>
      <span>
        <small className={`block font-bold tracking-[0.25em] ${large ? "text-[11px]" : "text-[8px]"}`}>COLEGIO</small>
        <strong className={`block max-w-[180px] truncate font-sans font-extrabold tracking-[-0.025em] ${large ? "text-[25px]" : "text-sm"}`}>{schoolName.toUpperCase()}</strong>
      </span>
    </div>
  );
}
