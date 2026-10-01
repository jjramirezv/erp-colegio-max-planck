import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StudentMaterialsLibrary } from "./components/StudentMaterialsLibrary";
import TeacherMaterials from "./TeacherMaterials";
import { isSupabaseConfigured } from "../../lib/supabase";
import { MaterialsManagement } from "./MaterialsManagement";
import {
  archiveMaterial,
  createMaterial,
  createMaterialSignedUrl,
  loadMaterialsWorkspace,
  publishMaterial,
  savePhysicalDistribution,
  subscribeToMaterialChanges,
  updateMaterial,
  uploadMaterialVersion,
} from "./materialsApi";

function isRemoteSession(user) {
  return isSupabaseConfigured && user?.authSource === "supabase";
}

async function openSignedMaterialInNewTab(material) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("El navegador bloqueó la pestaña. Habilita las ventanas emergentes para abrir el archivo.");
  tab.opener = null;
  try {
    const url = await createMaterialSignedUrl(material);
    tab.location.replace(url);
    return url;
  } catch (failure) {
    tab.close();
    throw failure;
  }
}

/**
 * Capa de datos/rol sobre MaterialsManagement: carga el workspace desde
 * Supabase (o conserva un estado vacío en desarrollo), se suscribe a cambios en
 * tiempo real y deriva la rama de UI correcta según el rol de la persona.
 */
export default function MaterialsFeature({ user, onNavigate }) {
  const remote = isRemoteSession(user);
  const [data, setData] = useState(() => remote ? null : { years: [], defaultSelection: {}, academicStructure: [], materials: [] });
  const [loading, setLoading] = useState(remote);
  const [error, setError] = useState("");
  const refreshTimer = useRef(null);

  const refresh = useCallback(async () => {
    if (!remote) return;
    setLoading(true);
    setError("");
    try {
      setData(await loadMaterialsWorkspace(user));
    } catch (failure) {
      setError(failure.message || "No se pudo cargar la gestión de materiales.");
    } finally {
      setLoading(false);
    }
  }, [remote, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!remote) return undefined;
    return subscribeToMaterialChanges(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(refresh, 250);
    });
  }, [refresh, remote]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const runAndRefresh = useCallback(
    (operation) => async (payload) => {
      const result = await operation(payload, user);
      await refresh();
      return result;
    },
    [refresh, user],
  );

  const resolvedData = data || { years: [], defaultSelection: {}, academicStructure: [], materials: [] };
  if (user.role === "estudiante") {
    return <StudentMaterialsLibrary data={resolvedData} loading={loading} error={error} remote={remote} onOpenMaterial={openSignedMaterialInNewTab} />;
  }

  if (user.role === "docente" && remote) {
    return <TeacherMaterials data={resolvedData} loading={loading} error={error || null} onRetry={refresh}
      onCreate={runAndRefresh(createMaterial)} onUpdate={runAndRefresh(updateMaterial)} onArchive={runAndRefresh(archiveMaterial)}
      onPublish={runAndRefresh(publishMaterial)} onUploadVersion={runAndRefresh(uploadMaterialVersion)} onOpenMaterial={openSignedMaterialInNewTab} />;
  }

  return (
    <>
      {!remote ? (
        <div className="mb-4 flex items-start gap-[10px] border border-[#e2b85e] bg-[#fff9e9] p-[12px_14px] text-[12px] leading-[1.5] text-[#704c05]">
          <AlertCircle className="mt-[1px] h-[18px] w-[18px] flex-none" />
          <span>
            <strong>Vista local de desarrollo.</strong> La interfaz está lista; para sincronizar cambios entre cuentas falta
            habilitar las tablas y perfiles en Supabase.
          </span>
        </div>
      ) : null}
      <MaterialsManagement
        data={resolvedData}
        loading={loading}
        error={error || null}
        onRetry={refresh}
        role={user.role}
        onCreate={remote ? runAndRefresh(createMaterial) : undefined}
        onUpdate={remote ? runAndRefresh(updateMaterial) : undefined}
        onArchive={remote ? runAndRefresh(archiveMaterial) : undefined}
        onPublish={remote ? runAndRefresh(publishMaterial) : undefined}
        onUploadVersion={remote ? runAndRefresh(uploadMaterialVersion) : undefined}
        onSaveDistribution={remote ? runAndRefresh(savePhysicalDistribution) : undefined}
        onOpenMaterial={remote ? openSignedMaterialInNewTab : undefined}
        onStartSetup={() => onNavigate?.("Inicio")}
        onConfigureCourses={user.role === "direccion" ? () => onNavigate?.("Gestión de áreas curriculares y cursos") : undefined}
      />
    </>
  );
}
