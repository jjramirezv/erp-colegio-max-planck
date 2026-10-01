import { useCallback, useEffect, useState } from "react";
import { demoUsers, roleModules } from "./data";
import { PortalModule } from "./Modules";
import { getCurrentPortalUser, signInPortal, signOutPortal } from "./lib/portalAuth";
import { authLinkError, isDemoAuthEnabled, isSupabaseConfigured, recoveryInUrl, supabase } from "./lib/supabase";
import Brand from "./features/shell/Brand";
import Login from "./features/shell/Login";
import ResetPassword from "./features/shell/ResetPassword";
import Sidebar from "./features/shell/Sidebar";
import Header from "./features/shell/Header";
import FeaturedAnnouncement from "./features/announcements/FeaturedAnnouncement";
import Dashboard from "./features/shell/Dashboard";
import UserManagement from "./features/users/UserManagement";
import { DEFAULT_PUBLIC_BRAND, loadPublicInstitutionalBrand } from "./features/institution/identityApi";
import { DEFAULT_GENERAL_SETTINGS, loadGeneralSettings } from "./features/general-settings/generalSettingsApi";

const getStoredUsers = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("mp-users"));
    if (!stored) return demoUsers;
    if (stored.some((user) => user.role === "coordinador_academico")) return stored;
    return [...stored, demoUsers.find((user) => user.role === "coordinador_academico")];
  } catch { return demoUsers; }
};
const getStoredPermissions = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("mp-role-permissions-v1"));
    if (!stored) return roleModules;
    return Object.fromEntries(Object.entries(roleModules).map(([role, supported]) => {
      // Amplía el menú anterior predeterminado; conserva las selecciones personalizadas.
      const previous = ["Inicio", "Mis cursos", "Horario", "Calificaciones", "Calendario"];
      const upgradeStudent = role === "estudiante" && stored[role]?.length === previous.length && previous.every((item) => stored[role].includes(item));
      return [role, ["direccion", "coordinador_academico", "familia"].includes(role) || upgradeStudent ? supported : (stored[role] || supported).filter((module) => supported.includes(module))];
    }));
  } catch { return roleModules; }
};

