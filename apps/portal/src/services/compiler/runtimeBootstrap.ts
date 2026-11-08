import {
  DeviceViewportType,
  LOCAL_STORAGE_KEYS,
  PLATFORM_ENV,
  StudioRuntimeConfig
} from '@gnflhs/shared-types';

export function toEsmDataUri(code: string): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

export function buildUiKitCss(mergedProps: Record<string, string>, enabled: boolean): string {
  if (!enabled) return '';

  const envCssVars = Object.entries(mergedProps)
    .map(([k, v]) => {
      const cssKey = '--env-' + k.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const safeVal = String(v).replace(/[\r\n;{}]/g, '').trim();
      return safeVal ? `  ${cssKey}: ${safeVal};` : '';
    })
    .filter(Boolean)
    .join('\n');

  return `
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
`;
}

export function buildSdkImportMap(customImports: Record<string, string> = {}): Record<string, string> {
  return {
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
    ...customImports
  };
}

export interface RuntimeBootstrapParams {
  projectId: string;
  projectName: string;
  forcedDevice: DeviceViewportType | 'auto';
  runtimeConfig: StudioRuntimeConfig;
  mergedProps: Record<string, string>;
  iconsEnabled: boolean;
  currentUser: {
    email: string | null;
    displayName: string | null;
    isSuperAdmin: boolean;
  } | null;
}

export function buildRuntimeBootstrapJs(params: RuntimeBootstrapParams): string {
  const {
    projectId,
    projectName,
    forcedDevice,
    runtimeConfig,
    mergedProps,
    iconsEnabled,
    currentUser
  } = params;

  const tabletBp = PLATFORM_ENV.VIEWPORTS.tablet.width;
  const pcBp = PLATFORM_ENV.VIEWPORTS.tablet.height;

  return `
(function() {
  const __PROJECT_ID__ = ${JSON.stringify(projectId)};
  const __PROJECT_NAME__ = ${JSON.stringify(projectName)};
  const __FORCED_DEVICE__ = ${JSON.stringify(forcedDevice)};
  const __RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};
  const __SCRIPT_PROPS__ = ${JSON.stringify(mergedProps)};
  const __CACHE_PREFIX__ = ${JSON.stringify(LOCAL_STORAGE_KEYS.STUDIO_CACHE_PREFIX)} + __PROJECT_ID__ + '_';
  const __LOCALDB_KEY__ = ${JSON.stringify(LOCAL_STORAGE_KEYS.RUNTIME_LOCALDB_PREFIX)} + __PROJECT_ID__;
  const __CURRENT_USER__ = ${JSON.stringify(
    currentUser || {
      email: `guest@${PLATFORM_ENV.SCHOOL_EMAIL_DOMAIN}`,
      displayName: '방문자',
      isSuperAdmin: false
    }
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
          return Object.prototype.hasOwnProperty.call(target, k) && String(target[k]).trim() !== ''
            ? String(target[k])
            : (fallback !== undefined ? String(fallback) : '');
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
  const scriptCacheApi = {
    get: function(key) {
      if (!__RUNTIME_CONFIG__.cacheEnabled) return null;
      try {
        const raw = localStorage.getItem(__CACHE_PREFIX__ + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.exp && Date.now() > parsed.exp) {
          localStorage.removeItem(__CACHE_PREFIX__ + key);
          return null;
        }
        return parsed.val;
      } catch (e) { return null; }
    },
    put: function(key, value, expirationInSeconds) {
      if (!__RUNTIME_CONFIG__.cacheEnabled) return;
      const ttl = Number(expirationInSeconds || __RUNTIME_CONFIG__.cacheTtlSec || ${PLATFORM_ENV.DEFAULT_CACHE_TTL_SEC});
      try {
        localStorage.setItem(__CACHE_PREFIX__ + key, JSON.stringify({
          val: String(value),
          exp: Date.now() + ttl * 1000,
          updatedAt: Date.now()
        }));
        postToHost('CACHE_UPDATED', { key: key, ttl: ttl });
      } catch (e) {}
    },
    remove: function(key) {
      try { localStorage.removeItem(__CACHE_PREFIX__ + key); postToHost('CACHE_UPDATED', { key: key }); } catch (e) {}
    },
    removeAll: function() {
      try {
        Object.keys(localStorage).forEach(function(k) {
          if (k.indexOf(__CACHE_PREFIX__) === 0) localStorage.removeItem(k);
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
    if (w < ${tabletBp}) return 'mobile';
    if (w < ${pcBp}) return 'tablet';
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

  function readLocalDb() {
    try { return JSON.parse(localStorage.getItem(__LOCALDB_KEY__) || '{}'); } catch (e) { return {}; }
  }
  function writeLocalDb(obj) {
    try { localStorage.setItem(__LOCALDB_KEY__, JSON.stringify(obj)); } catch (e) {}
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
    ${
      iconsEnabled
        ? `
    document.querySelectorAll('[data-gn-icon]').forEach(function(el) {
      el.innerHTML = renderIcon(el.getAttribute('data-gn-icon'), Number(el.getAttribute('data-size') || 16));
    });`
        : ''
    }
  });
})();
`;
}
