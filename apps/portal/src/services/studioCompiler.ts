import {
  VirtualFile,
  StudioLibraryBinding,
  StudioRuntimeConfig,
  DeviceViewportType
} from '@gnflhs/shared-types';

export interface SharedLibraryMeta {
  id: string;
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
  showManifest: false,
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
  { libraryId: 'gnflhs-storage-bridge', version: '1.0.0', enabled: true, identifier: 'GNStorage' },
  { libraryId: 'gnflhs-icons-mini', version: '1.0.0', enabled: false, identifier: 'GNIcons' }
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
    name: 'Core Runtime SDK',
    identifier: 'GNFLHS',
    version: '1.0.0',
    summary: 'Auth · Firestore DB · PropertiesService · CacheService · Logger 통합 코어 모듈',
    snippet: `const school = PropertiesService.getScriptProperties().getProperty('SCHOOL_NAME');
const user = GNFLHS.auth.getCurrentUser();
await GNFLHS.db.set('memo_1', { author: user.email, updatedAt: Date.now() });`
  },
  {
    id: 'gnflhs-ui-kit',
    name: 'Responsive UI & Device Kit',
    identifier: 'GNUI',
    version: '1.0.0',
    summary: 'PC(전체 표시) · 태블릿 · 스마트폰 표준 표시 제어(data-tier) 및 공통 UI 컴포넌트',
    snippet: `<!-- HTML 표준 티어 제어: PC는 전체 표시, 태블릿/모바일은 스크립트 속성에 따라 자동 조절 -->
<aside data-tier="sidebar">PC 전용 사이드바</aside>
<section data-tier="core">모든 기기 핵심 영역</section>
<div data-tier="detail">보조 상세 영역 (속성 제어)</div>
<div data-tier="pc-only">PC 전용 고급 통계</div>`
  },
  {
    id: 'gnflhs-storage-bridge',
    name: 'Cloud Storage Bridge',
    identifier: 'GNStorage',
    version: '1.0.0',
    summary: '플랫폼 클라우드 스토리지 폴더 조회 및 파일 연동 모듈',
    snippet: `const files = await GNFLHS.storage.list('shared');
console.log('공용 폴더 파일:', files);`
  },
  {
    id: 'gnflhs-icons-mini',
    name: 'Vector Icons Pack',
    identifier: 'GNIcons',
    version: '1.0.0',
    summary: '경량 인라인 SVG 벡터 아이콘 렌더링 헬퍼 (data-gn-icon)',
    snippet: `document.body.insertAdjacentHTML('beforeend', GNFLHS.icon('check', 18));`
  }
];

