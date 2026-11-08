import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pluginsDir = path.join(rootDir, 'plugins');

const firebaseConfig = {
  apiKey: 'AIzaSyDxEM9YQx18vLISdcWOoGrOhTc6nUCXJKI',
  authDomain: 'gnflhs.firebaseapp.com',
  projectId: 'gnflhs',
  storageBucket: 'gnflhs.firebasestorage.app',
  messagingSenderId: '738264910794',
  appId: '1:738264910794:web:67cb40366fd32943e6dd33'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// 최고관리자 전용 시스템 콘솔은 일반 배포 카탈로그(plugins) 등록을 원천 차단
const RESERVED_SYSTEM_IDS = ['account-manager'];

const DEFAULT_SCRIPT_PROPERTIES = {
  SCHOOL_NAME: '경남외국어고등학교',
  UI_PC_COLS: '3',
  UI_TABLET_COLS: '2',
  UI_MOBILE_COLS: '1',
  UI_TABLET_SHOW_DETAIL: 'true',
  UI_TABLET_SHOW_SIDEBAR: 'false',
  UI_MOBILE_SHOW_DETAIL: 'false',
  UI_MOBILE_SHOW_SIDEBAR: 'false'
};

const DEFAULT_LIBRARIES = [
  { libraryId: 'gnflhs-core-sdk', version: 'HEAD', enabled: true, identifier: 'GNFLHS' },
  { libraryId: 'gnflhs-ui-kit', version: 'HEAD', enabled: true, identifier: 'GNUI' },
  { libraryId: 'gnflhs-print-kit', version: 'HEAD', enabled: true, identifier: 'GNPrint' },
  { libraryId: 'gnflhs-canvas-kit', version: 'HEAD', enabled: true, identifier: 'GNCanvas' },
  { libraryId: 'gnflhs-storage-bridge', version: '1.0.0', enabled: true, identifier: 'GNStorage' },
  { libraryId: 'gnflhs-icons-mini', version: '1.0.0', enabled: true, identifier: 'GNIcons' }
];

const DEFAULT_SERVICES = [
  'PropertiesService',
  'CacheService',
  'FirestoreDB',
  'CloudStorage',
  'ResponsiveViewport'
];

const DEFAULT_RUNTIME_CONFIG = {
  runtimeVersion: 'V8',
  timeZone: 'Asia/Seoul',
  showManifest: true,
  cacheEnabled: true,
  cacheTtlSec: 300
};

const OFFICIAL_PLUGIN_META = {
  whiteboard: {
    id: 'whiteboard',
    name: '전자칠판 필기 노트',
    description: '2023년식 구형 전자칠판 최적화 & 삼성노트 REA 필압/손떨림 보정 벡터 판서앱',
    icon: 'PenTool',
    category: 'classroom',
    version: '1.1.0',
    entryUrl: '/plugin/whiteboard',
    allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
    studioProjectId: 'proj-whiteboard',
    note: 'V2 ES Module(@gnflhs/canvas) + env.json 정식 배포본 (v1.1.0)'
  },
  'dormitory-penalty': {
    id: 'dormitory-penalty',
    name: '기숙사 상·벌점 관리',
    description: '학생 기숙사 호실별 상점 및 벌점 부여, 통계 조회 독립 모듈',
    icon: 'ShieldAlert',
    category: 'management',
    version: '1.1.0',
    entryUrl: '/plugin/dormitory-penalty',
    allowedRoles: ['super_admin', 'admin', 'teacher'],
    studioProjectId: 'proj-dormitory-penalty',
    note: 'V2 멀티파일 ES Module(./seed.js) + env.json 정식 배포본 (v1.1.0)'
  },
  'seating-chart': {
    id: 'seating-chart',
    name: '좌석배치',
    description: '스마트 좌석배치도 (교실/자습실 단계별 구조 설정, 반 칸 이동 및 A4 가로 1페이지 출력)',
    icon: 'LayoutGrid',
    category: 'classroom',
    version: '1.2.0',
    entryUrl: '/plugin/seating-chart',
    allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
    studioProjectId: 'proj-seating-chart',
    note: 'V2 시맨틱 ID 표준화(seating-chart) + env.json + A4 가로 출력 정식 배포본 (v1.2.0)'
  }
};

function getLocalPluginDirs() {
  if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
  return fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !RESERVED_SYSTEM_IDS.includes(d.name))
    .map((d) => d.name);
}

