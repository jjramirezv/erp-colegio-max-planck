// Genera el portable y el instalador de Windows.
// Se empaqueta fuera del proyecto porque el vigilante de archivos del editor bloquea la carpeta
// (EPERM al renombrar) y luego se copian los .exe a release/.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const temp = path.join(os.tmpdir(), "mp-release");
const release = path.join(root, "release");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE; // VS Code la define y rompe Electron.

fs.rmSync(temp, { recursive: true, force: true });
execSync("npx vite build", { cwd: root, stdio: "inherit", env });
execSync(`npx electron-builder --win "-c.directories.output=${temp}"`, { cwd: root, stdio: "inherit", env });
fs.mkdirSync(release, { recursive: true });
for (const file of fs.readdirSync(temp).filter((name) => name.endsWith(".exe"))) {
  fs.copyFileSync(path.join(temp, file), path.join(release, file));
  console.log(`✓ ${path.join("release", file)}`);
}
