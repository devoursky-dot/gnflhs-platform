import {
  VirtualFile,
  StudioLibraryBinding,
  StudioRuntimeConfig,
  DeviceViewportType
} from '@gnflhs/shared-types';

export interface SharedLibraryMeta {
  id: string;
  packageName: string;
  name: string;
  identifier: string;
  version: string;
  summary: string;
  snippet: string;
}

export interface BuiltinServiceMeta {
  id: string;
  name: string;
  globalSymbol: string;
  summary: string;
}

export const DEFAULT_RUNTIME_CONFIG: StudioRuntimeConfig = {
  runtimeVersion: 'V8',
  timeZone: 'Asia/Seoul',
  showManifest: true,
  cacheEnabled: true,
  cacheTtlSec: 300
};

export const DEFAULT_SCRIPT_PROPERTIES: Record<string, string> = {
  SCHOOL_NAME: '경남외국어고등학교',
  UI_PC_COLS: '3',
  UI_TABLET_COLS: '2',
  UI_MOBILE_COLS: '1',
  UI_TABLET_SHOW_DETAIL: 'true',
  UI_TABLET_SHOW_SIDEBAR: 'false',
  UI_MOBILE_SHOW_DETAIL: 'false',
  UI_MOBILE_SHOW_SIDEBAR: 'false'
};

export const DEFAULT_LIBRARIES: StudioLibraryBinding[] = [
  { libraryId: 'gnflhs-core-sdk', version: 'HEAD', enabled: true, identifier: 'GNFLHS' },
  { libraryId: 'gnflhs-ui-kit', version: 'HEAD', enabled: true, identifier: 'GNUI' },
  { libraryId: 'gnflhs-print-kit', version: 'HEAD', enabled: true, identifier: 'GNPrint' },
  { libraryId: 'gnflhs-canvas-kit', version: 'HEAD', enabled: false, identifier: 'GNCanvas' },
  { libraryId: 'gnflhs-storage-bridge', version: '1.0.0', enabled: true, identifier: 'GNStorage' },
  { libraryId: 'gnflhs-icons-mini', version: '1.0.0', enabled: true, identifier: 'GNIcons' }
];

export const DEFAULT_SERVICES: string[] = [
  'PropertiesService',
  'CacheService',
  'FirestoreDB',
  'CloudStorage',
  'ResponsiveViewport'
];

export const BUILTIN_LIBRARIES: SharedLibraryMeta[] = [
  {
    id: 'gnflhs-core-sdk',
    packageName: '@gnflhs/sdk',
    name: 'Core SDK & Reactive Store',
    identifier: 'GNFLHS',
    version: '2.0.0',
    summary: 'env(환경변수) · db(KV/컬렉션) · auth · cache · createStore(상태/Undo) ES 모듈',
    snippet: `import { env, db, auth, createStore } from '@gnflhs/sdk';
const school = env.str('SCHOOL_NAME', '경남외고');
const store = createStore({ items: [] }, 'app_state_v1');`
  },
  {
    id: 'gnflhs-ui-kit',
    packageName: '@gnflhs/ui',
    name: 'Responsive UI & Dialog Kit',
    identifier: 'GNUI',
    version: '2.0.0',
    summary: 'data-tier 반응형 그리드 · 비동기 모달(prompt/confirm) · 구글시트 TSV 파서 · 토스트',
    snippet: `import { toast, confirmDialog, promptDialog, parseTsv } from '@gnflhs/ui';
const ok = await confirmDialog('초기화하시겠습니까?');
if (ok) toast('완료되었습니다.');`
  },
  {
    id: 'gnflhs-print-kit',
    packageName: '@gnflhs/print',
    name: 'A4 Print & Text Auto-Fit Kit',
    identifier: 'GNPrint',
    version: '2.0.0',
    summary: 'A4 가로/세로 1페이지 인쇄 규격 제어 및 긴 이름 줄바꿈 방지 자동 축소(font-size/scaleX)',
    snippet: `import { configurePrint, fitSingleLine, printNow } from '@gnflhs/print';
configurePrint({ orientation: 'landscape', margin: '8mm 12mm' });
printNow();`
  },
  {
    id: 'gnflhs-canvas-kit',
    packageName: '@gnflhs/canvas',
    name: 'REA Vector Ink & Pressure Kit',
    identifier: 'GNCanvas',
    version: '2.0.0',
    summary: '삼성노트 REA 역추적 기반 손떨림 보정(StrokeStabilizer) · 속도 가변 필압 · 베지에 곡선',
    snippet: `import { StrokeStabilizer, PressureEngine, drawSmoothStroke } from '@gnflhs/canvas';
const stabilizer = new StrokeStabilizer(0.42);`
  },
  {
    id: 'gnflhs-storage-bridge',
    packageName: '@gnflhs/storage',
    name: 'Cloud Storage Bridge',
    identifier: 'GNStorage',
    version: '1.0.0',
    summary: '플랫폼 클라우드 스토리지 공용/그룹 폴더 파일 조회 브릿지',
    snippet: `import { storage } from '@gnflhs/storage';
const files = await storage.list('shared');`
  },
  {
    id: 'gnflhs-icons-mini',
    packageName: '@gnflhs/icons',
    name: 'Vector Icons Pack',
    identifier: 'GNIcons',
    version: '1.0.0',
    summary: '경량 인라인 SVG 벡터 아이콘 헬퍼 ([data-gn-icon] 및 icon() 함수)',
    snippet: `import { icon } from '@gnflhs/icons';
document.body.insertAdjacentHTML('beforeend', icon('check', 18));`
  }
];

export const BUILTIN_SERVICES: BuiltinServiceMeta[] = [
  {
    id: 'PropertiesService',
    name: 'PropertiesService & env.json',
    globalSymbol: 'GNFLHS.env / PropertiesService',
    summary: '선언형 env.json 및 스크립트/전역 환경변수 자동 바인딩'
  },
  {
    id: 'CacheService',
    name: 'CacheService',
    globalSymbol: 'GNFLHS.cache / CacheService',
    summary: 'TTL 만료 기반 스크립트 캐시 조회/저장/초기화'
  },
  {
    id: 'FirestoreDB',
    name: 'FirestoreDB',
    globalSymbol: 'GNFLHS.db',
    summary: '앱별 격리 컬렉션(plugin_data) KV 및 Collection CRUD 브릿지'
  },
  {
    id: 'CloudStorage',
    name: 'CloudStorage',
    globalSymbol: 'GNFLHS.storage',
    summary: '권한 연동 클라우드 스토리지 브릿지'
  },
  {
    id: 'ResponsiveViewport',
    name: 'ResponsiveViewport',
    globalSymbol: 'GNFLHS.ui',
    summary: 'PC·태블릿·스마트폰 뷰포트 감지 및 표준 레이아웃 제어'
  }
];