function extractEnvFromFiles(files) {
  const envFile = files.find((f) => f.name === 'env.json');
  if (!envFile || !envFile.content.trim()) return {};
  try {
    const parsed = JSON.parse(envFile.content);
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined && v !== null) {
        out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function syncEnvJsonFile(files, props) {
  const sorted = {};
  Object.keys(props)
    .sort()
    .forEach((k) => {
      sorted[k] = String(props[k] ?? '');
    });
  const content = JSON.stringify(sorted, null, 2) + '\n';
  if (files.some((f) => f.name === 'env.json')) {
    return files.map((f) => (f.name === 'env.json' ? { ...f, content } : f));
  }
  return [...files, { name: 'env.json', content }];
}

function readLocalPluginFiles(pluginId) {
  const dir = path.join(pluginsDir, pluginId);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile() && !e.name.startsWith('.') && !e.name.endsWith('.md')) {
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

function handleScaffold(pluginId, displayName) {
  if (!pluginId) {
    console.error('Usage: node scripts/sync-plugins.mjs scaffold <app-id> "<App Title>"');
    process.exit(1);
  }
  if (RESERVED_SYSTEM_IDS.includes(pluginId)) {
    console.error(`Error: '${pluginId}' is a reserved Super Admin system ID.`);
    process.exit(1);
  }
  const title = displayName || pluginId;
  const dir = path.join(pluginsDir, pluginId);
  if (fs.existsSync(dir)) {
    console.error(`Directory already exists: ${dir}`);
    process.exit(1);
  }
  fs.mkdirSync(dir, { recursive: true });

  const starterFiles = [
    {
      name: 'index.html',
      content: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="gn-shell">
    <header class="gn-toolbar">
      <div style="display:flex;align-items:center;gap:10px;">
        <h2 id="appTitle" data-env="APP_TITLE" style="margin:0;font-size:19px;">${title}</h2>
        <span id="viewportBadge" class="gn-badge"></span>
      </div>
      <button id="btnAddItem" class="gn-btn gn-btn-primary">+ 항목 추가</button>
    </header>
    <main class="gn-main">
      <section id="cardContainer" class="gn-grid"></section>
    </main>
  </div>
  <script type="module" src="./script.js"></script>
</body>
</html>
`
    },
    {
      name: 'script.js',
      content: `import { env, db } from '@gnflhs/sdk';
import { toast, promptDialog, getDevice, onDeviceChange } from '@gnflhs/ui';
import { DEFAULT_ITEMS } from './state.js';

const itemsCol = db.collection('items_v1');

function syncBadge() {
  const el = document.getElementById('viewportBadge');
  if (el) el.textContent = \`\${env.str('SCHOOL_NAME')} · \${getDevice().toUpperCase()}\`;
}
syncBadge();
onDeviceChange(syncBadge);

async function render() {
  const list = await itemsCol.getAll(DEFAULT_ITEMS);
  document.getElementById('cardContainer').innerHTML = list.map((it) => \`
    <article class="gn-card">
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;">\${it.title}</div>
      <div style="font-size:13px;color:#475569;">\${it.summary}</div>
    </article>
  \`).join('');
}

document.getElementById('btnAddItem').onclick = async () => {
  const title = await promptDialog('추가할 항목 제목을 입력하세요:', '');
  if (!title) return;
  await itemsCol.add({ title, summary: '신규 등록 항목' });
  toast('저장되었습니다.', 'success');
  render();
};

render();
`
    },
    {
      name: 'state.js',
      content: `export const DEFAULT_ITEMS = [
  { id: '1', title: '샘플 카드 1', summary: 'env.json과 ES Module(@gnflhs/*)로 구동됩니다.' }
];
`
    },
    {
      name: 'style.css',
      content: `body {
  margin: 0;
  background: var(--gn-bg, #f8fafc);
  color: var(--gn-text, #0f172a);
  font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", sans-serif;
}
`
    },
    {
      name: 'env.json',
      content:
        JSON.stringify(
          {
            APP_TITLE: title,
            SCHOOL_NAME: '경남외국어고등학교',
            UI_PC_COLS: '3',
            UI_TABLET_COLS: '2',
            UI_MOBILE_COLS: '1'
          },
          null,
          2
        ) + '\n'
    }
  ];

  writeLocalPluginFiles(pluginId, starterFiles);
  console.log(`\n✓ Scaffolded V2 modular plugin at plugins/${pluginId} (${starterFiles.length} files)`);
}

async function syncWorkspaceHead(pid, meta, rawFiles, now) {
  const projRef = doc(db, 'studio_projects', meta.studioProjectId);
  const existingSnap = await getDoc(projRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : {};

  const fileEnv = extractEnvFromFiles(rawFiles);
  const mergedProps = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...(existingData.scriptProperties || {}),
    ...fileEnv
  };
  const files = syncEnvJsonFile(rawFiles, mergedProps);

  const projectPayload = {
    ...existingData,
    id: meta.studioProjectId,
    name: meta.name,
    description: meta.description,
    icon: meta.icon,
    category: meta.category,
    publishedPluginId: meta.id,
    files,
    scriptProperties: mergedProps,
    libraries: DEFAULT_LIBRARIES,
    services: DEFAULT_SERVICES,
    runtimeConfig: DEFAULT_RUNTIME_CONFIG,
    createdAt: existingData.createdAt || now,
    updatedAt: now
  };
  await setDoc(projRef, projectPayload, { merge: true });
  return { files, mergedProps, projectPayload };
}

async function handlePushHeadOnly(idFilter) {
  console.log(`\n=== [STAGE 1] PUSH LOCAL -> STUDIO WORKSPACE (HEAD DRAFT ONLY) ===`);
  const dirs = getLocalPluginDirs();
  const targets = idFilter ? dirs.filter((d) => d === idFilter) : dirs;
  if (targets.length === 0) {
    console.log(`No matching local plugin for '${idFilter || '*'}'`);
    return;
  }

  const now = Date.now();
  for (const pid of targets) {
    if (RESERVED_SYSTEM_IDS.includes(pid)) continue;
    const rawFiles = readLocalPluginFiles(pid);
    if (rawFiles.length === 0) continue;

    const meta = OFFICIAL_PLUGIN_META[pid] || {
      id: pid,
      name: pid,
      description: `${pid} 앱`,
      icon: 'Puzzle',
      category: 'utility',
      version: '1.0.0',
      entryUrl: `/plugin/${pid}`,
      allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
      studioProjectId: `proj-${pid}`,
      note: 'HEAD 작업본 동기화'
    };

    const { files } = await syncWorkspaceHead(pid, meta, rawFiles, now);
    console.log(`  ✓ HEAD synced: studio_projects/${meta.studioProjectId} (${files.length} files, LIVE untouched)`);
  }
}

async function handleOfficialDeploy(idFilter, customVer, customNote) {
  console.log(`\n=== [STAGE 2] OFFICIAL V2 RELEASE: LOCAL -> HEAD + LIVE SNAPSHOT ===`);
  const dirs = getLocalPluginDirs();
  const targets = idFilter ? dirs.filter((d) => d === idFilter) : dirs;

  if (targets.length === 0) {
    console.log(`No local plugin matching '${idFilter || '*'}' in ${pluginsDir}`);
    return;
  }

  const now = Date.now();

  for (const pid of targets) {
    if (RESERVED_SYSTEM_IDS.includes(pid)) {
      console.warn(`  ! Skipping reserved system app '${pid}'`);
      continue;
    }
    const rawFiles = readLocalPluginFiles(pid);
    if (rawFiles.length === 0) continue;

    const baseMeta = OFFICIAL_PLUGIN_META[pid] || {
      id: pid,
      name: extractEnvFromFiles(rawFiles).APP_TITLE || pid,
      description: `${pid} 정식 운영 앱`,
      icon: 'Puzzle',
      category: 'utility',
      version: '1.0.0',
      entryUrl: `/plugin/${pid}`,
      allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
      studioProjectId: `proj-${pid}`,
      note: '정식 운영 배포본'
    };

    const version = customVer || baseMeta.version;
    const note = customNote || baseMeta.note;
    const meta = { ...baseMeta, version, note };

    console.log(`> Releasing '${pid}' -> LIVE plugins/${meta.id} (v${version}) & HEAD studio_projects/${meta.studioProjectId}...`);

    const { files, mergedProps, projectPayload } = await syncWorkspaceHead(pid, meta, rawFiles, now);

    const pluginDocRef = doc(db, 'plugins', meta.id);
    const pluginSnap = await getDoc(pluginDocRef);
    const prevPlugin = pluginSnap.exists() ? pluginSnap.data() : {};

    const deploymentId = `dep-${meta.id}-v${version.replace(/[^a-zA-Z0-9]/g, '')}-${now.toString(36)}`;
    const deploymentSnapshot = {
      deploymentId,
      version,
      deployedAt: now,
      note,
      files,
      scriptProperties: mergedProps,
      libraries: projectPayload.libraries,
      runtimeConfig: projectPayload.runtimeConfig,
      codeType: 'inline_html',
      entryUrl: meta.entryUrl
    };

    const prevDeployments = Array.isArray(prevPlugin.deployments) ? prevPlugin.deployments : [];
    // 동일 버전 스냅샷 중복 방지 후 최대 15개 유지 (1초 롤백용)
    const filteredPrev = prevDeployments.filter((d) => d.version !== version);
    const deployments = [deploymentSnapshot, ...filteredPrev].slice(0, 15);

    const pluginPayload = {
      ...prevPlugin,
      id: meta.id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      category: meta.category,
      version,
      status: 'production',
      entryUrl: meta.entryUrl,
      allowedRoles: meta.allowedRoles,
      codeType: 'inline_html',
      files,
      scriptProperties: mergedProps,
      libraries: projectPayload.libraries,
      runtimeConfig: projectPayload.runtimeConfig,
      activeDeploymentId: deploymentId,
      sourceStudioProjectId: meta.studioProjectId,
      deployments,
      updatedAt: now
    };

    await setDoc(pluginDocRef, pluginPayload);
    console.log(`  ✓ LIVE deployed: plugins/${meta.id} (v${version}, snapshots: ${deployments.length})`);
  }

  console.log('\n✓ Official V2 Deployment completed successfully.');
}

async function handleMigrateClean() {
  console.log(`\n=== V2 FIRESTORE CLEANUP & DATA MIGRATION ===`);

  // 1. plugin_data/app-mw7m26y7/items -> plugin_data/seating-chart/items 무손실 이전
  const legacyItemsCol = collection(db, 'plugin_data', 'app-mw7m26y7', 'items');
  const legacySnap = await getDocs(legacyItemsCol);
  if (!legacySnap.empty) {
    for (const d of legacySnap.docs) {
      const targetRef = doc(db, 'plugin_data', 'seating-chart', 'items', d.id);
      await setDoc(targetRef, d.data(), { merge: true });
      console.log(`  ✓ Migrated user data: plugin_data/app-mw7m26y7/items/${d.id} -> plugin_data/seating-chart/items/${d.id}`);
    }
  } else {
    console.log(`  - No legacy items in plugin_data/app-mw7m26y7/items`);
  }

  // 2. plugins/account-manager 제거 (최고관리자 전용 콘솔로 완전 격리)
  const accRef = doc(db, 'plugins', 'account-manager');
  const accSnap = await getDoc(accRef);
  if (accSnap.exists()) {
    await deleteDoc(accRef);
    console.log(`  ✓ Isolated Super Admin app: deleted plugins/account-manager from public deployable registry`);
  }

  // 3. 구형 난수 ID(app-mw7m26y7 / proj-mw7m26y7) 및 중복 사본 정리
  const oldPluginRef = doc(db, 'plugins', 'app-mw7m26y7');
  if ((await getDoc(oldPluginRef)).exists()) {
    await deleteDoc(oldPluginRef);
    console.log(`  ✓ Removed legacy random-ID plugin: plugins/app-mw7m26y7 (replaced by plugins/seating-chart)`);
  }

  const oldProjRef = doc(db, 'studio_projects', 'proj-mw7m26y7');
  if ((await getDoc(oldProjRef)).exists()) {
    await deleteDoc(oldProjRef);
    console.log(`  ✓ Removed legacy random-ID workspace: studio_projects/proj-mw7m26y7 (replaced by studio_projects/proj-seating-chart)`);
  }

  const studioSnap = await getDocs(collection(db, 'studio_projects'));
  for (const spDoc of studioSnap.docs) {
    const sp = spDoc.data();
    if (String(sp.name || '').includes('(사본)') || RESERVED_SYSTEM_IDS.includes(sp.publishedPluginId)) {
      await deleteDoc(doc(db, 'studio_projects', spDoc.id));
      console.log(`  ✓ Cleaned duplicate/system workspace: studio_projects/${spDoc.id} (${sp.name})`);
    }
  }

  console.log('\n✓ Firestore cleanup & migration completed.');
}

async function handlePull(idFilter) {
  console.log(`\n=== PULL FIRESTORE LIVE -> LOCAL PLUGINS ===`);
  const snap = await getDocs(collection(db, 'plugins'));
  snap.forEach((d) => {
    const data = d.data();
    const pid = data.id || d.id;
    if (RESERVED_SYSTEM_IDS.includes(pid)) return;
    if (idFilter && pid !== idFilter) return;

    if (data.files && data.files.length > 0) {
      console.log(`> Pulling '${pid}' (${data.files.length} files)...`);
      writeLocalPluginFiles(pid, data.files);
    }
  });
  console.log('\n✓ Pull completed.');
}

async function handleList() {
  console.log(`\n=== GNFLHS V2 DEPLOYMENT PIPELINE INVENTORY ===`);
  const localDirs = getLocalPluginDirs();
  console.log(`Local V2 Plugin Directories (plugins/): ${localDirs.join(', ') || 'none'}`);

  const snap = await getDocs(collection(db, 'plugins'));
  console.log('\n[LIVE / BETA] Deployed Apps (Firestore plugins):');
  snap.forEach((d) => {
    const p = d.data();
    const envCount = Object.keys(p.scriptProperties || {}).length;
    console.log(
      ` - ${p.id}: ${p.name} (v${p.version}) [channel: ${p.status}, roles: ${(p.allowedRoles || []).join(',')}, files: ${p.files?.length || 0}, envKeys: ${envCount}, snapshots: ${p.deployments?.length || 0}, linkedHead: ${p.sourceStudioProjectId || '-'}]`
    );
  });

  const studioSnap = await getDocs(collection(db, 'studio_projects'));
  console.log('\n[HEAD] 1:1 Studio Workspaces (Firestore studio_projects):');
  studioSnap.forEach((d) => {
    const sp = d.data();
    console.log(
      ` - ${sp.id}: ${sp.name} [files: ${sp.files?.length || 0}, linkedLiveApp: ${sp.publishedPluginId || '-'}]`
    );
  });
}

const [, , cmd = 'list', arg1, arg2, arg3] = process.argv;

const run = async () => {
  switch (cmd) {
    case 'scaffold':
      handleScaffold(arg1, arg2);
      break;
    case 'push':
      await handlePushHeadOnly(arg1);
      break;
    case 'deploy':
      await handleOfficialDeploy(arg1, arg2, arg3);
      break;
    case 'migrate-clean':
      await handleMigrateClean();
      break;
    case 'pull':
      await handlePull(arg1);
      break;
    case 'list':
    default:
      await handleList();
      break;
  }
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