export const BUILTIN_SERVICES: BuiltinServiceMeta[] = [
  {
    id: 'PropertiesService',
    name: 'PropertiesService',
    globalSymbol: 'PropertiesService',
    summary: '스크립트 속성(환경변수) 및 사용자별 속성 조회/저장'
  },
  {
    id: 'CacheService',
    name: 'CacheService',
    globalSymbol: 'CacheService',
    summary: 'TTL 만료 기반 스크립트 캐시 조회/저장/초기화'
  },
  {
    id: 'FirestoreDB',
    name: 'FirestoreDB',
    globalSymbol: 'GNFLHS.db',
    summary: '앱별 격리 컬렉션(plugin_data) 실시간 읽기/쓰기 브릿지'
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

export function buildManifestContent(
  runtimeConfig: StudioRuntimeConfig = DEFAULT_RUNTIME_CONFIG,
  libraries: StudioLibraryBinding[] = DEFAULT_LIBRARIES,
  services: string[] = DEFAULT_SERVICES
): string {
  return JSON.stringify(
    {
      timeZone: runtimeConfig.timeZone || 'Asia/Seoul',
      runtimeVersion: runtimeConfig.runtimeVersion || 'V8',
      webapp: {
        executeAs: 'USER_ACCESSING',
        access: 'DOMAIN',
        responsivePolicy: 'PROPERTIES_DRIVEN'
      },
      cache: {
        enabled: runtimeConfig.cacheEnabled,
        defaultTtlSeconds: runtimeConfig.cacheTtlSec
      },
      dependencies: {
        enabledServices: services,
        libraries: libraries
          .filter((l) => l.enabled)
          .map((l) => ({
            userSymbol: l.identifier || l.libraryId,
            libraryId: l.libraryId,
            version: l.version,
            developmentMode: l.version === 'HEAD'
          }))
      }
    },
    null,
    2
  );
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

/**
 * 스튜디오 멀티 파일 + 스크립트 속성 + 공유 라이브러리 + V8 런타임 브릿지를 단일 실행 HTML로 인메모리 결합
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

  const mergedProps: Record<string, string> = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...globalProperties,
    ...scriptProperties
  };

  const uiKitEnabled = libraries.some((l) => l.libraryId === 'gnflhs-ui-kit' && l.enabled);
  const iconsEnabled = libraries.some((l) => l.libraryId === 'gnflhs-icons-mini' && l.enabled);

  const htmlFile = files.find((f) => f.name === 'index.html') || files.find((f) => f.name.endsWith('.html')) || files[0];
  const cssFiles = files.filter((f) => f.name.endsWith('.css'));
  const jsFiles = files.filter((f) => f.name.endsWith('.js') || f.name.endsWith('.gs'));

  const uiKitCss = uiKitEnabled
    ? `
/* === GNFLHS Standardized Responsive UI Kit === */
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

/* 표준 디바이스별 표시 조절 (PC는 100% 전체 표시) */
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
  window.Logger = {
    log: function() {
      const msg = Array.prototype.slice.call(arguments).map(formatArg).join(' ');
      postToHost('EXECUTION_LOG', { level: 'info', message: '[Logger] ' + msg, timestamp: Date.now() });
    }
  };

  // 2. PropertiesService (Apps Script 호환 스크립트/사용자 속성)
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

  // 3. CacheService (TTL 만료 관리)
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

  // 4. Standardized Device Detection & Script-Property-Driven Responsive Engine
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

  // 5. Async RPC Bridge for Firestore DB & Cloud Storage (with Local Fallback)
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

  // Inline Vector Icons Helper
  const SVG_PATHS = {
    check: '<polyline points="20 6 9 17 4 12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    device: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
  };
  function renderIcon(name, size) {
    const s = size || 16;
    const p = SVG_PATHS[name] || SVG_PATHS.bolt;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  window.GNFLHS = {
    projectId: __PROJECT_ID__,
    projectName: __PROJECT_NAME__,
    env: scriptPropsStore,
    props: scriptPropertiesApi,
    cache: scriptCacheApi,
    auth: {
      getCurrentUser: function() { return Object.assign({}, __CURRENT_USER__); }
    },
    db: {
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
      }
    },
    storage: {
      list: function(folder) {
        return callHostRpc('STORAGE_LIST', { folder: folder || 'shared' }, function() { return []; });
      }
    },
    ui: {
      getDevice: function() { return currentDevice; },
      onDeviceChange: function(cb) { if (typeof cb === 'function') deviceListeners.push(cb); },
      refreshLayout: applyResponsiveAttributes,
      toast: function(msg) {
        const el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 10px 25px rgba(0,0,0,0.25);';
        document.body.appendChild(el);
        setTimeout(function() { el.remove(); }, 2400);
      }
    },
    icon: renderIcon
  };
  window.GNUI = window.GNFLHS.ui;
  window.GNStorage = window.GNFLHS.storage;
  ${iconsEnabled ? `
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-gn-icon]').forEach(function(el) {
      el.innerHTML = renderIcon(el.getAttribute('data-gn-icon'), Number(el.getAttribute('data-size') || 16));
    });
  });` : ''}
})();
`;

  let html = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';

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
  const combinedCss = [uiKitCss, ...cssFiles.map((c) => `/* ${c.name} */\n${c.content}`)].filter(Boolean).join('\n');
  if (combinedCss) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', `<style>\n${combinedCss}\n</style>\n</head>`);
    } else {
      html = `<style>\n${combinedCss}\n</style>\n${html}`;
    }
  }

  // 외부 로컬 JS 스크립트 태그 제거 후 런타임 부트스트랩 + 사용자 스크립트 순서로 주입
  jsFiles.forEach((jf) => {
    const escaped = jf.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<script[^>]*src=["']\\.?\\/?${escaped}["'][^>]*>\\s*<\\/script>`, 'gi'), '');
  });
  const combinedUserJs = jsFiles.map((j) => `// === ${j.name} ===\n${j.content}`).join('\n\n');
  const fullScriptBlock = `<script>\n${runtimeBootstrapJs}\n</script>\n<script>\n${combinedUserJs}\n</script>`;

  if (html.includes('</body>')) {
    html = html.replace('</body>', `${fullScriptBlock}\n</body>`);
  } else {
    html = `${html}\n${fullScriptBlock}`;
  }

  return html;
}

