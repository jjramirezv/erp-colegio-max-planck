const GOOD_VALUES = ["Activo", "Completa", "Pagado", "Al día", "Presente", "Leído", "Vigente", "Firmado", "Entregado", "Operativo", "Atendido", "Generado"];

export default function Status({ value }) {
  const good = GOOD_VALUES.includes(value);
  return (
    <span className={`whitespace-nowrap px-2 py-[5px] text-[10px] ${good ? "bg-brand-100 text-brand-800" : "bg-[#fff7e6] text-[#9a6300]"}`}>{value}</span>
  );
}
