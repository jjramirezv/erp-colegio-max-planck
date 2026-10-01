import Panel from "./Panel";

export default function Attendance() {
  return (
    <Panel title="Asistencia del día" className="pb-5">
      <div className="inline-grid align-middle m-6 h-[130px] w-[130px] place-content-center rounded-full text-center [background:conic-gradient(var(--color-brand-800)_0_92%,#dce7e3_92%)] relative before:absolute before:inset-4 before:rounded-full before:bg-white before:content-['']">
        <strong className="relative text-2xl text-brand-900">92%</strong>
        <span className="relative text-[10px] text-muted">asistencia</span>
      </div>
      <dl className="inline-grid w-[calc(100%-190px)] gap-[13px] align-middle m-0">
        <div className="flex justify-between text-xs"><dt className="text-muted">Presentes</dt><dd className="m-0 font-bold">1,148</dd></div>
        <div className="flex justify-between text-xs"><dt className="text-muted">Tardanzas</dt><dd className="m-0 font-bold">62</dd></div>
        <div className="flex justify-between text-xs"><dt className="text-muted">Ausentes</dt><dd className="m-0 font-bold">38</dd></div>
      </dl>
    </Panel>
  );
}