export default function App() {
  const [users, setUsers] = useState(getStoredUsers);
  const [session, setSession] = useState(() => {
    if (isSupabaseConfigured || !isDemoAuthEnabled) return null;
    try { return JSON.parse(sessionStorage.getItem("mp-session")); } catch { return null; }
  });
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(recoveryInUrl);
  const [loginNotice, setLoginNotice] = useState(authLinkError);
  // Supabase avisa cuando la sesión proviene de un enlace de recuperación.
  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (authLinkError) window.history.replaceState(null, "", window.location.pathname); }, []);
  const [active, setActive] = useState("Inicio");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modulePermissions, setModulePermissions] = useState(getStoredPermissions);
  const [institutionIdentity, setInstitutionIdentity] = useState(DEFAULT_PUBLIC_BRAND);
  const [generalSettings, setGeneralSettings] = useState(DEFAULT_GENERAL_SETTINGS);
  const logout = useCallback(async () => {
    try { await signOutPortal(); }
    finally { setSession(null); sessionStorage.removeItem("mp-session"); setActive("Inicio"); }
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;
    loadPublicInstitutionalBrand()
      .then((identity) => { if (mounted) setInstitutionIdentity(identity); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!session || !isSupabaseConfigured) return undefined;
    let mounted = true;
    loadGeneralSettings().then((settings) => { if (mounted) setGeneralSettings(settings); }).catch(() => {});
    const update = (event) => { if (event.detail) setGeneralSettings(event.detail); };
    window.addEventListener("mp-general-settings-updated", update);
    return () => { mounted = false; window.removeEventListener("mp-general-settings-updated", update); };
  }, [session]);
  useEffect(() => {
    if (!session || !generalSettings.sessionTimeoutMinutes) return undefined;
    let timeout;
    const reset = () => { window.clearTimeout(timeout); timeout = window.setTimeout(() => { logout(); }, generalSettings.sessionTimeoutMinutes * 60 * 1000); };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, reset, { passive: true }));
    reset();
    return () => { window.clearTimeout(timeout); events.forEach((eventName) => window.removeEventListener(eventName, reset)); };
  }, [generalSettings.sessionTimeoutMinutes, logout, session]);
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;
    getCurrentPortalUser()
      .then((user) => { if (mounted) setSession(user); })
      .catch(() => { if (mounted) setSession(null); })
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);
  const login = async ({ email, password }) => {
    if (isSupabaseConfigured) {
      const user = await signInPortal(email, password);
      setSession(user);
      setActive(roleModules[user.role]?.[0] || "Inicio");
      return;
    }
    if (!isDemoAuthEnabled) throw new Error("El portal todavía no tiene configuradas sus credenciales de Supabase.");
    const user = users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password && item.status === "Activo");
    if (!user) throw new Error("Credenciales incorrectas o cuenta inactiva.");
    setSession(user);
    setActive(roleModules[user.role]?.[0] || "Inicio");
    sessionStorage.setItem("mp-session", JSON.stringify(user));
  };
  const updateUsers = (next) => { setUsers(next); localStorage.setItem("mp-users", JSON.stringify(next)); };
  const updatePermissions = (next) => { setModulePermissions(next); localStorage.setItem("mp-role-permissions-v1", JSON.stringify(next)); };
  if (authLoading) {
    return (
      <div className="grid min-h-screen place-content-center justify-items-center gap-5 bg-canvas text-[13px] text-muted after:h-7 after:w-7 after:animate-spin after:rounded-full after:border-[3px] after:border-[#cfe1db] after:border-t-brand-800 after:content-['']">
        <Brand identity={institutionIdentity} onOpenAnnouncements={() => { if (window.dispatchEvent(new Event("mp-before-navigation", { cancelable: true }))) { setActive("Comunicados"); setMobileOpen(false); } }} />
        <span>Verificando acceso seguro…</span>
      </div>
    );
  }
  if (recovery) return <ResetPassword identity={institutionIdentity} onDone={(message) => { setRecovery(false); setSession(null); setLoginNotice(message); }} />;
  if (!session) return <Login notice={loginNotice} onLogin={login} showDemo={!isSupabaseConfigured && isDemoAuthEnabled} identity={institutionIdentity} />;
  const modules = modulePermissions[session.role] || ["Inicio"];
  const activeModule = modules.includes(active) ? active : modules[0] || "Inicio";
  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <Sidebar user={session} modules={modules} active={activeModule} onSelect={(item) => { if (!window.dispatchEvent(new Event("mp-before-navigation", { cancelable: true }))) return; setActive(item); setMobileOpen(false); }} open={mobileOpen} onClose={() => setMobileOpen(false)} identity={institutionIdentity} />
      <div className="min-w-0">
        <Header user={session} onMenu={() => setMobileOpen(true)} onLogout={() => { if (window.dispatchEvent(new Event("mp-before-navigation", { cancelable: true }))) logout(); }} identity={institutionIdentity} />
        <main className={`mx-auto p-6 md:p-[34px] ${session.role === "estudiante" ? "max-w-[1510px]" : "max-w-[1500px]"}`}>
          {activeModule === "Inicio" && !["familia", "estudiante", "docente"].includes(session.role) ? (
            <Dashboard user={session} onNavigate={setActive} />
          ) : activeModule === "Usuarios" && session.role === "direccion" ? (
            <UserManagement users={users} currentUser={session} onChange={updateUsers} remote={session.authSource === "supabase"} />
          ) : (
            <PortalModule
              module={activeModule}
              user={session}
              permissions={modulePermissions}
              onPermissionsChange={updatePermissions}
              onNavigate={setActive}
              onInstitutionIdentityChange={setInstitutionIdentity}
            />
          )}
        </main>
      </div>
      {session.authSource === "supabase" ? <FeaturedAnnouncement user={session} onOpenAll={() => setActive("Comunicados")} /> : null}
    </div>
  );
}