/**
 * 가상 파일 배열 내 env.json에서 환경변수 추출
 */
export function extractEnvFromFiles(files: VirtualFile[]): Record<string, string> {
  const envFile = files.find((f) => f.name === 'env.json');
  if (!envFile || !envFile.content.trim()) return {};
  try {
    const parsed = JSON.parse(envFile.content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    });
    return out;
  } catch {
    return {};
  }
}

/**
 * scriptProperties 객체를 env.json 파일 내용으로 직렬화하여 가상 파일 배열에 동기화
 */
export function syncEnvJsonFile(
  files: VirtualFile[],
  scriptProperties: Record<string, string>
): VirtualFile[] {
  const cleanProps: Record<string, string> = {};
  Object.keys(scriptProperties)
    .sort()
    .forEach((k) => {
      cleanProps[k] = String(scriptProperties[k] ?? '');
    });
  const content = JSON.stringify(cleanProps, null, 2);
  const exists = files.some((f) => f.name === 'env.json');
  if (exists) {
    return files.map((f) => (f.name === 'env.json' ? { ...f, content } : f));
  }
  return [...files, { name: 'env.json', content }];
}

/**
 * 스튜디오 작업본(HEAD)과 활성 배포 스냅샷(LIVE) 간 변경 여부 판별용 결정론적 시그니처 계산
 */
export function computeBundleSignature(
  files: VirtualFile[] = [],
  scriptProperties: Record<string, string> = {}
): string {
  const normFiles = [...files]
    .filter((f) => f.name !== 'appsscript.json' && f.name !== 'env.json')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => `${f.name}:${(f.content || '').trim()}`)
    .join('|');
  const mergedEnv = { ...scriptProperties, ...extractEnvFromFiles(files) };
  const normProps = Object.keys(mergedEnv)
    .sort()
    .map((k) => `${k}=${mergedEnv[k]}`)
    .join('&');
  return `${normFiles}##${normProps}`;
}

export function buildManifestContent(
  runtimeConfig: StudioRuntimeConfig = DEFAULT_RUNTIME_CONFIG,
  libraries: StudioLibraryBinding[] = DEFAULT_LIBRARIES,
  services: string[] = DEFAULT_SERVICES,
  customImports: Record<string, string> = {}
): string {
  return JSON.stringify(
    {
      timeZone: runtimeConfig.timeZone || 'Asia/Seoul',
      runtimeVersion: runtimeConfig.runtimeVersion || 'V8',
      moduleSystem: 'ESM_IMPORTMAP_V2',
      envFile: 'env.json',
      webapp: {
        executeAs: 'USER_ACCESSING',
        access: 'DOMAIN',
        responsivePolicy: 'PROPERTIES_DRIVEN'
      },
      cache: {
        enabled: runtimeConfig.cacheEnabled,
        defaultTtlSeconds: runtimeConfig.cacheTtlSec
      },
      imports: customImports,
      dependencies: {
        enabledServices: services,
        libraries: libraries
          .filter((l) => l.enabled)
          .map((l) => {
            const meta = BUILTIN_LIBRARIES.find((m) => m.id === l.libraryId);
            return {
              package: meta?.packageName || l.libraryId,
              userSymbol: l.identifier || l.libraryId,
              libraryId: l.libraryId,
              version: l.version,
              developmentMode: l.version === 'HEAD'
            };
          })
      }
    },
    null,
    2
  );
}

/**
 * Gemini 등 AI 코딩 에이전트가 플랫폼 구조 수정 없이 즉시 앱 개발에만 집중할 수 있도록 표준 규격 명세 생성
 */
export function buildGeminiDeveloperSpec(
  projectName: string,
  files: VirtualFile[],
  scriptProps: Record<string, string>
): string {
  const mergedEnv = { ...DEFAULT_SCRIPT_PROPERTIES, ...scriptProps, ...extractEnvFromFiles(files) };
  return `# GNFLHS Studio V2 앱 개발 표준 규격 (${projectName})

## 1. 파일 구조 (빌드 설정 불필요 · 브라우저 네이티브 ES Module ImportMap 자동 컴파일)
- \`index.html\`: 앱 마크업 (\`<script type="module" src="./script.js"></script>\` 권장)
- \`script.js\` 및 추가 \`.js\` 모듈: \`import { ... } from './state.js'\` 형태로 자유롭게 모듈 분리 가능
- \`style.css\`: 스타일시트 (\`env.json\`의 모든 키가 \`:root { --env-키이름 }\` CSS 변수로 자동 주입됨)
- \`env.json\`: 선언형 환경변수 파일 (코드 수정 없이 상수·옵션·기본값 제어)

## 2. 내장 공유 라이브러리 (ES Module Import)
\`\`\`js
import { env, db, auth, cache, createStore } from '@gnflhs/sdk';
import { toast, confirmDialog, promptDialog, alertDialog, parseTsv, ui } from '@gnflhs/ui';
import { configurePrint, fitSingleLine, fitAllSingleLine, printNow } from '@gnflhs/print';
import { StrokeStabilizer, PressureEngine, drawSmoothStroke } from '@gnflhs/canvas';
\`\`\`

## 3. 현재 프로젝트 환경변수 (env.json)
\`\`\`json
${JSON.stringify(mergedEnv, null, 2)}
\`\`\`
- JS 조회: \`env.str('KEY', '기본값')\`, \`env.int('KEY', 3)\`, \`env.bool('KEY', true)\`, \`env.json('KEY', [])\`
- DB 영구 저장: \`await db.get('key')\`, \`await db.set('key', data)\`, \`db.collection('records')\`
`;
}

export interface CompileOptions {
  projectId: string;
  projectName: string;
  files: VirtualFile[];
  scriptProperties?: Record<string, string>;
  globalProperties?: Record<string, string>;
  libraries?: StudioLibraryBinding[];
  runtimeConfig?: StudioRuntimeConfig;
  forcedDevice?: DeviceViewportType | 'auto';
  currentUser?: {
    email: string | null;
    displayName: string | null;
    isSuperAdmin: boolean;
  } | null;
}

function toEsmDataUri(code: string): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

