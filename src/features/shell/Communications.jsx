import { announcements } from "../../data";
import Panel from "./Panel";

export default function Communications() {
  return (
    <Panel title="Comunicados" action="Ver todos" className="lg:row-span-2">
      <div>
        {announcements.map((a) => (
          <article key={a.title} className="mx-[18px] border-l-2 border-amber py-[17px] pl-[14px] first:border-t-0 [&+&]:border-t [&+&]:border-t-line">
            <strong className="text-xs">{a.title}</strong>
            <p className="my-[6px] text-[11px] leading-[1.5] text-muted">{a.text}</p>
            <small className="text-[#87928e]">{a.date}</small>
          </article>
        ))}
      </div>
    </Panel>
  );
}
