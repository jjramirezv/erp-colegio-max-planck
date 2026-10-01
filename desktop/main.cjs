// Aplicación de escritorio del portal: sirve la compilación de Vite desde un servidor local
// (misma experiencia que en el navegador) y se conecta al mismo Supabase.
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const DIST = path.join(__dirname, "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };

// Puerto fijo para conservar la sesión entre aperturas (el almacenamiento depende del origen).
const PORT = 47831;
let server;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const url = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let file = path.normalize(path.join(DIST, url));
      if (!file.startsWith(DIST)) { response.writeHead(403); response.end(); return; }
      // Rutas de la SPA sin archivo: devolver index.html.
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
      response.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(file).pipe(response);
    });
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(`http://127.0.0.1:${PORT}/`));
  });
}

async function createWindow() {
  let origin;
  try { origin = await startServer(); }
  catch (error) {
    // Otra instancia ya usa el puerto: reutilizarla en vez de fallar.
    if (error.code === "EADDRINUSE") origin = `http://127.0.0.1:${PORT}/`;
    else { dialog.showErrorBox("Colegio Max Planck", `No se pudo iniciar el portal: ${error.message}`); app.quit(); return; }
  }
  const window = new BrowserWindow({
    width: 1360, height: 860, minWidth: 380, minHeight: 600,
    title: "Colegio Max Planck", backgroundColor: "#f7faf9", autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.once("ready-to-show", () => window.show());

  // Materiales: el portal abre una pestaña en blanco y luego el archivo firmado; se permite como ventana hija.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || url.startsWith(origin) || /^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(url)) {
      return { action: "allow", overrideBrowserWindowOptions: { width: 1100, height: 820, autoHideMenuBar: true, title: "Material de clase" } };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  // Cualquier navegación fuera del portal se abre en el navegador del sistema.
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) { event.preventDefault(); shell.openExternal(url); }
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    if (code !== -3) dialog.showErrorBox("Colegio Max Planck", `No se pudo cargar el portal (${description}). Revisa tu conexión a internet.`);
  });
  await window.loadURL(origin);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on("window-all-closed", () => { server?.close(); app.quit(); });
}
