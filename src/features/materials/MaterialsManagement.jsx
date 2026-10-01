import {
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Filter,
  GraduationCap,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { DISTRIBUTION_MANAGER_ROLES, EMPTY_ARRAY, FULL_ACCESS_ROLES, TEACHER_ROLES } from "./constants";
import {
  distributionStatus,
  getInitialSelection,
  isPhysicalDelivery,
  isPurelyPhysicalDelivery,
  normalizedRole,
  normalizeText,
  sameSelection,
  selectionDetails,
  statusKey,
} from "./utils";
import { EmptyState } from "./components/EmptyState";
import { LoadingState } from "./components/LoadingState";
import { MaterialCards } from "./components/MaterialCards";
import { MaterialInspector } from "./components/MaterialInspector";
import { MaterialTable } from "./components/MaterialTable";
import { SelectControl } from "./components/SelectControl";
import { DistributionDialog } from "./dialogs/DistributionDialog";
import { MaterialFormDialog } from "./dialogs/MaterialFormDialog";
import { VersionDialog } from "./dialogs/VersionDialog";
import { getCachedGeneralSettings } from "../general-settings/generalSettingsApi";

const ICON_BUTTON_CLASS =
  "inline-grid h-9 w-9 flex-none place-items-center rounded border border-line bg-white text-[#24332e] hover:border-brand-800 hover:bg-brand-50 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30";

/**
 * Módulo presentacional de gestión académica de materiales.
 * Los callbacks reciben un único objeto para poder conectarlos directamente
 * con servicios, mutations o Edge Functions sin acoplar la UI a Supabase.
 */
export function MaterialsManagement({
  data,
  loading = false,
  error = null,
  role = "coordinador_academico",
  onCreate,
  onUpdate,
  onArchive,
  onPublish,
  onUploadVersion,
  onSaveDistribution,
  onOpenMaterial,
  onStartSetup,
  onConfigureCourses,
  onRetry,
}) {
  const [localData, setLocalData] = useState({ years: [], defaultSelection: {}, academicStructure: [], materials: [] });
  const source = data || localData;
  const structure = source.academicStructure || EMPTY_ARRAY;
  const fallbackYears = useMemo(() => [new Date().getFullYear()], []);
  const years = source.years?.length ? source.years : data ? EMPTY_ARRAY : fallbackYears;
  const fallbackSelection = useMemo(
    () =>
      getInitialSelection({
        academicStructure: structure,
        defaultSelection: source.defaultSelection,
        years,
      }),
    [source.defaultSelection, structure, years],
  );
  const materials = source.materials || EMPTY_ARRAY;
  const [selection, setSelection] = useState(() => getInitialSelection(source));
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 760);
  const [selectedId, setSelectedId] = useState(() => materials[0]?.id || null);
  const [menuFor, setMenuFor] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => getCachedGeneralSettings().pageSize);
  const details = selectionDetails(structure, selection);
  const destinationReady = Boolean(details.section?.id)
    && Boolean(details.course?.id);
  const roleKey = normalizedRole(role);
  const hasFullAccess = FULL_ACCESS_ROLES.has(roleKey);
  const isTeacher = TEACHER_ROLES.has(roleKey);
  const isSeedMode = !data;
  const canAccessCreate = hasFullAccess || (isTeacher && (source.permissions?.canCreate === true || isSeedMode));

  const permissions = useMemo(() => {
    function allowed(material, permission, seedTeacherFallback = false) {
      if (hasFullAccess) return true;
      if (material.permissions && Object.hasOwn(material.permissions, permission)) {
        return material.permissions[permission] === true;
      }
      return isSeedMode && isTeacher && seedTeacherFallback && normalizeText(material.origin).includes("docente");
    }
    return {
      canCreate: destinationReady && canAccessCreate && !loading && !error,
      canEdit: (material) => statusKey(material.status) !== "archived" && allowed(material, "canEdit", true),
      canArchive: (material) => statusKey(material.status) !== "archived" && allowed(material, "canArchive", true),
      canPublish: (material) => statusKey(material.status) === "draft" && allowed(material, "canPublish"),
      canUploadVersion: (material) =>
        statusKey(material.status) !== "archived" && !isPurelyPhysicalDelivery(material.delivery) && allowed(material, "canUploadVersion", true),
      canManageDistribution: (material) =>
        DISTRIBUTION_MANAGER_ROLES.has(roleKey) && isPhysicalDelivery(material.delivery) && statusKey(material.status) === "published",
    };
  }, [canAccessCreate, destinationReady, hasFullAccess, isSeedMode, isTeacher, roleKey, loading, error]);

  const scopedMaterials = useMemo(
    () => materials.filter((material) => (
        String(material.year) === String(selection.year) &&
        material.levelId === selection.levelId &&
        material.gradeId === selection.gradeId &&
        material.sectionId === selection.sectionId &&
        material.courseId === selection.courseId
      )),
    [materials, selection],
  );

  const filteredMaterials = useMemo(() => {
    const needle = normalizeText(deferredQuery.trim());
    return scopedMaterials.filter((material) => {
      if (statusFilter !== "all" && statusKey(material.status) !== statusFilter) return false;
      if (originFilter !== "all" && normalizeText(material.origin) !== originFilter) return false;
      if (!needle) return true;
      return normalizeText(`${material.title} ${material.description} ${material.origin} ${material.fileType}`).includes(needle);
    });
  }, [deferredQuery, originFilter, scopedMaterials, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / pageSize));
  const pageMaterials = filteredMaterials.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = useMemo(() => filteredMaterials.map((material) => material.id).join("|"), [filteredMaterials]);
  const selectedMaterial = materials.find((material) => material.id === selectedId) || null;

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, originFilter, selection, statusFilter]);

  useEffect(() => {
    setSelection((current) => {
      const currentDetails = selectionDetails(structure, current);
      const valid =
        years.some((year) => String(year) === String(current.year)) &&
        currentDetails.level?.id === current.levelId &&
        currentDetails.grade?.id === current.gradeId &&
        currentDetails.section?.id === current.sectionId &&
        (currentDetails.course?.id === current.courseId || (isTeacher && current.courseId === ""));
      if (valid) return current;
      const resolved = selectionDetails(structure, fallbackSelection);
      const nextSelection = {
        year: years.some((year) => String(year) === String(fallbackSelection.year)) ? String(fallbackSelection.year) : String(years[0]),
        levelId: resolved.level?.id || "",
        gradeId: resolved.grade?.id || "",
        sectionId: resolved.section?.id || "",
        courseId: resolved.course?.id || "",
      };
      return sameSelection(current, nextSelection) ? current : nextSelection;
    });
  }, [fallbackSelection, structure, years, isTeacher]);

  useEffect(() => {
    if (!filteredMaterials.length) {
      setSelectedId(null);
      return;
    }
    if (!filteredMaterials.some((material) => material.id === selectedId)) {
      setSelectedId(filteredMaterials[0].id);
    }
  }, [selectedId, visibleIds]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function selectMaterial(id) {
    setSelectedId(id);
    setInspectorOpen(true);
    setMenuFor(null);
  }

  function changeSelection(patch) {
    setSelection((current) => ({ ...current, ...patch }));
  }

  function changeLevel(levelId) {
    const level = structure.find((item) => item.id === levelId);
    const grade = level?.grades?.[0];
    const section = grade?.sections?.[0];
    changeSelection({ levelId, gradeId: grade?.id || "", sectionId: section?.id || "", courseId: isTeacher ? "" : section?.courses?.[0]?.id || "" });
  }

  function changeGrade(gradeId) {
    const grade = details.level?.grades?.find((item) => item.id === gradeId);
    const section = grade?.sections?.[0];
    changeSelection({ gradeId, sectionId: section?.id || "", courseId: isTeacher ? "" : section?.courses?.[0]?.id || "" });
  }

  function changeSection(sectionId) {
    const section = details.grade?.sections?.find((item) => item.id === sectionId);
    changeSelection({ sectionId, courseId: isTeacher ? "" : section?.courses?.[0]?.id || "" });
  }

  function resetView() {
    setSelection((current) => (sameSelection(current, fallbackSelection) ? current : fallbackSelection));
    setQuery("");
    setStatusFilter("all");
    setOriginFilter("all");
    setFilterOpen(false);
  }

  async function runAction(kind, callback, payload, mutate, successMessage) {
    setBusyAction(kind);
    setActionError("");
    try {
      const result = callback ? await callback(payload) : null;
      if (!data && mutate) {
        setLocalData((current) => ({ ...current, materials: mutate(current.materials, result) }));
      }
      setNotice(successMessage);
      window.setTimeout(() => setNotice(""), 3500);
      return true;
    } catch (actionFailure) {
      setActionError(actionFailure?.message || "No se pudo completar la operación. Inténtalo nuevamente.");
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function createMaterial(values) {
    if (!permissions.canCreate) return;
    const now = new Date().toISOString();
    const id = `material-${Date.now()}`;
    const payload = { ...values, id, version: "1.0", updatedAt: now };
    const done = await runAction(
      "create",
      onCreate,
      payload,
      (current, result) => [
        result?.material || result || {
          ...payload,
          file: undefined,
          fileSize: values.fileSize || "—",
          createdBy: isTeacher ? "Docente" : "Coordinación Académica",
          versions: [],
        },
        ...current,
      ],
      "Material creado correctamente.",
    );
    if (done) {
      setDialog(null);
      setSelectedId(id);
      setInspectorOpen(true);
    }
  }

  async function updateMaterial(values) {
    const target = dialog?.material;
    if (!target) return;
    const changes = { ...values, updatedAt: new Date().toISOString() };
    const done = await runAction(
      "update",
      onUpdate,
      { id: target.id, changes, material: target },
      (current, result) => current.map((item) => (item.id === target.id ? { ...item, ...changes, ...(result?.material || result || {}), file: undefined } : item)),
      "Cambios guardados correctamente.",
    );
    if (done) setDialog(null);
  }

  async function uploadVersion(values) {
    const target = dialog?.material;
    if (!target) return;
    const now = new Date().toISOString();
    const newVersion = {
      id: `${target.id}-${values.version}-${Date.now()}`,
      version: values.version,
      status: "Borrador",
      author: isTeacher ? "Docente" : "Coordinación Académica",
      date: now,
      summary: values.summary,
    };
    const done = await runAction(
      "version",
      onUploadVersion,
      { materialId: target.id, material: target, ...values },
      (current, result) =>
        current.map((item) =>
          item.id === target.id
            ? {
                ...item,
                ...(result?.material || {}),
                version: result?.version?.version || values.version,
                status: result?.material?.status || "Borrador",
                updatedAt: now,
                fileSize: values.file ? `${(values.file.size / 1024 / 1024).toFixed(1)} MB` : item.fileSize,
                versions: [result?.version || newVersion, ...(item.versions || [])],
              }
            : item,
        ),
      "La nueva versión quedó registrada.",
    );
    if (done) setDialog(null);
  }

  async function publishMaterial(material) {
    const now = new Date().toISOString();
    await runAction(
      "publish",
      onPublish,
      { id: material.id, material },
      (current, result) =>
        current.map((item) => (item.id === material.id ? { ...item, status: "Publicado", publishedAt: now, updatedAt: now, ...(result?.material || result || {}) } : item)),
      "Material publicado para sus destinatarios.",
    );
    setMenuFor(null);
  }

  async function archiveMaterial(material) {
    if (typeof window !== "undefined" && !window.confirm(`¿Archivar "${material.title}"? El historial se conservará.`)) return;
    await runAction(
      "archive",
      onArchive,
      { id: material.id, material },
      (current, result) =>
        current.map((item) => (item.id === material.id ? { ...item, status: "Archivado", updatedAt: new Date().toISOString(), ...(result?.material || result || {}) } : item)),
      "Material archivado; su historial permanece disponible.",
    );
    setMenuFor(null);
  }

  async function saveDistribution(values) {
    const target = dialog?.material;
    if (!target || !permissions.canManageDistribution(target)) return;
    const now = new Date().toISOString();
    const nextStatus = distributionStatus(values.plannedQuantity, values.deliveredQuantity);
    const done = await runAction(
      "distribution",
      onSaveDistribution,
      { material: target, ...values, status: nextStatus },
      (current, result) =>
        current.map((item) => {
          if (item.id !== target.id) return item;
          const saved = result?.distribution;
          const priorDate = item.physicalDistribution?.deliveredAt;
          return {
            ...item,
            physicalDistribution: {
              ...(item.physicalDistribution || {}),
              id: saved?.id || item.physicalDistribution?.id,
              planned: saved?.planned_quantity ?? values.plannedQuantity,
              delivered: saved?.delivered_quantity ?? values.deliveredQuantity,
              status: saved?.status || nextStatus,
              section: item.section,
              recipient: saved?.received_by ?? (values.recipient || null),
              deliveredAt: saved?.delivered_on ?? (nextStatus === "pending" ? null : priorDate || now),
              updatedAt: saved?.updated_at || now,
            },
          };
        }),
      `Reparto actualizado para la sección ${target.section || "seleccionada"}.`,
    );
    if (done) setDialog(null);
  }

  async function openMaterialFile(material, version) {
    const storagePath = version?.storagePath || material.db?.storagePath;
    const fileUrl = version?.url || material.fileUrl;
    setBusyAction("open");
    setActionError("");
    try {
      if (onOpenMaterial) {
        await onOpenMaterial({ ...material, fileUrl, db: { ...(material.db || {}), storagePath } });
      } else if (fileUrl) {
        const opened = window.open("about:blank", "_blank");
        if (!opened) throw new Error("El navegador bloqueó la pestaña del archivo.");
        opened.opener = null;
        opened.location.replace(fileUrl);
      } else {
        throw new Error("Este registro local no tiene un archivo de muestra asociado.");
      }
    } catch (openFailure) {
      setActionError(openFailure?.message || "No se pudo abrir el archivo.");
    } finally {
      setBusyAction("");
    }
  }

  const start = filteredMaterials.length ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, filteredMaterials.length);
  const hasActiveFilters = Boolean(query || statusFilter !== "all" || originFilter !== "all");
  const hasScopeMaterials = scopedMaterials.length > 0;
  const materialHeading = details.course?.id === "section"
    ? "Materiales del aula"
    : details.course ? `Materiales de ${details.course.name}` : "Selecciona un curso";

  return (
    <section className={isTeacher ? "mx-auto w-full max-w-[1240px] pb-14 text-ink" : "w-full text-ink"} data-role={roleKey} aria-busy={loading}>
      <div className="mb-[22px] grid gap-6 md:mb-[30px] md:flex md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-3xl font-extrabold leading-tight tracking-[-0.045em] text-[#14231e] sm:text-4xl">
            Gestión de materiales
          </h1>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-muted md:mt-2 md:text-[14px]">
            {isTeacher ? "Elige tu curso y sección para subir y publicar materiales para tus estudiantes." : "Organiza, publica y distribuye recursos por nivel, grado, sección y curso."}
          </p>
        </div>
        {canAccessCreate ? (
          <button
            type="button"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[5px] bg-[#f3bd24] px-5 text-xs font-extrabold text-brand-950 hover:bg-[#ffd34f] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            onClick={() => setDialog({ type: "create" })}
            disabled={!permissions.canCreate}
            title={!destinationReady ? "Primero selecciona un curso" : "Registrar un material"}
          >
            <Plus className="h-[19px] w-[19px] md:h-[17px] md:w-[17px]" /> Nuevo material
          </button>
        ) : null}
      </div>

      {error || actionError ? (
        <div className="mb-[18px] -mt-3 flex min-h-[54px] items-start gap-3 border border-[#efb0ad] bg-red-soft p-[12px_14px] text-[12px] text-[#8f2020]" role="alert">
          <CircleAlert className="w-[19px] flex-none" />
          <span className="grid gap-1 leading-[1.45]">
            <strong>{actionError ? "No pudimos guardar el cambio" : "No pudimos completar la consulta"}</strong>
            {String(actionError || error?.message || error)}
            {error && onRetry ? <button type="button" className="text-left font-bold underline" onClick={onRetry}>Volver a cargar materiales</button> : null}
          </span>
        </div>
      ) : null}

      {!loading && (!years.length || !structure.length) ? (
        <div className="grid min-h-[430px] place-content-center justify-items-center rounded-[8px] border border-line-strong bg-white p-7 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-900">
            <GraduationCap className="h-6 w-6" />
          </span>
          <h2 className="mb-1 mt-4 text-[18px] font-extrabold tracking-[-0.025em]">{isTeacher ? "Aún no tienes cursos disponibles" : "Primero configura la estructura académica"}</h2>
          <p className="m-0 max-w-[430px] text-[11px] leading-relaxed text-muted">{isTeacher ? "Dirección o Coordinación Académica debe asignarte un curso para que puedas gestionar sus materiales." : "Aún no existe un año lectivo con niveles, grados y secciones."}</p>
          {onStartSetup && !isTeacher ? (
            <button type="button" onClick={onStartSetup} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-brand-900 bg-brand-900 px-5 text-[11px] font-extrabold text-white hover:bg-brand-950">
              <CalendarDays className="h-4 w-4" /> Ir al panel de Dirección
            </button>
          ) : null}
        </div>
      ) : (
      <>

      <div
        className="relative mb-5 grid gap-3 overflow-hidden rounded-[8px] border border-line-strong bg-white p-4 pt-5 shadow-[0_8px_24px_rgba(4,58,44,0.035)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[linear-gradient(90deg,#047857_0_55%,#f3bd24_55%_78%,#2387b7_78%)] sm:grid-cols-2 xl:grid-cols-[1.08fr_1fr_0.72fr_0.88fr_1.12fr] xl:p-[18px] xl:pt-[22px]"
        aria-label="Ubicación académica"
      >
        <SelectControl
          icon={CalendarDays}
          label="Año académico"
          value={selection.year}
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
          onChange={(year) => changeSelection({ year })}
        />
        <SelectControl
          icon={Building2}
          label="Nivel"
          value={details.level?.id || ""}
          options={structure.map((level) => ({ value: level.id, label: level.name }))}
          onChange={changeLevel}
        />
        <SelectControl
          icon={GraduationCap}
          label="Grado"
          value={details.grade?.id || ""}
          options={(details.level?.grades || EMPTY_ARRAY).map((grade) => ({ value: grade.id, label: grade.shortName || grade.name }))}
          onChange={changeGrade}
        />
        <SelectControl
          icon={Users}
          label="Sección"
          value={details.section?.id || ""}
          options={(details.grade?.sections || EMPTY_ARRAY).map((section) => ({ value: section.id, label: `Sección ${section.name}` }))}
          onChange={changeSection}
        />
        <SelectControl
          icon={BookOpen}
          label="Curso"
          value={details.course?.id || ""}
          options={[{ value: "", label: "Selecciona un curso" }, ...(details.section?.courses || EMPTY_ARRAY).map((course) => ({ value: course.id, label: course.name }))]}
          onChange={(courseId) => changeSelection({ courseId })}
        />
      </div>

      {!destinationReady && details.section?.id ? (
        <div className="mb-5 flex flex-col gap-3 rounded-[8px] border border-[#b7d7ea] bg-[#f3f9fc] p-4 text-[#176d9f] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white"><BookOpen className="h-4 w-4" /></span>
            <div>
              <strong className="block text-[11px] text-[#124f74]">{details.section.courses.length ? "Primero elige el curso" : "Este salón todavía no tiene cursos disponibles"}</strong>
              <p className="mb-0 mt-1 text-[10px] leading-relaxed text-[#3c6c86]">{details.section.courses.length ? "Selecciona el curso en el filtro de arriba. Luego podrás adjuntar el archivo con el destino correcto." : "Se necesita una asignación vigente para habilitar la carga de materiales."}</p>
            </div>
          </div>
          {onConfigureCourses ? (
            <button type="button" onClick={onConfigureCourses} className="min-h-10 shrink-0 rounded-[5px] border border-[#237db3] bg-white px-4 text-[10px] font-extrabold text-[#176d9f] hover:bg-[#eaf6fc]">Configurar cursos</button>
          ) : null}
        </div>
      ) : null}

      <div className={`grid min-h-[430px] items-stretch gap-4 ${inspectorOpen && selectedMaterial ? "2xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
        <section className="relative flex min-w-0 flex-col overflow-visible rounded-[8px] border border-line-strong bg-surface shadow-[0_8px_24px_rgba(4,58,44,0.03)]">
          <header className="flex min-h-[60px] items-center justify-between gap-[14px] border-b border-line px-4 md:px-5">
            <div className="min-w-0">
              <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-extrabold tracking-[-0.025em] text-[#121a17]">
                {materialHeading}
              </h2>
              <p className="mb-0 mt-0.5 text-[10px] text-muted">{details.grade?.name || "Grado"} · Sección {details.section?.name || "—"}</p>
            </div>
            {hasScopeMaterials || hasActiveFilters ? (
            <div className="flex items-center gap-[4px] md:gap-[7px]">
              <div className="relative">
                <button
                  type="button"
                  className={`relative h-10 w-10 md:h-9 md:w-9 ${ICON_BUTTON_CLASS}`}
                  aria-label="Filtrar materiales"
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen((current) => !current)}
                >
                  <Filter className="h-[18px] w-[18px] stroke-[1.8]" />
                  {hasActiveFilters ? (
                    <i aria-hidden="true" className="absolute right-[5px] top-[5px] h-[6px] w-[6px] rounded-full bg-[#d78500]" />
                  ) : null}
                </button>
                {filterOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 grid w-[220px] gap-3 rounded-[6px] border border-line-strong bg-white p-[15px] shadow-[0_16px_38px_rgba(7,51,39,0.14)] md:fixed md:inset-x-4 md:bottom-[18px] md:top-auto md:w-auto md:rounded-xl md:p-[18px] md:shadow-[0_18px_60px_rgba(3,45,33,0.24)]">
                    <strong className="text-[12px]">Filtrar materiales</strong>
                    <label className="grid gap-[6px]">
                      <span className="text-[10px] font-bold text-muted">Estado</span>
                      <select
                        className="h-[38px] w-full rounded border border-line bg-white px-[9px] text-[11px] text-ink"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                      >
                        <option value="all">Todos</option>
                        <option value="published">Publicado</option>
                        <option value="draft">Borrador</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </label>
                    <label className="grid gap-[6px]">
                      <span className="text-[10px] font-bold text-muted">Origen</span>
                      <select
                        className="h-[38px] w-full rounded border border-line bg-white px-[9px] text-[11px] text-ink"
                        value={originFilter}
                        onChange={(event) => setOriginFilter(event.target.value)}
                      >
                        <option value="all">Todos</option>
                        <option value="institucional">Institucional</option>
                        <option value="docente">Docente</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="min-h-[34px] border-0 bg-brand-50 text-[10px] font-bold text-brand-800"
                      onClick={() => {
                        setStatusFilter("all");
                        setOriginFilter("all");
                      }}
                    >
                      Limpiar filtros
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={`hidden h-9 w-9 md:inline-grid ${ICON_BUTTON_CLASS}`}
                aria-label={inspectorOpen ? "Ocultar panel de detalle" : "Mostrar panel de detalle"}
                onClick={() => setInspectorOpen((current) => !current)}
                disabled={!selectedMaterial}
              >
                <LayoutList className="h-[18px] w-[18px] stroke-[1.8]" />
              </button>
              <button
                type="button"
                className={`hidden h-9 w-9 md:inline-grid ${ICON_BUTTON_CLASS}`}
                aria-label="Restablecer vista"
                onClick={resetView}
              >
                <RefreshCw className="h-[18px] w-[18px] stroke-[1.8]" />
              </button>
            </div>
            ) : null}
          </header>

          {hasScopeMaterials || hasActiveFilters ? <label className="mx-4 my-3 flex h-11 items-center gap-[9px] rounded-[5px] border border-line-strong bg-white px-3 text-muted md:mx-5">
            <Search aria-hidden="true" className="w-[18px] flex-none" />
            <span className="sr-only">Buscar materiales</span>
            <input
              type="search"
              className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-ink outline-none md:text-[12px]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar materiales..."
            />
            {query ? (
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-50"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X className="w-[15px]" />
              </button>
            ) : null}
          </label> : null}

          {loading ? (
            <LoadingState />
          ) : error ? <p className="p-6 text-sm text-muted">No se pudo consultar la lista. Vuelve a cargar los materiales.</p> : pageMaterials.length ? (
            <>
              <MaterialTable
                materials={pageMaterials}
                selectedId={selectedId}
                menuFor={menuFor}
                onMenu={setMenuFor}
                onSelect={selectMaterial}
                permissions={permissions}
                onEdit={(material) => {
                  setMenuFor(null);
                  setDialog({ type: "edit", material });
                }}
                onPublish={publishMaterial}
                onArchive={archiveMaterial}
              />
              <MaterialCards materials={pageMaterials} selectedId={selectedId} onSelect={selectMaterial} />
            </>
          ) : (
            <EmptyState canCreate={permissions.canCreate} onCreate={() => setDialog({ type: "create" })} hasFilters={hasActiveFilters} missingCourse={!destinationReady} hasCourses={Boolean(details.section?.courses?.length)} />
          )}

          {hasScopeMaterials || hasActiveFilters ? <footer className="mt-auto grid grid-cols-[1fr_auto] items-center gap-[10px] border-t border-line px-3 py-2 md:grid-cols-[1fr_auto_1fr]">
            <span className="hidden text-[9px] text-muted md:inline">
              Mostrando {start} a {end} de {filteredMaterials.length} materiales
            </span>
            <nav aria-label="Paginación de materiales" className="flex items-center gap-1 justify-self-start">
              <button
                type="button"
                aria-label="Primera página"
                className="grid h-[30px] w-[30px] place-items-center rounded text-muted hover:bg-brand-50 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="w-[14px]" />
              </button>
              <button
                type="button"
                aria-label="Página anterior"
                className="grid h-[30px] w-[30px] place-items-center rounded text-muted hover:bg-brand-50 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="w-[14px]" />
              </button>
              <span aria-current="page" className="grid h-[30px] w-[30px] place-items-center rounded border border-brand-700 text-[10px] font-bold text-brand-800">
                {page}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                className="grid h-[30px] w-[30px] place-items-center rounded text-muted hover:bg-brand-50 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={page === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight className="w-[14px]" />
              </button>
              <button
                type="button"
                aria-label="Última página"
                className="grid h-[30px] w-[30px] place-items-center rounded text-muted hover:bg-brand-50 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="w-[14px]" />
              </button>
            </nav>
            <div className="justify-self-end md:w-[118px]">
              <SelectControl
                icon={SlidersHorizontal}
                compact
                label="Resultados por página"
                value={String(pageSize)}
                options={[10, 20, 50].map((size) => ({ value: String(size), label: `${size} por página` }))}
                onChange={(value) => setPageSize(Number(value))}
              />
            </div>
          </footer> : null}
        </section>

        {inspectorOpen && selectedMaterial ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[140] block border-0 bg-[rgba(1,30,22,0.48)] 2xl:hidden"
              aria-label="Cerrar detalle"
              onClick={() => setInspectorOpen(false)}
            />
            <MaterialInspector
              material={selectedMaterial}
              permissions={permissions}
              busyAction={busyAction}
              onClose={() => setInspectorOpen(false)}
              onEdit={(material) => setDialog({ type: "edit", material })}
              onVersion={(material) => setDialog({ type: "version", material })}
              onPublish={publishMaterial}
              onArchive={archiveMaterial}
              onDistribution={(material) => setDialog({ type: "distribution", material })}
              onOpenMaterial={openMaterialFile}
            />
          </>
        ) : null}
      </div>
      </>
      )}

      <div className="fixed bottom-[14px] left-[14px] right-[14px] z-[260] pointer-events-none md:bottom-6 md:left-auto md:right-6" role="status" aria-live="polite" aria-atomic="true">
        {notice ? (
          <span className="flex min-h-12 items-center justify-center gap-[9px] rounded-[6px] border border-[#99c9b5] bg-white px-[15px] text-[11px] font-bold text-brand-800 shadow-[0_15px_38px_rgba(3,49,36,0.18)] md:justify-start">
            <Check className="w-[18px]" /> {notice}
          </span>
        ) : null}
      </div>

      {dialog?.type === "create" || dialog?.type === "edit" ? (
        <MaterialFormDialog
          mode={dialog.type}
          material={dialog.material}
          structure={structure}
          years={years}
          selection={selection}
          role={role}
          busy={busyAction === "create" || busyAction === "update"}
          submitError={actionError}
          onClose={() => setDialog(null)}
          onSubmit={dialog.type === "edit" ? updateMaterial : createMaterial}
        />
      ) : null}
      {dialog?.type === "version" ? (
        <VersionDialog material={dialog.material} busy={busyAction === "version"} onClose={() => setDialog(null)} onSubmit={uploadVersion} />
      ) : null}
      {dialog?.type === "distribution" ? (
        <DistributionDialog material={dialog.material} busy={busyAction === "distribution"} onClose={() => setDialog(null)} onSubmit={saveDistribution} />
      ) : null}
    </section>
  );
}

export default MaterialsManagement;
