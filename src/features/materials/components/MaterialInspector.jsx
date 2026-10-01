import {
  Archive,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  Download,
  GraduationCap,
  History,
  Eye,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import { DELIVERY_STATUS_STYLES } from "../constants";
import { distributionStatus, distributionStatusLabel, formatDate, isPhysicalDelivery, statusKey } from "../utils";
import { FileBadge } from "./FileBadge";
import { StatusBadge } from "./StatusBadge";

const BUTTON_CLASS =
  "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[5px] border border-brand-800 px-[15px] text-[12px] font-bold leading-none transition-colors enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30";
const BUTTON_PRIMARY_CLASS =
  "border-brand-800 bg-brand-800 text-white enabled:hover:border-brand-950 enabled:hover:bg-brand-950";
const BUTTON_DANGER_CLASS = "border-[#dc5353] text-red enabled:hover:bg-red-soft";

export function MaterialInspector({
  material,
  permissions,
  busyAction,
  onClose,
  onEdit,
  onVersion,
  onPublish,
  onArchive,
  onDistribution,
  onOpenMaterial,
}) {
  const versions = material.versions?.length
    ? material.versions
    : [
        {
          id: `${material.id}-current`,
          version: material.version || "1.0",
          status: material.status || "Borrador",
          author: material.createdBy || "Coordinación Académica",
          date: material.updatedAt,
          summary: material.description,
          url: material.fileUrl,
          storagePath: material.db?.storagePath,
        },
      ];
  const physical = material.physicalDistribution;
  const hasPhysicalDelivery = isPhysicalDelivery(material.delivery);
  const physicalStatus = physical?.status || distributionStatus(physical?.planned, physical?.delivered);
  const isPublished = statusKey(material.status) === "published" || Boolean(material.publishedAt);
  const previewVersion = versions.find((version) => version.storagePath || version.url);

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-[150] grid max-h-[min(76vh,680px)] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-[24px] border-0 bg-surface shadow-[0_-15px_50px_rgba(3,37,28,0.17)] md:inset-x-auto md:inset-y-auto md:left-auto md:right-0 md:top-[76px] md:bottom-0 md:max-h-none md:w-[min(390px,calc(100vw-28px))] md:rounded-t-none md:rounded-tl-[8px] md:shadow-[-14px_0_46px_rgba(2,35,27,0.18)] 2xl:static 2xl:h-auto 2xl:w-auto 2xl:rounded-[8px] 2xl:border 2xl:border-line-strong 2xl:shadow-none"
      aria-label={`Detalle de ${material.title}`}
    >
      <div className="absolute left-1/2 top-[11px] z-[2] block h-[5px] w-[52px] -translate-x-1/2 rounded-full bg-[#a4aaa8] md:hidden" aria-hidden="true" />
      <header className="flex min-h-[132px] items-start justify-between gap-2 border-b border-line px-[22px] pb-[17px] pt-[34px] md:min-h-[108px] md:px-[18px] md:py-[16px]">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <FileBadge type={material.fileType} />
          <span className="min-w-0">
            <h2 className="[overflow-wrap:anywhere] text-[20px] font-extrabold leading-[1.3] tracking-[-0.02em] text-[#131a18] md:text-[16px]">
              {material.title}
            </h2>
            <p className="mt-[6px] text-[13px] text-muted md:text-[11px]">Versión {material.version || "1.0"}</p>
          </span>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 flex-none place-items-center rounded border border-transparent text-[#24332e] hover:border-brand-800 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30 md:h-[30px] md:w-[30px]"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          <X className="h-[25px] w-[25px] md:h-[18px] md:w-[18px]" />
        </button>
      </header>

      <p className="m-0 flex items-center gap-[6px] overflow-x-auto whitespace-nowrap border-b border-line px-[22px] pb-[17px] text-[11px] text-muted [scrollbar-width:none] md:hidden">
        <span>Ámbito:</span>
        <strong className="font-bold text-brand-800">{material.level || "—"}</strong>
        <i className="not-italic text-[#8b9692]">·</i>
        <strong className="font-bold text-brand-800">
          {material.grade || "—"} {material.section || ""}
        </strong>
        <i className="not-italic text-[#8b9692]">·</i>
        <strong className="font-bold text-brand-800">{material.course || "—"}</strong>
      </p>

      <div className="min-h-0 overflow-auto [scrollbar-color:#b8c6c1_transparent] [scrollbar-width:thin]">
        <section className="hidden gap-[10px] border-b border-line p-[16px_18px] md:grid">
          <div className="flex items-center justify-between gap-[10px]">
            <span className="text-[11px] font-bold text-muted">Estado actual</span>
            <StatusBadge status={material.status} />
          </div>
          <p className="m-0 text-[11px] leading-[1.55] text-muted">{material.description || "Sin descripción registrada."}</p>
          {previewVersion ? (
            <button
              type="button"
              className={`min-h-[40px] w-full bg-white text-brand-900 enabled:hover:bg-brand-50 ${BUTTON_CLASS}`}
              onClick={() => onOpenMaterial(material, previewVersion)}
              disabled={busyAction === "open"}
            >
              {busyAction === "open" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Eye className="h-4 w-4" />}
              Vista previa
            </button>
          ) : null}
        </section>

        <section className="hidden border-b border-line p-[18px] md:block">
          <h3 className="mb-[13px] flex items-center gap-[7px] text-[13px] font-extrabold text-[#29342f]">
            <GraduationCap className="h-[15px] w-[15px] text-brand-800" /> Ámbito
          </h3>
          <dl className="m-0 grid gap-[9px]">
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-[8px] text-[11px]">
              <dt className="flex items-center gap-[6px] text-[#414c48]">
                <GraduationCap className="h-[14px] w-[14px]" /> Nivel
              </dt>
              <dd className="m-0 font-bold text-brand-800">{material.level || "—"}</dd>
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-[8px] text-[11px]">
              <dt className="flex items-center gap-[6px] text-[#414c48]">
                <Building2 className="h-[14px] w-[14px]" /> Grado
              </dt>
              <dd className="m-0 font-bold text-brand-800">{material.grade || "—"}</dd>
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-[8px] text-[11px]">
              <dt className="flex items-center gap-[6px] text-[#414c48]">
                <Users className="h-[14px] w-[14px]" /> Sección
              </dt>
              <dd className="m-0 font-bold text-brand-800">{material.section || "—"}</dd>
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-[8px] text-[11px]">
              <dt className="flex items-center gap-[6px] text-[#414c48]">
                <BookOpen className="h-[14px] w-[14px]" /> Curso
              </dt>
              <dd className="m-0 font-bold text-brand-800">{material.course || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="border-b border-line p-[18px]">
          <h3 className="mb-[14px] flex items-center gap-[7px] text-[13px] font-extrabold text-[#29342f]">
            <History className="h-[15px] w-[15px] text-brand-800" /> Historial de versiones
          </h3>
          <ol className="m-0 grid gap-[3px] p-0 md:gap-0">
            {versions.map((version, index) => (
              <li
                key={version.id || `${material.id}-${version.version}-${index}`}
                className="relative grid grid-cols-[14px_minmax(0,1fr)_30px] gap-[9px] pb-[16px] before:absolute before:bottom-[-2px] before:left-[5px] before:top-[13px] before:w-px before:bg-[#cbd2cf] before:content-[''] last:pb-0 last:before:hidden"
              >
                <span
                  aria-hidden="true"
                  className={`relative z-[1] mt-[5px] h-[11px] w-[11px] rounded-full bg-[#aeb5b2] ${
                    index === 0 ? "bg-brand-700 shadow-[0_0_0_3px_#e3f2ec]" : ""
                  }`}
                />
                <div className="min-w-0">
                  <p className="mb-1 flex items-center gap-[8px]">
                    <strong className="text-[11px]">{version.version}</strong>
                    <StatusBadge status={version.status} plain />
                  </p>
                  <small className="block text-[9px] leading-[1.5] text-muted">
                    Actualizado por {version.author || "—"} · {formatDate(version.date, true)}
                  </small>
                  {version.summary ? (
                    <em className="mt-[3px] block text-[9px] not-italic leading-[1.45] text-[#4b5652]">
                      {version.summary}
                    </em>
                  ) : null}
                </div>
                {version.storagePath || version.url ? (
                  <button
                    type="button"
                    className="grid h-[30px] w-[30px] place-items-center rounded text-brand-800 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-55"
                    aria-label={`Abrir archivo de la versión ${version.version}`}
                    title="Abrir archivo"
                    onClick={() => onOpenMaterial(material, version)}
                    disabled={busyAction === "open"}
                  >
                    {busyAction === "open" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="hidden border-b border-line p-[18px] md:block">
          <h3 className="mb-[12px] flex items-center gap-[7px] text-[13px] font-extrabold text-[#29342f]">
            <CalendarDays className="h-[15px] w-[15px] text-brand-800" /> Fechas
          </h3>
          <dl className="m-0">
            <div className="grid grid-cols-2 gap-[8px] py-[5px] text-[10px]">
              <dt className="text-[#414c48]">Registrado</dt>
              <dd className="m-0 font-semibold text-[#2e3935]">{formatDate(versions.at(-1)?.date, true)}</dd>
            </div>
            <div className="grid grid-cols-2 gap-[8px] py-[5px] text-[10px]">
              <dt className="text-[#414c48]">{isPublished ? "Publicado" : "Última actualización"}</dt>
              <dd className="m-0 font-semibold text-[#2e3935]">{formatDate(isPublished ? material.publishedAt || material.updatedAt : material.updatedAt, true)}</dd>
            </div>
          </dl>
        </section>

        {hasPhysicalDelivery ? (
          <section className="border-b border-line p-[18px_22px] md:p-[13px_14px]">
            <div className="mb-[10px] flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-[7px] text-[14px] font-extrabold text-[#29342f] md:text-[10px]">
                <PackageCheck className="h-[15px] w-[15px] text-brand-800" /> Distribución física
              </h3>
              {physical ? (
                <span
                  className={`inline-flex min-h-[23px] items-center whitespace-nowrap rounded-full border px-[7px] py-[3px] text-[8px] font-extrabold ${DELIVERY_STATUS_STYLES[physicalStatus]}`}
                >
                  {distributionStatusLabel(physicalStatus)}
                </span>
              ) : null}
            </div>
            {physical ? (
              <dl className="m-0 overflow-hidden rounded border border-line">
                <div className="grid grid-cols-2 gap-[7px] border-b border-line p-[5px_8px] text-[8px] last:border-b-0">
                  <dt className="border-r border-line text-[#414c48]">Cantidad planificada</dt>
                  <dd className="m-0 font-semibold text-[#2e3935]">{physical.planned ?? "—"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-[7px] border-b border-line p-[5px_8px] text-[8px] last:border-b-0">
                  <dt className="border-r border-line text-[#414c48]">Cantidad entregada</dt>
                  <dd className="m-0 font-semibold text-[#2e3935]">{physical.delivered ?? "—"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-[7px] border-b border-line p-[5px_8px] text-[8px] last:border-b-0">
                  <dt className="border-r border-line text-[#414c48]">Sección</dt>
                  <dd className="m-0 font-semibold text-[#2e3935]">{physical.section || material.section || "—"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-[7px] border-b border-line p-[5px_8px] text-[8px] last:border-b-0">
                  <dt className="border-r border-line text-[#414c48]">Receptor</dt>
                  <dd className="m-0 font-semibold text-[#2e3935]">{physical.recipient || "Sin registrar"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-[7px] p-[5px_8px] text-[8px]">
                  <dt className="border-r border-line text-[#414c48]">Fecha de entrega</dt>
                  <dd className="m-0 font-semibold text-[#2e3935]">{formatDate(physical.deliveredAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="m-0 rounded border border-dashed border-line-strong bg-[#fafcfb] p-[9px_10px] text-[9px] leading-[1.45] text-muted">
                {statusKey(material.status) === "published"
                  ? "Aún no se registró el reparto para este salón."
                  : "El reparto se habilita cuando el material esté publicado."}
              </p>
            )}
            {permissions.canManageDistribution(material) ? (
              <button
                type="button"
                className={`mt-[9px] min-h-[35px] w-full border-[#9fc2b5] bg-white text-brand-800 enabled:hover:bg-brand-50 ${BUTTON_CLASS}`}
                onClick={() => onDistribution(material)}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "distribution" ? (
                  <LoaderCircle className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" />
                ) : (
                  <PackageCheck className="h-[17px] w-[17px]" />
                )}{" "}
                Actualizar reparto
              </button>
            ) : null}
          </section>
        ) : null}
      </div>

      {permissions.canUploadVersion(material) || permissions.canEdit(material) || permissions.canArchive(material) ? (
        <footer className="grid grid-cols-2 gap-2 border-t border-line bg-white p-[13px_16px] pb-[calc(13px+env(safe-area-inset-bottom))] md:p-3">
          {permissions.canUploadVersion(material) ? (
            <button
              type="button"
              className={`min-h-[42px] min-w-0 bg-white px-[10px] text-[11px] text-brand-900 enabled:hover:bg-brand-50 ${BUTTON_CLASS}`}
              onClick={() => onVersion(material)}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "version" ? (
                <LoaderCircle className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" />
              ) : (
                <Plus className="h-[17px] w-[17px]" />
              )}{" "}
              Nueva versión
            </button>
          ) : null}
          {permissions.canPublish(material) && statusKey(material.status) !== "published" ? (
            <button
              type="button"
              className={`min-h-[42px] min-w-0 px-[10px] text-[11px] ${BUTTON_CLASS} ${BUTTON_PRIMARY_CLASS}`}
              onClick={() => onPublish(material)}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "publish" ? (
                <LoaderCircle className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" />
              ) : (
                <Check className="h-[17px] w-[17px]" />
              )}{" "}
              Publicar
            </button>
          ) : null}
          {permissions.canEdit(material) ? (
            <button
              type="button"
              className={`min-h-[42px] min-w-0 bg-white px-[10px] text-[11px] text-brand-900 enabled:hover:bg-brand-50 ${BUTTON_CLASS}`}
              onClick={() => onEdit(material)}
              disabled={Boolean(busyAction)}
            >
              <Pencil className="h-[17px] w-[17px]" /> Editar
            </button>
          ) : null}
          {permissions.canArchive(material) && statusKey(material.status) !== "archived" ? (
            <button
              type="button"
              className={`min-h-[42px] min-w-0 bg-white px-[10px] text-[11px] enabled:hover:bg-red-soft ${BUTTON_CLASS} ${BUTTON_DANGER_CLASS}`}
              onClick={() => onArchive(material)}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "archive" ? (
                <LoaderCircle className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" />
              ) : (
                <Archive className="h-[17px] w-[17px]" />
              )}{" "}
              Archivar
            </button>
          ) : null}
        </footer>
      ) : null}
    </aside>
  );
}

export default MaterialInspector;
