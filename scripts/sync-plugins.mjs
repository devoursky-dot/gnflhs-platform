import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection } from 'firebase/firestore';

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

const DEFAULT_SCRIPT_PROPERTIES = {
  SCHOOL_NAME: '경남외국어고등학교',
  UI_PC_COLUMNS: '3',
  UI_TABLET_COLUMNS: '2',
  UI_MOBILE_COLUMNS: '1',
  UI_SHOW_DETAIL_MOBILE: 'false',
  UI_SHOW_SIDEBAR_TABLET: 'true'
};

const DEFAULT_LIBRARIES = [
  {
    libraryId: 'gnflhs-responsive-ui',
    version: 'HEAD',
    enabled: true,
    identifier: 'ResponsiveUI'
  },
  {
    libraryId: 'gnflhs-cloud-kit',
    version: 'HEAD',
    enabled: false,
    identifier: 'CloudKit'
  }
];

const DEFAULT_RUNTIME_CONFIG = {
  timeZone: 'Asia/Seoul',
  runtimeVersion: 'GNFLHS_V2',
  exceptionLogging: 'STACKDRIVER',
  webappAccess: 'DOMAIN',
  webappExecuteAs: 'USER_ACCESSING',
  showManifest: true
};

const OFFICIAL_PLUGIN_META = {
  'whiteboard': {
    id: 'whiteboard',
    name: '전자칠판 필기 노트',
    description: '2023년식 구형 전자칠판 최적화 & 삼성노트 REA 필압/손떨림 보정 벡터 판서앱',
    icon: 'PenTool',
    category: 'classroom',
    version: '1.0.0',
    entryUrl: '/whiteboard/',
    allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
    studioProjectId: 'proj-whiteboard',
    note: '삼성노트 REA 필압·손떨림 보정 벡터 판서 정식 배포본 (v1.0.0)'
  },
  'dormitory-penalty': {
    id: 'dormitory-penalty',
    name: '기숙사 상·벌점 관리',
    description: '학생 기숙사 호실별 상점 및 벌점 부여, 통계 조회 독립 모듈',
    icon: 'ShieldAlert',
    category: 'management',
    version: '1.0.0',
    entryUrl: '/dormitory/',
    allowedRoles: ['super_admin', 'admin', 'teacher'],
    studioProjectId: 'proj-dormitory-penalty',
    note: '기숙사 호실별 상·벌점 관리 시스템 정식 배포본 (v1.0.0)'
  },
  'seating-chart': {
    id: 'app-mw7m26y7',
    name: '좌석배치',
    description: '스마트 좌석배치도 (교실/자습실/강당 단계별 구조 설정 및 A4 가로 1페이지 출력)',
    icon: 'LayoutGrid',
    category: 'classroom',
    version: '1.1.0',
    entryUrl: '/plugin/app-mw7m26y7',
    allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
    studioProjectId: 'proj-mw7m26y7',
    note: '단계별 좌석 조절 및 A4 가로 인쇄 정식 배포본 (v1.1.0)'
  }
};

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
  console.log(`\n=== PUSH LOCAL PLUGINS -> FIRESTORE OFFICIAL DEPLOYMENTS ===`);
  const dirs = getLocalPluginDirs();
  const targets = idFilter ? dirs.filter(d => d === idFilter) : dirs;

  if (targets.length === 0) {
    console.log(`No local plugin matching '${idFilter || '*'}' in ${pluginsDir}`);
    return;
  }

  const now = Date.now();

  for (const pid of targets) {
    const files = readLocalPluginFiles(pid);
    if (files.length === 0) continue;

    const meta = OFFICIAL_PLUGIN_META[pid] || {
      id: pid,
      name: pid,
      description: `${pid} 정식 운영 앱`,
      icon: 'Puzzle',
      category: 'utility',
      version: '1.0.0',
      entryUrl: `/plugin/${pid}`,
      allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
      studioProjectId: `proj-${pid}`,
      note: '정식 운영 배포본 (v1.0.0)'
    };

    console.log(`> Deploying '${pid}' -> plugin '${meta.id}' & studio '${meta.studioProjectId}' (${files.length} files)...`);

    // 1. studio_projects 컬렉션 동기화
    const projRef = doc(db, 'studio_projects', meta.studioProjectId);
    const existingSnap = await getDoc(projRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};

    const projectPayload = {
      ...existingData,
      id: meta.studioProjectId,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      category: meta.category,
      publishedPluginId: meta.id,
      files,
      scriptProperties: existingData.scriptProperties || { ...DEFAULT_SCRIPT_PROPERTIES },
      libraries: existingData.libraries || DEFAULT_LIBRARIES,
      services: existingData.services || ['firestore', 'storage'],
      runtimeConfig: existingData.runtimeConfig || { ...DEFAULT_RUNTIME_CONFIG },
      createdAt: existingData.createdAt || now,
      updatedAt: now
    };
    await setDoc(projRef, projectPayload, { merge: true });

    // 2. plugins 컬렉션에 정식 배포본(PluginDeployment) 구조로 등록/업데이트
    const pluginDocRef = doc(db, 'plugins', meta.id);
    const pluginSnap = await getDoc(pluginDocRef);
    const prevPlugin = pluginSnap.exists() ? pluginSnap.data() : {};

    const deploymentId = prevPlugin.activeDeploymentId || `dep-${meta.id}-v100`;
    const deploymentSnapshot = {
      deploymentId,
      version: meta.version,
      deployedAt: now,
      note: meta.note,
      files,
      scriptProperties: projectPayload.scriptProperties,
      libraries: projectPayload.libraries,
      runtimeConfig: projectPayload.runtimeConfig,
      codeType: 'inline_html',
      entryUrl: meta.entryUrl
    };

    const pluginPayload = {
      ...prevPlugin,
      id: meta.id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      category: meta.category,
      version: meta.version,
      status: 'production',
      entryUrl: meta.entryUrl,
      allowedRoles: meta.allowedRoles,
      codeType: 'inline_html',
      files,
      scriptProperties: projectPayload.scriptProperties,
      libraries: projectPayload.libraries,
      runtimeConfig: projectPayload.runtimeConfig,
      activeDeploymentId: deploymentId,
      sourceStudioProjectId: meta.studioProjectId,
      deployments: [deploymentSnapshot],
      updatedAt: now
    };

    await setDoc(pluginDocRef, pluginPayload, { merge: true });
    console.log(`  ✓ Official deployment synced: plugins/${meta.id} (v${meta.version}, activeDeploymentId: ${deploymentId})`);
  }

  console.log('\n✓ Push & Official Deployment completed successfully.');
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
    }
  });

  console.log('\n✓ Pull completed.');
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
    console.log(` - ${p.id}: ${p.name} (v${p.version}) [status: ${p.status}, codeType: ${p.codeType || 'url'}, files: ${p.files?.length || 0}, deployments: ${p.deployments?.length || 0}]`);
  });

  const studioCol = collection(db, 'studio_projects');
  const studioSnap = await getDocs(studioCol);
  console.log('\nRemote Studio Projects (studio_projects):');
  studioSnap.forEach((d) => {
    const sp = d.data();
    console.log(` - ${sp.id}: ${sp.name} [files: ${sp.files?.length || 0}, publishedPluginId: ${sp.publishedPluginId || '-'}]`);
  });
}

if (cmd === 'push') {
  handlePush(targetId).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else if (cmd === 'pull') {
  handlePull(targetId).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  handleList().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
