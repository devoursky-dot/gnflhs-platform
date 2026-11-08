import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function run(cmd, cwd) {
  console.log(`\n> [EXEC] ${cmd} (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('=== GNFLHS PLATFORM UNIFIED BUILD & BUNDLE ===');

// Clean dist folders
for (const app of ['portal', 'whiteboard-note', 'account-manager', 'dormitory-penalty']) {
  const d = path.join(rootDir, 'apps', app, 'dist');
  if (fs.existsSync(d)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

// 1. Build all 4 apps
run('npm run build', path.join(rootDir, 'apps', 'portal'));
run('npm run build', path.join(rootDir, 'apps', 'whiteboard-note'));
run('npm run build', path.join(rootDir, 'apps', 'account-manager'));
run('npm run build', path.join(rootDir, 'apps', 'dormitory-penalty'));

// 2. Bundle into apps/portal/dist
const portalDist = path.join(rootDir, 'apps', 'portal', 'dist');

console.log('\n> Bundling sub-apps into portal/dist for unified single-domain hosting...');
copyDir(path.join(rootDir, 'apps', 'whiteboard-note', 'dist'), path.join(portalDist, 'whiteboard'));
copyDir(path.join(rootDir, 'apps', 'account-manager', 'dist'), path.join(portalDist, 'account'));
copyDir(path.join(rootDir, 'apps', 'dormitory-penalty', 'dist'), path.join(portalDist, 'dormitory'));

console.log('\n✓ Unified bundle completed successfully!');