/**
 * 새 프로젝트 또는 기존 운영 앱 복사 시 제공되는 표준 멀티 파일 템플릿
 */
export function getStarterFilesForPlugin(templateKey?: string, title: string = '새 스마트스쿨 앱'): VirtualFile[] {
  // 기본 표준 반응형 앱 스타터 템플릿 (새 프로젝트 생성용)
  return [
    {
      name: 'index.html',
      content: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="gn-shell">
    <header class="gn-toolbar">
      <div style="display:flex;align-items:center;gap:10px;">
        <h2 id="projectHeading" style="margin:0;font-size:18px;">${title}</h2>
        <span id="viewportBadge" class="gn-badge"></span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="btnAddCard" class="gn-btn gn-btn-primary">+ 항목 추가</button>
      </div>
    </header>

    <div class="gn-layout">
      <!-- 사이드바: PC 표시 / 태블릿·모바일은 스크립트 속성(UI_*_SHOW_SIDEBAR)으로 자동 제어 -->
      <aside class="gn-card" data-tier="sidebar">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">빠른 메뉴</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button class="gn-btn" id="btnCacheTest">캐시 점검</button>
          <button class="gn-btn" id="btnResetItems">초기화</button>
        </div>
      </aside>

      <main class="gn-main">
        <!-- PC 전용 요약 바: 태블릿·스마트폰에서는 자동 숨김 -->
        <section class="gn-card" data-tier="pc-only" style="margin-bottom:16px;background:#eff6ff;border-color:#bfdbfe;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:13px;color:#1e40af;">데스크톱 전체 보기 모드</strong>
            <span id="schoolPropText" style="font-size:12px;color:#1d4ed8;"></span>
          </div>
        </section>

        <!-- 표준 반응형 그리드: PC(3열) / 태블릿(2열) / 스마트폰(1열) -->
        <section id="cardContainer" class="gn-grid"></section>
      </main>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`
    },
    {
      name: 'script.js',
      content: `const props = PropertiesService.getScriptProperties();
const cache = CacheService.getScriptCache();
const user = GNFLHS.auth.getCurrentUser();

const defaultItems = [
  { title: '1교시 수업 자료', core: '영어 독해 심화 워크시트 배포', detail: '담당: 영어과 · 대상: 2학년 전체' },
  { title: '야간 자습 좌석 현황', core: '면학실 A동 잔여 12석', detail: '감독 교사 확인 완료 · 실시간 동기화' },
  { title: '방과후 특강 신청', core: '국제관계 세미나 신청 마감 임박', detail: '신청률 88% · 시청각실 진행' }
];

function updateHeaderInfo() {
  const dev = GNFLHS.ui.getDevice();
  document.getElementById('viewportBadge').textContent = dev.toUpperCase();
  const schoolEl = document.getElementById('schoolPropText');
  if (schoolEl) {
    schoolEl.textContent = (props.getProperty('SCHOOL_NAME') || '') + ' · ' + (user.email || '');
  }
}
updateHeaderInfo();
GNFLHS.ui.onDeviceChange(updateHeaderInfo);

async function renderCards() {
  let items = await GNFLHS.db.get('items');
  if (!items || !Array.isArray(items)) {
    items = defaultItems;
    await GNFLHS.db.set('items', items);
  }
  cache.put('items_count', String(items.length), 300);

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
  const title = prompt('새 항목 제목:');
  if (!title) return;
  const items = (await GNFLHS.db.get('items')) || defaultItems;
  items.unshift({
    title,
    core: '스튜디오에서 추가된 신규 카드 항목입니다.',
    detail: '작성자: ' + (user.email || '관리자')
  });
  await GNFLHS.db.set('items', items);
  console.log('항목 추가됨:', title);
  renderCards();
};

const btnCache = document.getElementById('btnCacheTest');
if (btnCache) {
  btnCache.onclick = () => {
    const cached = cache.get('items_count');
    GNFLHS.ui.toast('CacheService 저장 건수: ' + (cached || '없음'));
  };
}

const btnReset = document.getElementById('btnResetItems');
if (btnReset) {
  btnReset.onclick = async () => {
    await GNFLHS.db.set('items', defaultItems);
    renderCards();
    GNFLHS.ui.toast('기본 데이터로 초기화되었습니다.');
  };
}

renderCards();`
    },
    {
      name: 'style.css',
      content: `body {
  margin: 0;
  background: #f8fafc;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}`
    }
  ];
}
