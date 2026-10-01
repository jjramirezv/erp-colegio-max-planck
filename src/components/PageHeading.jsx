export default function PageHeading({ title, description, action, standard = false }) {
  return (
    <div className={standard ? "mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" : "mb-[18px] flex items-start justify-between gap-[15px] max-md:items-center"}>
      <div>
        <h1 className={standard ? "m-0 text-3xl font-extrabold leading-tight tracking-[-0.045em] text-[#14231e] sm:text-4xl" : "m-0 font-display text-[28px] font-bold leading-tight tracking-[-0.018em]"}>{title}</h1>
        <p className={standard ? "mb-0 mt-2 max-w-2xl text-sm leading-6 text-[#66766f] sm:text-base" : "my-[5px] text-sm text-muted"}>{description}</p>
      </div>
      {action ? <div className={standard ? "shrink-0" : ""}>{action}</div> : null}
    </div>
  );
}
