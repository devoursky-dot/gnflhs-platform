/**
 * Node CLI 스크립트(sync-plugins.mjs, db-query.mjs 등) 전용 루트 .env 로더 및 공통 설정 모듈
 * - 외부 패키지 의존성 없이 루트 .env를 직접 파싱하며 process.env 환경변수 우선권을 보장합니다.
 * - 스크립트 파일 내부의 Firebase API Key / 컬렉션명 하드코딩을 완전히 제거합니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..');
export const PLUGINS_DIR = path.join(ROOT_DIR, 'plugins');

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(path.join(ROOT_DIR, '.env'));

export function getEnv(key, fallback = '') {
  const val = process.env[key] ?? fileEnv[key];
  if (val !== undefined && String(val).trim() !== '') {
    return String(val).trim();
  }
  return fallback;
}

export function getEnvInt(key, fallback, min = 1, max = 100000) {
  const n = parseInt(getEnv(key, String(fallback)), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const CLI_FIREBASE_CONFIG = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'gnflhs.firebaseapp.com'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'gnflhs'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'gnflhs.firebasestorage.app'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

if (!CLI_FIREBASE_CONFIG.apiKey) {
  throw new Error(
    '[load-env] VITE_FIREBASE_API_KEY가 누락되었습니다. 프로젝트 루트의 .env 파일을 확인해주세요.'
  );
}

export const CLI_ENV = {
  SUPER_ADMIN_EMAIL: getEnv('VITE_SUPER_ADMIN_EMAIL', 'devoursky@gmail.com'),
  SCHOOL_NAME: getEnv('VITE_SCHOOL_NAME', '경남외국어고등학교'),
  ACADEMIC_YEAR: getEnv('VITE_ACADEMIC_YEAR', '2026'),
  TIMEZONE: getEnv('VITE_TIMEZONE', 'Asia/Seoul'),
  DEFAULT_CACHE_TTL_SEC: getEnvInt('VITE_DEFAULT_CACHE_TTL_SEC', 300, 10, 86400),
  MAX_DEPLOYMENT_SNAPSHOTS: getEnvInt('VITE_MAX_DEPLOYMENT_SNAPSHOTS', 15, 5, 100),
  RESERVED_SYSTEM_IDS: getEnv('VITE_RESERVED_SYSTEM_IDS', 'account-manager')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};

export const CLI_COLLECTIONS = {
  PLUGINS: 'plugins',
  STUDIO_PROJECTS: 'studio_projects',
  PLUGIN_DATA: 'plugin_data',
  PLUGIN_DATA_ITEMS: 'items',
  USERS: 'users',
  PLATFORM_SETTINGS: 'platform_settings',
  STORAGE_META: 'storage_meta',
  KNOWN_LIST: [
    'plugins',
    'studio_projects',
    'plugin_data',
    'users',
    'dormitory_records',
    'whiteboard_sessions',
    'study_rooms',
    'platform_settings',
    'storage_meta'
  ]
};