function detectUsesEsModules(htmlContent: string, jsFiles: VirtualFile[]): boolean {
  if (/<script[^>]*type=["']module["']/i.test(htmlContent)) return true;
  return jsFiles.some(
    (f) =>
      f.name.endsWith('.mjs') ||
      /(?:^|\n)\s*import\s+(?:[\w*{]|["'])/m.test(f.content) ||
      /(?:^|\n)\s*export\s+(?:default|const|let|var|function|class|\{)/m.test(f.content)
  );
}

/**
 * 스튜디오 멀티 파일 + env.json + ES Module ImportMap + 공유 라이브러리 + V8 런타임 브릿지를 단일 실행 HTML로 결합
 */
export function compileStudioBundle(options: CompileOptions): string {
  const {
    projectId,
    projectName,
    files,
    scriptProperties = {},
    globalProperties = {},
    libraries = DEFAULT_LIBRARIES,
    runtimeConfig = DEFAULT_RUNTIME_CONFIG,
    forcedDevice = 'auto',
    currentUser = null
  } = options;

  const fileEnvProps = extractEnvFromFiles(files);
  const mergedProps: Record<string, string> = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...globalProperties,
    ...scriptProperties,
    ...fileEnvProps
  };

  // appsscript.json에 선언된 외부 CDN importMap 항목 추출 (예: esm.sh 패키지)
  let manifestCustomImports: Record<string, string> = {};
  const manifestFile = files.find((f) => f.name === 'appsscript.json');
  if (manifestFile) {
    try {
      const parsedManifest = JSON.parse(manifestFile.content);
      if (parsedManifest?.imports && typeof parsedManifest.imports === 'object') {
        manifestCustomImports = parsedManifest.imports;
      }
    } catch {}
  }

  const uiKitEnabled = libraries.some((l) => l.libraryId === 'gnflhs-ui-kit' && l.enabled) || true;
  const iconsEnabled = libraries.some((l) => l.libraryId === 'gnflhs-icons-mini' && l.enabled);

  const htmlFile =
    files.find((f) => f.name === 'index.html') ||
    files.find((f) => f.name.endsWith('.html')) ||
    files[0];
  const cssFiles = files.filter((f) => f.name.endsWith('.css'));
  const jsFiles = files.filter((f) => f.name.endsWith('.js') || f.name.endsWith('.mjs') || f.name.endsWith('.gs'));

  // env.json의 모든 키를 CSS 변수(--env-key-name)로 자동 노출
  const envCssVars = Object.entries(mergedProps)
    .map(([k, v]) => {
      const cssKey = '--env-' + k.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const safeVal = String(v).replace(/[\r\n;{}]/g, '').trim();
      return safeVal ? `  ${cssKey}: ${safeVal};` : '';
    })
    .filter(Boolean)
    .join('\n');

  const uiKitCss = uiKitEnabled
    ? `
/* === GNFLHS V2 Standardized Responsive UI & Env Variables === */
:root {
  --gn-cols-pc: ${Number(mergedProps.UI_PC_COLS) || 3};
  --gn-cols-tablet: ${Number(mergedProps.UI_TABLET_COLS) || 2};
  --gn-cols-mobile: ${Number(mergedProps.UI_MOBILE_COLS) || 1};
  --gn-primary: #2563eb;
  --gn-bg: #f8fafc;
  --gn-surface: #ffffff;
  --gn-border: #e2e8f0;
  --gn-text: #0f172a;
  --gn-muted: #64748b;
${envCssVars}
}
*, *::before, *::after { box-sizing: border-box; }
.gn-shell { max-width: 1200px; margin: 0 auto; padding: 20px; }
html[data-device="tablet"] .gn-shell { padding: 16px; }
html[data-device="mobile"] .gn-shell { padding: 12px; }

.gn-layout { display: flex; gap: 20px; align-items: flex-start; }
.gn-sidebar, [data-tier="sidebar"] { width: 240px; flex-shrink: 0; }
.gn-main { flex: 1; min-width: 0; }

.gn-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(var(--gn-cols-pc), minmax(0, 1fr));
}
html[data-device="tablet"] .gn-grid {
  grid-template-columns: repeat(var(--gn-cols-tablet), minmax(0, 1fr));
  gap: 12px;
}
html[data-device="mobile"] .gn-grid {
  grid-template-columns: repeat(var(--gn-cols-mobile), minmax(0, 1fr));
  gap: 10px;
}

.gn-card {
  background: var(--gn-surface);
  border: 1px solid var(--gn-border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
}
html[data-device="mobile"] .gn-card { padding: 14px; border-radius: 12px; }

.gn-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.gn-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--gn-border);
  background: var(--gn-surface);
  color: var(--gn-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.gn-btn-primary {
  background: var(--gn-primary);
  color: #fff;
  border-color: var(--gn-primary);
}
.gn-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
}

html[data-device="tablet"] [data-tier="pc-only"],
html[data-device="tablet"] .gn-pc-only,
html[data-device="mobile"] [data-tier="pc-only"],
html[data-device="mobile"] .gn-pc-only {
  display: none !important;
}
html[data-device="tablet"][data-tablet-detail="false"] [data-tier="detail"],
html[data-device="tablet"][data-tablet-detail="false"] .gn-detail {
  display: none !important;
}
html[data-device="tablet"][data-tablet-sidebar="false"] [data-tier="sidebar"],
html[data-device="tablet"][data-tablet-sidebar="false"] .gn-sidebar {
  display: none !important;
}
html[data-device="mobile"][data-mobile-detail="false"] [data-tier="detail"],
html[data-device="mobile"][data-mobile-detail="false"] .gn-detail {
  display: none !important;
}
html[data-device="mobile"][data-mobile-sidebar="false"] [data-tier="sidebar"],
html[data-device="mobile"][data-mobile-sidebar="false"] .gn-sidebar {
  display: none !important;
}
html[data-device="mobile"] .gn-label-optional {
  display: none !important;
}
@media print {
  .no-print, [data-no-print="true"] { display: none !important; }
}
`
    : '';

  const runtimeBootstrapJs = `
(function() {
  const __PROJECT_ID__ = ${JSON.stringify(projectId)};
  const __PROJECT_NAME__ = ${JSON.stringify(projectName)};
  const __FORCED_DEVICE__ = ${JSON.stringify(forcedDevice)};
  const __RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};
  const __SCRIPT_PROPS__ = ${JSON.stringify(mergedProps)};
  const __CURRENT_USER__ = ${JSON.stringify(
    currentUser || { email: 'guest@gnflhs.kr', displayName: '방문자', isSuperAdmin: false }
  )};

  function postToHost(type, payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ __gnflhs_studio__: true, projectId: __PROJECT_ID__, type, payload }, '*');
      }
    } catch (e) {}
  }

  // 1. Logger & Console Stream Bridge
  function formatArg(a) {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  ['log', 'info', 'warn', 'error'].forEach(function(level) {
    const orig = console[level] ? console[level].bind(console) : function() {};
    console[level] = function() {
      orig.apply(console, arguments);
      const msg = Array.prototype.slice.call(arguments).map(formatArg).join(' ');
      postToHost('EXECUTION_LOG', { level: level, message: msg, timestamp: Date.now() });
    };
  });
  window.addEventListener('error', function(ev) {
    postToHost('EXECUTION_LOG', { level: 'error', message: ev.message || 'Runtime Error', timestamp: Date.now() });
  });
  window.addEventListener('unhandledrejection', function(ev) {
    const reason = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason || 'Unhandled Promise Rejection');
    postToHost('EXECUTION_LOG', { level: 'error', message: reason, timestamp: Date.now() });
  });
  window.Logger = {
    log: function() {
      const msg = Array.prototype.slice.call(arguments).map(formatArg).join(' ');
      postToHost('EXECUTION_LOG', { level: 'info', message: '[Logger] ' + msg, timestamp: Date.now() });
    }
  };

  // 2. Typed Environment & PropertiesService
  const userPropKey = 'gnflhs_uprops_' + __PROJECT_ID__ + '_' + (__CURRENT_USER__.email || 'anon');
  function loadUserProps() {
    try { return JSON.parse(localStorage.getItem(userPropKey) || '{}'); } catch (e) { return {}; }
  }
  const scriptPropsStore = Object.assign({}, __SCRIPT_PROPS__);
  const scriptPropertiesApi = {
    getProperty: function(k) { return Object.prototype.hasOwnProperty.call(scriptPropsStore, k) ? scriptPropsStore[k] : null; },
    getProperties: function() { return Object.assign({}, scriptPropsStore); },
    setProperty: function(k, v) {
      scriptPropsStore[k] = String(v);
      applyResponsiveAttributes();
      return scriptPropertiesApi;
    },
    deleteProperty: function(k) { delete scriptPropsStore[k]; applyResponsiveAttributes(); return scriptPropertiesApi; }
  };
  const userPropertiesApi = {
    getProperty: function(k) { const p = loadUserProps(); return Object.prototype.hasOwnProperty.call(p, k) ? p[k] : null; },
    getProperties: function() { return loadUserProps(); },
    setProperty: function(k, v) {
      const p = loadUserProps();
      p[k] = String(v);
      try { localStorage.setItem(userPropKey, JSON.stringify(p)); } catch (e) {}
      return userPropertiesApi;
    },
    deleteProperty: function(k) {
      const p = loadUserProps();
      delete p[k];
      try { localStorage.setItem(userPropKey, JSON.stringify(p)); } catch (e) {}
      return userPropertiesApi;
    }
  };
  window.PropertiesService = {
    getScriptProperties: function() { return scriptPropertiesApi; },
    getUserProperties: function() { return userPropertiesApi; }
  };

  const typedEnv = new Proxy(scriptPropsStore, {
    get: function(target, prop) {
      if (prop === 'get' || prop === 'str') {
        return function(k, fallback) {
          return Object.prototype.hasOwnProperty.call(target, k) && target[k] !== '' ? String(target[k]) : (fallback !== undefined ? String(fallback) : '');
        };
      }
      if (prop === 'int') {
        return function(k, fallback) {
          const n = parseInt(target[k], 10);
          return Number.isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
        };
      }
      if (prop === 'float') {
        return function(k, fallback) {
          const n = parseFloat(target[k]);
          return Number.isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
        };
      }
      if (prop === 'bool') {
        return function(k, fallback) {
          if (!Object.prototype.hasOwnProperty.call(target, k)) return Boolean(fallback);
          const v = String(target[k]).toLowerCase().trim();
          if (v === 'true' || v === '1' || v === 'yes') return true;
          if (v === 'false' || v === '0' || v === 'no') return false;
          return Boolean(fallback);
        };
      }
      if (prop === 'json') {
        return function(k, fallback) {
          if (!Object.prototype.hasOwnProperty.call(target, k)) return fallback;
          try { return JSON.parse(target[k]); } catch (e) { return fallback; }
        };
      }
      if (prop === 'all') {
        return function() { return Object.assign({}, target); };
      }
      return target[prop];
    }
  });

  // 3. CacheService
  const cachePrefix = 'gnflhs_cache_' + __PROJECT_ID__ + '_';
  const scriptCacheApi = {
    get: function(key) {
      if (!__RUNTIME_CONFIG__.cacheEnabled) return null;
      try {
        const raw = localStorage.getItem(cachePrefix + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.exp && Date.now() > parsed.exp) {
          localStorage.removeItem(cachePrefix + key);
          return null;
        }
        return parsed.val;
      } catch (e) { return null; }
    },
    put: function(key, value, expirationInSeconds) {
      if (!__RUNTIME_CONFIG__.cacheEnabled) return;
      const ttl = Number(expirationInSeconds || __RUNTIME_CONFIG__.cacheTtlSec || 300);
      try {
        localStorage.setItem(cachePrefix + key, JSON.stringify({
          val: String(value),
          exp: Date.now() + ttl * 1000,
          updatedAt: Date.now()
        }));
        postToHost('CACHE_UPDATED', { key: key, ttl: ttl });
      } catch (e) {}
    },
    remove: function(key) {
      try { localStorage.removeItem(cachePrefix + key); postToHost('CACHE_UPDATED', { key: key }); } catch (e) {}
    },
    removeAll: function() {
      try {
        Object.keys(localStorage).forEach(function(k) {
          if (k.indexOf(cachePrefix) === 0) localStorage.removeItem(k);
        });
        postToHost('CACHE_UPDATED', { cleared: true });
      } catch (e) {}
    }
  };
  window.CacheService = {
    getScriptCache: function() { return scriptCacheApi; },
    getUserCache: function() { return scriptCacheApi; }
  };

  // 4. Device Detection & Responsive Engine
  function computeDevice() {
    if (__FORCED_DEVICE__ && __FORCED_DEVICE__ !== 'auto') return __FORCED_DEVICE__;
    const w = window.innerWidth || document.documentElement.clientWidth || 1280;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'pc';
  }

  let currentDevice = computeDevice();
  const deviceListeners = [];

  function applyResponsiveAttributes() {
    const root = document.documentElement;
    currentDevice = computeDevice();
    root.setAttribute('data-device', currentDevice);
    root.setAttribute('data-tablet-detail', String(scriptPropsStore.UI_TABLET_SHOW_DETAIL !== 'false'));
    root.setAttribute('data-tablet-sidebar', String(scriptPropsStore.UI_TABLET_SHOW_SIDEBAR === 'true'));
    root.setAttribute('data-mobile-detail', String(scriptPropsStore.UI_MOBILE_SHOW_DETAIL === 'true'));
    root.setAttribute('data-mobile-sidebar', String(scriptPropsStore.UI_MOBILE_SHOW_SIDEBAR === 'true'));
    root.style.setProperty('--gn-cols-pc', String(Number(scriptPropsStore.UI_PC_COLS) || 3));
    root.style.setProperty('--gn-cols-tablet', String(Number(scriptPropsStore.UI_TABLET_COLS) || 2));
    root.style.setProperty('--gn-cols-mobile', String(Number(scriptPropsStore.UI_MOBILE_COLS) || 1));
  }
  applyResponsiveAttributes();

  window.addEventListener('resize', function() {
    const next = computeDevice();
    if (next !== currentDevice) {
      applyResponsiveAttributes();
      deviceListeners.forEach(function(fn) { try { fn(currentDevice); } catch (e) {} });
      window.dispatchEvent(new CustomEvent('gnflhs:devicechange', { detail: { device: currentDevice } }));
    }
  });

  // 5. Async RPC Bridge + Structured Collection Helper + Reactive Store
  const pendingRpc = {};
  window.addEventListener('message', function(ev) {
    const data = ev.data;
    if (!data || !data.__gnflhs_rpc_res__) return;
    const req = pendingRpc[data.reqId];
    if (req) {
      delete pendingRpc[data.reqId];
      if (data.error) req.reject(new Error(data.error));
      else req.resolve(data.result);
    }
  });

  function callHostRpc(action, args, fallbackFn) {
    if (!window.parent || window.parent === window) {
      return Promise.resolve().then(fallbackFn);
    }
    return new Promise(function(resolve, reject) {
      const reqId = 'rpc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const timer = setTimeout(function() {
        if (pendingRpc[reqId]) {
          delete pendingRpc[reqId];
          Promise.resolve().then(fallbackFn).then(resolve).catch(reject);
        }
      }, 1500);
      pendingRpc[reqId] = {
        resolve: function(val) { clearTimeout(timer); resolve(val); },
        reject: function(err) { clearTimeout(timer); reject(err); }
      };
      window.parent.postMessage({
        __gnflhs_rpc_req__: true,
        reqId: reqId,
        projectId: __PROJECT_ID__,
        action: action,
        args: args
      }, '*');
    });
  }

  const localDbKey = 'gnflhs_localdb_' + __PROJECT_ID__;
  function readLocalDb() {
    try { return JSON.parse(localStorage.getItem(localDbKey) || '{}'); } catch (e) { return {}; }
  }
  function writeLocalDb(obj) {
    try { localStorage.setItem(localDbKey, JSON.stringify(obj)); } catch (e) {}
  }

  const dbApi = {
    get: function(key) {
      return callHostRpc('DB_GET', { key: key }, function() {
        const store = readLocalDb();
        return store[key] !== undefined ? store[key] : null;
      });
    },
    set: function(key, value) {
      return callHostRpc('DB_SET', { key: key, value: value }, function() {
        const store = readLocalDb();
        store[key] = value;
        writeLocalDb(store);
        return true;
      });
    },
    remove: function(key) {
      return callHostRpc('DB_REMOVE', { key: key }, function() {
        const store = readLocalDb();
        delete store[key];
        writeLocalDb(store);
        return true;
      });
    },
    list: function() {
      return callHostRpc('DB_LIST', {}, function() {
        const store = readLocalDb();
        return Object.keys(store).map(function(k) { return { id: k, value: store[k] }; });
      });
    },
    collection: function(colName) {
      const storageKey = 'col__' + colName;
      return {
        getAll: async function(defaultItems) {
          const rows = await dbApi.get(storageKey);
          if (Array.isArray(rows)) return rows;
          if (Array.isArray(defaultItems)) {
            await dbApi.set(storageKey, defaultItems);
            return defaultItems.slice();
          }
          return [];
        },
        saveAll: function(items) {
          return dbApi.set(storageKey, items);
        },
        add: async function(item) {
          const rows = (await dbApi.get(storageKey)) || [];
          const doc = Object.assign({ id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), createdAt: Date.now() }, item);
          rows.unshift(doc);
          await dbApi.set(storageKey, rows);
          return doc;
        },
        update: async function(id, patch) {
          const rows = (await dbApi.get(storageKey)) || [];
          const next = rows.map(function(r) { return r.id === id ? Object.assign({}, r, patch, { updatedAt: Date.now() }) : r; });
          await dbApi.set(storageKey, next);
          return next;
        },
        remove: async function(id) {
          const rows = (await dbApi.get(storageKey)) || [];
          const next = rows.filter(function(r) { return r.id !== id; });
          await dbApi.set(storageKey, next);
          return next;
        }
      };
    }
  };

  function createStore(initialState, persistKey) {
    let state = Object.assign({}, initialState);
    const past = [];
    const future = [];
    const subscribers = [];
    const localKey = persistKey ? ('gnflhs_store_' + __PROJECT_ID__ + '_' + persistKey) : null;

    if (localKey) {
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) state = Object.assign({}, initialState, JSON.parse(raw));
      } catch (e) {}
    }

    function notify() {
      if (localKey) {
        try { localStorage.setItem(localKey, JSON.stringify(state)); } catch (e) {}
      }
      subscribers.forEach(function(fn) { try { fn(state); } catch (e) {} });
    }

    return {
      getState: function() { return state; },
      setState: function(updater, recordHistory) {
        if (recordHistory !== false) {
          past.push(JSON.parse(JSON.stringify(state)));
          if (past.length > 40) past.shift();
          future.length = 0;
        }
        const patch = typeof updater === 'function' ? updater(state) : updater;
        state = Object.assign({}, state, patch);
        notify();
        return state;
      },
      subscribe: function(fn) {
        subscribers.push(fn);
        fn(state);
        return function() {
          const idx = subscribers.indexOf(fn);
          if (idx >= 0) subscribers.splice(idx, 1);
        };
      },
      undo: function() {
        if (!past.length) return state;
        future.push(JSON.parse(JSON.stringify(state)));
        state = past.pop();
        notify();
        return state;
      },
      redo: function() {
        if (!future.length) return state;
        past.push(JSON.parse(JSON.stringify(state)));
        state = future.pop();
        notify();
        return state;
      }
    };
  }

  // 6. Non-blocking Sandboxed Dialogs & TSV Parser (@gnflhs/ui)
  function showDialog(opts) {
    return new Promise(function(resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'no-print';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99998;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
      const box = document.createElement('div');
      box.style.cssText = 'background:#ffffff;color:#0f172a;border-radius:14px;padding:22px;width:92%;max-width:400px;box-shadow:0 20px 45px rgba(0,0,0,0.25);';
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:15px;font-weight:700;margin-bottom:12px;line-height:1.45;';
      titleEl.textContent = opts.message || '';
      box.appendChild(titleEl);

      let inputEl = null;
      if (opts.type === 'prompt') {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.value = opts.defaultValue || '';
        inputEl.style.cssText = 'width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-bottom:14px;outline:none;';
        box.appendChild(inputEl);
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:6px;';
      if (opts.type !== 'alert') {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '취소';
        cancelBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:none;background:#e2e8f0;color:#334155;font-size:13px;font-weight:700;cursor:pointer;';
        cancelBtn.onclick = function() { overlay.remove(); resolve(opts.type === 'prompt' ? null : false); };
        actions.appendChild(cancelBtn);
      }
      const okBtn = document.createElement('button');
      okBtn.textContent = '확인';
      okBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:700;cursor:pointer;';
      const submit = function() {
        const val = opts.type === 'prompt' ? inputEl.value : true;
        overlay.remove();
        resolve(val);
      };
      okBtn.onclick = submit;
      if (inputEl) {
        inputEl.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { overlay.remove(); resolve(null); }
        });
      }
      actions.appendChild(okBtn);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      if (inputEl) { inputEl.focus(); inputEl.select(); } else { okBtn.focus(); }
    });
  }

  function parseTsv(rawText) {
    if (!rawText || !String(rawText).trim()) return [];
    return String(rawText)
      .trim()
      .split(/\\r?\\n/)
      .filter(function(line) { return line.trim().length > 0; })
      .map(function(line) {
        const sep = line.indexOf('\\t') >= 0 ? '\\t' : ',';
        return line.split(sep).map(function(c) { return c.trim().replace(/^["']|["']$/g, ''); });
      });
  }

  function showToast(msg, variant) {
    const bg = variant === 'error' ? '#dc2626' : variant === 'success' ? '#15803d' : '#0f172a';
    const el = document.createElement('div');
    el.className = 'no-print';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:' + bg + ';color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 10px 25px rgba(0,0,0,0.25);';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 2400);
  }

  // 7. A4 Print & Auto-Fit Kit (@gnflhs/print)
  const printKit = {
    configurePrint: function(cfg) {
      const opts = Object.assign({ orientation: 'landscape', margin: '8mm 12mm' }, cfg || {});
      let styleEl = document.getElementById('__gnflhs_print_page_rule__');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = '__gnflhs_print_page_rule__';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = '@media print { @page { size: ' + opts.orientation + '; margin: ' + opts.margin + '; } }';
    },
    fitSingleLine: function(el, maxWidthPx, mode, baseFontPx, minFontPx) {
      if (!el) return;
      const base = baseFontPx || 24;
      const min = minFontPx || 11;
      const fitMode = mode || 'font-size';
      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = base + 'px';
      el.style.transform = 'none';
      const sw = el.scrollWidth;
      if (sw <= maxWidthPx || maxWidthPx <= 0) return;
      const ratio = maxWidthPx / sw;
      if (fitMode === 'condensed') {
        el.style.display = 'inline-block';
        el.style.transformOrigin = 'center center';
        el.style.transform = 'scaleX(' + Math.max(0.45, ratio).toFixed(3) + ')';
      } else {
        el.style.fontSize = Math.max(min, Math.floor(base * ratio)) + 'px';
      }
    },
    fitAllSingleLine: function(selector, opts) {
      const o = opts || {};
      document.querySelectorAll(selector).forEach(function(el) {
        const maxW = o.maxWidthPx || (el.parentElement ? el.parentElement.clientWidth - 8 : 80);
        printKit.fitSingleLine(el, maxW, o.mode || 'font-size', o.baseFontPx || 22, o.minFontPx || 11);
      });
    },
    printNow: function() {
      window.print();
    }
  };

  // 8. REA Vector Ink & Pressure Kit (@gnflhs/canvas)
  function StrokeStabilizer(smoothingFactor) {
    this.smoothingFactor = smoothingFactor || 0.42;
    this.history = [];
  }
  StrokeStabilizer.prototype.reset = function() { this.history = []; };
  StrokeStabilizer.prototype.addPoint = function(rawPoint) {
    if (!this.history.length) { this.history.push(rawPoint); return rawPoint; }
    const prev = this.history[this.history.length - 1];
    const filtered = {
      x: prev.x + (rawPoint.x - prev.x) * this.smoothingFactor,
      y: prev.y + (rawPoint.y - prev.y) * this.smoothingFactor,
      pressure: Math.max(0.05, Math.min(1.0, (prev.pressure || 0.5) + ((rawPoint.pressure || 0.5) - (prev.pressure || 0.5)) * 0.6)),
      time: rawPoint.time || performance.now()
    };
    this.history.push(filtered);
    if (this.history.length > 10) this.history.shift();
    return filtered;
  };

  function PressureEngine(baseWidth) {
    this.lastPoint = null;
    this.setWidths(baseWidth || 6);
  }
  PressureEngine.prototype.setWidths = function(baseWidth) {
    this.minWidth = Math.max(1, baseWidth * 0.4);
    this.maxWidth = baseWidth * 1.6;
  };
  PressureEngine.prototype.reset = function() { this.lastPoint = null; };
  PressureEngine.prototype.computeWidth = function(current, hardwarePressure) {
    const hp = hardwarePressure === undefined ? 0.5 : hardwarePressure;
    if (hp > 0 && hp !== 0.5 && hp <= 1.0) {
      return this.minWidth + (this.maxWidth - this.minWidth) * Math.pow(hp, 1.2);
    }
    if (!this.lastPoint) { this.lastPoint = current; return (this.minWidth + this.maxWidth) / 2; }
    const dx = current.x - this.lastPoint.x;
    const dy = current.y - this.lastPoint.y;
    const dt = Math.max(1, (current.time || 0) - (this.lastPoint.time || 0));
    const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
    this.lastPoint = current;
    const simulated = 1.0 - Math.max(0, Math.min(1, velocity / 2.5)) * 0.65;
    return this.minWidth + (this.maxWidth - this.minWidth) * simulated;
  };

  function drawSmoothStroke(ctx, points, color, width, isHighlighter) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color || '#ffffff';
    ctx.lineWidth = width || 4;
    ctx.globalAlpha = isHighlighter ? 0.35 : 1.0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  // 9. Vector Icons Helper (@gnflhs/icons)
  const SVG_PATHS = {
    check: '<polyline points="20 6 9 17 4 12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    device: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
  };
  function renderIcon(name, size) {
    const s = size || 16;
    const p = SVG_PATHS[name] || SVG_PATHS.bolt;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  const uiApi = {
    getDevice: function() { return currentDevice; },
    onDeviceChange: function(cb) { if (typeof cb === 'function') deviceListeners.push(cb); },
    refreshLayout: applyResponsiveAttributes,
    toast: showToast,
    confirm: function(msg) { return showDialog({ type: 'confirm', message: msg }); },
    prompt: function(msg, def) { return showDialog({ type: 'prompt', message: msg, defaultValue: def }); },
    alert: function(msg) { return showDialog({ type: 'alert', message: msg }); },
    parseTsv: parseTsv
  };

  const storageApi = {
    list: function(folder) {
      return callHostRpc('STORAGE_LIST', { folder: folder || 'shared' }, function() { return []; });
    }
  };

  const canvasApi = {
    StrokeStabilizer: StrokeStabilizer,
    PressureEngine: PressureEngine,
    drawSmoothStroke: drawSmoothStroke
  };

  window.GNFLHS = {
    projectId: __PROJECT_ID__,
    projectName: __PROJECT_NAME__,
    env: typedEnv,
    props: scriptPropertiesApi,
    cache: scriptCacheApi,
    createStore: createStore,
    auth: {
      getCurrentUser: function() { return Object.assign({}, __CURRENT_USER__); },
      isSuperAdmin: function() { return Boolean(__CURRENT_USER__.isSuperAdmin); }
    },
    db: dbApi,
    storage: storageApi,
    ui: uiApi,
    print: printKit,
    canvas: canvasApi,
    icon: renderIcon
  };
  window.GNUI = uiApi;
  window.GNStorage = storageApi;
  window.GNPrint = printKit;
  window.GNCanvas = canvasApi;

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-env]').forEach(function(el) {
      const key = el.getAttribute('data-env');
      if (key && scriptPropsStore[key] !== undefined) {
        el.textContent = scriptPropsStore[key];
      }
    });
    ${iconsEnabled ? `
    document.querySelectorAll('[data-gn-icon]').forEach(function(el) {
      el.innerHTML = renderIcon(el.getAttribute('data-gn-icon'), Number(el.getAttribute('data-size') || 16));
    });` : ''}
  });
})();
`;

  // 내장 플랫폼 SDK ES Module 브릿지 정의 (@gnflhs/*)
  const sdkModuleMap: Record<string, string> = {
    '@gnflhs/sdk': toEsmDataUri(`
      const G = window.GNFLHS;
      export const env = G.env;
      export const props = G.props;
      export const db = G.db;
      export const auth = G.auth;
      export const cache = G.cache;
      export const createStore = G.createStore;
      export const ui = G.ui;
      export const storage = G.storage;
      export const print = G.print;
      export const canvas = G.canvas;
      export default G;
    `),
    '@gnflhs/ui': toEsmDataUri(`
      const U = window.GNUI;
      export const ui = U;
      export const toast = U.toast;
      export const confirmDialog = U.confirm;
      export const promptDialog = U.prompt;
      export const alertDialog = U.alert;
      export const parseTsv = U.parseTsv;
      export const getDevice = U.getDevice;
      export const onDeviceChange = U.onDeviceChange;
      export default U;
    `),
    '@gnflhs/print': toEsmDataUri(`
      const P = window.GNPrint;
      export const configurePrint = P.configurePrint;
      export const fitSingleLine = P.fitSingleLine;
      export const fitAllSingleLine = P.fitAllSingleLine;
      export const printNow = P.printNow;
      export default P;
    `),
    '@gnflhs/canvas': toEsmDataUri(`
      const C = window.GNCanvas;
      export const StrokeStabilizer = C.StrokeStabilizer;
      export const PressureEngine = C.PressureEngine;
      export const drawSmoothStroke = C.drawSmoothStroke;
      export default C;
    `),
    '@gnflhs/storage': toEsmDataUri(`
      export const storage = window.GNStorage;
      export default window.GNStorage;
    `),
    '@gnflhs/icons': toEsmDataUri(`
      export const icon = window.GNFLHS.icon;
      export default window.GNFLHS.icon;
    `),
    ...manifestCustomImports
  };

  let html = htmlFile
    ? htmlFile.content
    : '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';

  const usesEsm = detectUsesEsModules(html, jsFiles);

  // about:srcdoc 및 data:text/javascript 모듈 내부에서도 상대경로(./state.js 등)가 100% 해석되도록
  // 로컬 VFS 모듈 참조를 WHATWG 표준 Bare Specifier(@vfs/*)로 정규화
  const resolveLocalBareSpec = (rawSpec: string): string | null => {
    if (!rawSpec.startsWith('./') && !rawSpec.startsWith('/')) return null;
    const stripped = rawSpec.replace(/^(?:\.\/|\/)+/, '');
    const matched = jsFiles.find(
      (f) =>
        f.name === stripped ||
        f.name.replace(/\.(m?js|gs)$/, '') === stripped
    );
    return matched ? `@vfs/${matched.name.replace(/^\.?\//, '')}` : null;
  };

  const rewriteLocalVfsImports = (sourceCode: string): string => {
    return sourceCode
      .replace(
        /((?:import|export)\s+(?:[\s\S]*?\s+from\s+)?)(['"])(\.?\/[^'"]+)\2/g,
        (full, prefix, quote, spec) => {
          const mapped = resolveLocalBareSpec(spec);
          return mapped ? `${prefix}${quote}${mapped}${quote}` : full;
        }
      )
      .replace(
        /(import\s*\(\s*)(['"])(\.?\/[^'"]+)\2(\s*\))/g,
        (full, prefix, quote, spec, suffix) => {
          const mapped = resolveLocalBareSpec(spec);
          return mapped ? `${prefix}${quote}${mapped}${quote}${suffix}` : full;
        }
      );
  };

  if (usesEsm) {
    // 프로젝트 내 모든 로컬 JS/MJS 파일을 Bare Specifier(@vfs/*)로 ImportMap에 등록
    jsFiles.forEach((jf) => {
      const cleanName = jf.name.replace(/^\.?\//, '');
      const noExt = cleanName.replace(/\.(m?js|gs)$/, '');
      const transformedCode = rewriteLocalVfsImports(jf.content);
      const uri = toEsmDataUri(`// Module: ${cleanName}\n${transformedCode}`);
      sdkModuleMap[`@vfs/${cleanName}`] = uri;
      sdkModuleMap[`@vfs/${noExt}`] = uri;
      sdkModuleMap[cleanName] = uri;
    });
  }

  const importMapTag = `<script type="importmap">\n${JSON.stringify({ imports: sdkModuleMap }, null, 2)}\n</script>`;

  // viewport 메타 태그 보장
  if (!html.includes('name="viewport"')) {
    const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n  ${viewportMeta}`);
    } else {
      html = `<head>${viewportMeta}</head>${html}`;
    }
  }

  // 외부 로컬 CSS 링크 태그 제거 후 인라인 주입
  cssFiles.forEach((cf) => {
    const escaped = cf.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<link[^>]*href=["']\\.?\\/?${escaped}["'][^>]*>`, 'gi'), '');
  });
  const combinedCss = [uiKitCss, ...cssFiles.map((c) => `/* ${c.name} */\n${c.content}`)]
    .filter(Boolean)
    .join('\n');

  // ImportMap은 반드시 모든 module script보다 먼저 <head> 최상단에 위치해야 함
  const headInjection = `${importMapTag}\n<script>\n${runtimeBootstrapJs}\n</script>${
    combinedCss ? `\n<style>\n${combinedCss}\n</style>` : ''
  }`;

  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${headInjection}`);
  } else {
    html = `<head>\n${headInjection}\n</head>\n${html}`;
  }

  // 로컬 스크립트 태그 추출 및 실행 순서 결정
  const referencedScripts: string[] = [];
  const scriptTagRegex = /<script[^>]*src=["']\.?\/?([^"']+)["'][^>]*>\s*<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTagRegex.exec(html)) !== null) {
    const srcName = match[1].trim();
    if (jsFiles.some((jf) => jf.name === srcName)) {
      referencedScripts.push(srcName);
    }
  }

  // 로컬 스크립트 태그 제거
  jsFiles.forEach((jf) => {
    const escaped = jf.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`<script[^>]*src=["']\\.?\\/?${escaped}["'][^>]*>\\s*<\\/script>`, 'gi'),
      ''
    );
  });

  let bodyScriptBlock = '';
  if (usesEsm) {
    // 인라인 <script type="module"> 내부 상대경로도 @vfs/*로 정규화
    html = html.replace(
      /(<script[^>]*type=["']module["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
      (_m, openTag, innerCode, closeTag) => `${openTag}${rewriteLocalVfsImports(innerCode)}${closeTag}`
    );

    // ESM 모드: HTML에서 참조한 엔트리 모듈(없으면 script.js / main.js / 첫 파일)을 @vfs/* Bare Specifier로 구동
    const entryNames =
      referencedScripts.length > 0
        ? referencedScripts
        : [
            (
              jsFiles.find((f) => f.name === 'script.js' || f.name === 'main.js' || f.name === 'index.js') ||
              jsFiles[0]
            )?.name
          ].filter(Boolean);
    const importLines = entryNames
      .map((n) => `import '@vfs/${n.replace(/^\.?\//, '')}';`)
      .join('\n');
    bodyScriptBlock = importLines ? `<script type="module">\n${importLines}\n</script>` : '';
  } else {
    // 클래식 호환 모드: HTML에 선언된 순서 우선 + 나머지 파일 순서대로 실행
    const orderedFiles: VirtualFile[] = [];
    referencedScripts.forEach((name) => {
      const found = jsFiles.find((f) => f.name === name);
      if (found && !orderedFiles.includes(found)) orderedFiles.push(found);
    });
    jsFiles.forEach((f) => {
      if (!orderedFiles.includes(f)) orderedFiles.push(f);
    });
    const combinedUserJs = orderedFiles.map((j) => `// === ${j.name} ===\n${j.content}`).join('\n\n');
    bodyScriptBlock = combinedUserJs ? `<script>\n${combinedUserJs}\n</script>` : '';
  }

  if (bodyScriptBlock) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${bodyScriptBlock}\n</body>`);
    } else {
      html = `${html}\n${bodyScriptBlock}`;
    }
  }

  return html;
}

/**
 * 새 프로젝트 생성 시 제공되는 V2 모듈형(ES Module + env.json) 표준 템플릿
 */
export function getStarterFilesForPlugin(
  _templateKey?: string,
  title: string = '새 스마트스쿨 앱'
): VirtualFile[] {
  return [
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
      <div style="display:flex;gap:8px;">
        <button id="btnAddCard" class="gn-btn gn-btn-primary">+ 항목 추가</button>
      </div>
    </header>

    <div class="gn-layout">
      <aside class="gn-card" data-tier="sidebar">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">빠른 도구</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button class="gn-btn" id="btnResetItems">기본값 복원</button>
        </div>
      </aside>

      <main class="gn-main">
        <section id="cardContainer" class="gn-grid"></section>
      </main>
    </div>
  </div>
  <script type="module" src="./script.js"></script>
</body>
</html>`
    },
    {
      name: 'script.js',
      content: `import { env, db, auth } from '@gnflhs/sdk';
import { toast, promptDialog, confirmDialog, getDevice, onDeviceChange } from '@gnflhs/ui';
import { DEFAULT_ITEMS } from './state.js';

const collection = db.collection('items_v1');
const user = auth.getCurrentUser();

function syncDeviceBadge() {
  const badge = document.getElementById('viewportBadge');
  if (badge) {
    badge.textContent = \`\${env.str('SCHOOL_NAME')} · \${getDevice().toUpperCase()}\`;
  }
}
syncDeviceBadge();
onDeviceChange(syncDeviceBadge);

async function render() {
  const items = await collection.getAll(DEFAULT_ITEMS);
  const container = document.getElementById('cardContainer');
  container.innerHTML = items.map((item) => \`
    <article class="gn-card">
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;">\${item.title}</div>
      <div data-tier="core" style="font-size:13px;color:#334155;line-height:1.5;">\${item.core}</div>
      <div data-tier="detail" style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:11px;color:#64748b;">
        \${item.detail}
      </div>
    </article>
  \`).join('');
}

document.getElementById('btnAddCard').onclick = async () => {
  const title = await promptDialog('새 항목 제목을 입력하세요:', '');
  if (!title) return;
  await collection.add({
    title,
    core: '스튜디오 V2 모듈에서 등록된 항목입니다.',
    detail: '작성자: ' + (user.email || '교사')
  });
  toast('새 항목이 저장되었습니다.', 'success');
  render();
};

const btnReset = document.getElementById('btnResetItems');
if (btnReset) {
  btnReset.onclick = async () => {
    if (!(await confirmDialog('기본 데이터로 초기화하시겠습니까?'))) return;
    await collection.saveAll(DEFAULT_ITEMS);
    toast('초기화 완료');
    render();
  };
}

render();`
    },
    {
      name: 'state.js',
      content: `// 모듈 분리 예제: 비즈니스 데이터 및 헬퍼 함수 모듈
export const DEFAULT_ITEMS = [
  { id: '1', title: '1교시 수업 자료', core: '영어 독해 심화 워크시트 배포', detail: '담당: 영어과 · 대상: 2학년 전체' },
  { id: '2', title: '야간 자습 좌석 현황', core: '면학실 A동 잔여 12석', detail: '감독 교사 확인 완료 · 실시간 동기화' },
  { id: '3', title: '방과후 특강 신청', core: '국제관계 세미나 신청 마감 임박', detail: '신청률 88% · 시청각실 진행' }
];
`
    },
    {
      name: 'style.css',
      content: `body {
  margin: 0;
  background: var(--gn-bg, #f8fafc);
  color: var(--gn-text, #0f172a);
  font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif;
}
`
    },
    {
      name: 'env.json',
      content: JSON.stringify(
        {
          APP_TITLE: title,
          SCHOOL_NAME: '경남외국어고등학교',
          UI_PC_COLS: '3',
          UI_TABLET_COLS: '2',
          UI_MOBILE_COLS: '1',
          UI_TABLET_SHOW_DETAIL: 'true',
          UI_MOBILE_SHOW_DETAIL: 'false'
        },
        null,
        2
      )
    }
  ];
}
