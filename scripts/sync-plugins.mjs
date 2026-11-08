import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pluginsDir = path.join(rootDir, 'plugins');

const firebaseConfig = {
  apiKey: "AIzaSyDxEM9YQx18vLISdcWOoGrOhTc6nUCXJKI",
  authDomain: "gnflhs.firebaseapp.com",
  projectId: "gnflhs",
  storageBucket: "gnflhs.firebasestorage.app",
  messagingSenderId: "738264910794",
  appId: "1:738264910794:web:67cb40366fd32943e6dd33"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const [,, cmd = 'list', targetId] = process.argv;

function getLocalPluginDirs() {
  if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
  return fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function readLocalPluginFiles(pluginId) {
  const dir = path.join(pluginsDir, pluginId);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile() && !e.name.startsWith('.')) {
      files.push({
        name: e.name,
        content: fs.readFileSync(path.join(dir, e.name), 'utf8')
      });
    }
  }
  return files;
}

function writeLocalPluginFiles(pluginId, files) {
  const dir = path.join(pluginsDir, pluginId);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    fs.writeFileSync(path.join(dir, f.name), f.content, 'utf8');
  }
}

async function handlePush(idFilter) {
  console.log(`\n=== PUSH LOCAL PLUGINS -> FIRESTORE ===`);
  const dirs = getLocalPluginDirs();
  const targets = idFilter ? dirs.filter(d => d === idFilter) : dirs;

  if (targets.length === 0) {
    console.log(`No local plugin matching '${idFilter || '*'}' in ${pluginsDir}`);
    return;
  }

  for (const pid of targets) {
    const files = readLocalPluginFiles(pid);
    if (files.length === 0) continue;

    console.log(`> Pushing '${pid}' (${files.length} files: ${files.map(f => f.name).join(', ')})...`);

    // 1. studio_projects 컬렉션 동기화
    const projRef = doc(db, 'studio_projects', `proj-${pid}`);
    const existingSnap = await getDoc(projRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};

    const projectPayload = {
      ...existingData,
      id: `proj-${pid}`,
      name: existingData.name || pid,
      description: existingData.description || `로컬 ${pid} 플러그인`,
      icon: existingData.icon || 'Puzzle',
      category: existingData.category || 'utility',
      files,
      scriptProperties: existingData.scriptProperties || { SCHOOL_NAME: '경남외국어고등학교' },
      updatedAt: Date.now()
    };
    await setDoc(projRef, projectPayload, { merge: true });

    // 2. plugins 컬렉션에도 핫스왑 파일 동기화
    const pluginDocRef = doc(db, 'plugins', pid);
    const pluginSnap = await getDoc(pluginDocRef);
    if (pluginSnap.exists()) {
      await setDoc(pluginDocRef, {
        files,
        updatedAt: Date.now()
      }, { merge: true });
    }

    console.log(`  ✓ Synced '${pid}' to Firestore studio_projects & plugins.`);
  }
  console.log('\n✓ Push completed successfully.');
}

async function handlePull(idFilter) {
  console.log(`\n=== PULL FIRESTORE -> LOCAL PLUGINS ===`);
  const colRef = collection(db, 'plugins');
  const snap = await getDocs(colRef);

  snap.forEach((d) => {
    const data = d.data();
    const pid = data.id || d.id;
    if (idFilter && pid !== idFilter) return;

    if (data.files && data.files.length > 0) {
      console.log(`> Pulling plugin '${pid}' (${data.files.length} files)...`);
      writeLocalPluginFiles(pid, data.files);
    } else if (data.customCode) {
      console.log(`> Pulling plugin '${pid}' (inline customCode)...`);
      writeLocalPluginFiles(pid, [
        { name: 'index.html', content: data.customCode },
        { name: 'script.js', content: '// script' },
        { name: 'style.css', content: '/* css */' }
      ]);
    }
  });

  const studioColRef = collection(db, 'studio_projects');
  const studioSnap = await getDocs(studioColRef);
  studioSnap.forEach((d) => {
    const data = d.data();
    const pid = data.id?.replace(/^proj-/, '') || d.id;
    if (idFilter && pid !== idFilter && data.id !== idFilter) return;
    if (data.files && data.files.length > 0) {
      console.log(`> Pulling studio project '${pid}' (${data.files.length} files)...`);
      writeLocalPluginFiles(pid, data.files);
    }
  });

  console.log('\n✓ Pull completed. Local files in plugins/ updated.');
}

async function handleList() {
  console.log(`\n=== GNFLHS PLUGINS INVENTORY ===`);
  const localDirs = getLocalPluginDirs();
  console.log(`Local directories in plugins/: ${localDirs.join(', ') || 'none'}`);

  const colRef = collection(db, 'plugins');
  const snap = await getDocs(colRef);
  console.log('\nRemote Operating Plugins (plugins):');
  snap.forEach((d) => {
    const p = d.data();
    console.log(` - ${p.id}: ${p.name} (v${p.version}) [status: ${p.status}, files: ${p.files?.length || 0}]`);
  });

  const studioCol = collection(db, 'studio_projects');
  const studioSnap = await getDocs(studioCol);
  console.log('\nRemote Studio Projects (studio_projects):');
  studioSnap.forEach((d) => {
    const sp = d.data();
    console.log(` - ${sp.id}: ${sp.name} [files: ${sp.files?.length || 0}]`);
  });
}

if (cmd === 'push') {
  handlePush(targetId).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else if (cmd === 'pull') {
  handlePull(targetId).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  handleList().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
