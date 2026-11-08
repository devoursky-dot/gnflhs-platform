/**
 * GNFLHS 플랫폼 통합 환경변수 및 시스템 상수 중앙 관리 모듈
 * - 모든 앱(portal, account-manager, whiteboard-note, dormitory-penalty)이 단일 루트 .env를 참조
 * - 잘못된 환경변수(빈 문자열, NaN, 범위 이탈 등) 입력으로 인한 런타임 오작동을 방어하는 타입 검증기 내장
 */

const rawEnv: Record<string, string | boolean | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : {};

function safeStr(key: string, fallback: string): string {
  const val = rawEnv[key];
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(/^["']|["']$/g, '');
    if (trimmed.length > 0) return trimmed;
  }
  return fallback;
}

function safeInt(key: string, fallback: number, min: number, max: number): number {
  const val = rawEnv[key];
  const parsed = typeof val === 'string' ? parseInt(val.trim(), 10) : Number(val);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeCsvList(key: string, fallback: string[]): string[] {
  const val = rawEnv[key];
  if (typeof val !== 'string' || !val.trim()) return [...fallback];
  const items = val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [...fallback];
}

export const PLATFORM_ENV = {
  // 1. 관리자 및 기관 식별 환경변수
  SUPER_ADMIN_EMAIL: safeStr('VITE_SUPER_ADMIN_EMAIL', 'devoursky@gmail.com'),
  SCHOOL_NAME: safeStr('VITE_SCHOOL_NAME', '경남외국어고등학교'),
  SCHOOL_EMAIL_DOMAIN: safeStr('VITE_SCHOOL_EMAIL_DOMAIN', 'gnflhs.hs.kr'),
  ACADEMIC_YEAR: safeStr('VITE_ACADEMIC_YEAR', '2026'),
  TIMEZONE: safeStr('VITE_TIMEZONE', 'Asia/Seoul'),
  APP_VERSION: safeStr('VITE_APP_VERSION', '2.0.0'),
  IS_DEV: Boolean(rawEnv.DEV),

  // 2. 포털 타이틀 및 시스템 전용 경로/예약어
  PORTAL_TITLE: safeStr('VITE_PORTAL_TITLE', 'GNFLHS 스마트 스쿨 플랫폼'),
  PORTAL_SUBTITLE: safeStr('VITE_PORTAL_SUBTITLE', '경남외국어고등학교 모듈형 통합 학습·생활 포털'),
  ACCOUNT_CONSOLE_PATH: safeStr('VITE_ACCOUNT_CONSOLE_PATH', '/account/'),
  RESERVED_SYSTEM_IDS: safeCsvList('VITE_RESERVED_SYSTEM_IDS', ['account-manager']),

  // 3. Firebase 연결 환경변수
  FIREBASE: {
    apiKey: safeStr('VITE_FIREBASE_API_KEY', ''),
    authDomain: safeStr('VITE_FIREBASE_AUTH_DOMAIN', 'gnflhs.firebaseapp.com'),
    projectId: safeStr('VITE_FIREBASE_PROJECT_ID', 'gnflhs'),
    storageBucket: safeStr('VITE_FIREBASE_STORAGE_BUCKET', 'gnflhs.firebasestorage.app'),
    messagingSenderId: safeStr('VITE_FIREBASE_MESSAGING_SENDER_ID', ''),
    appId: safeStr('VITE_FIREBASE_APP_ID', '')
  },

  // 4. 스튜디오 런타임 · 배포 스냅샷 · 샌드박스 보안 정책
  MAX_DEPLOYMENT_SNAPSHOTS: safeInt('VITE_MAX_DEPLOYMENT_SNAPSHOTS', 30, 5, 100),
  DEFAULT_CACHE_TTL_SEC: safeInt('VITE_DEFAULT_CACHE_TTL_SEC', 300, 10, 86400),
  IFRAME_SANDBOX_FLAGS: safeStr(
    'VITE_SANDBOX_FLAGS',
    'allow-scripts allow-modals allow-same-origin allow-forms allow-downloads allow-popups'
  ),

  // 5. 디바이스 시뮬레이션 표준 뷰포트 규격
  VIEWPORTS: {
    tablet: {
      width: safeInt('VITE_VIEWPORT_TABLET_W', 768, 480, 1600),
      height: safeInt('VITE_VIEWPORT_TABLET_H', 1024, 480, 2000)
    },
    mobile: {
      width: safeInt('VITE_VIEWPORT_MOBILE_W', 390, 280, 767),
      height: safeInt('VITE_VIEWPORT_MOBILE_H', 844, 480, 1200)
    }
  }
} as const;

export const FIRESTORE_COLLECTIONS = {
  PLUGINS: 'plugins',
  STUDIO_PROJECTS: 'studio_projects',
  PLUGIN_DATA: 'plugin_data',
  PLUGIN_DATA_ITEMS: 'items',
  USERS: 'users',
  PLATFORM_SETTINGS: 'platform_settings',
  STORAGE_META: 'storage_meta',
  GLOBAL_PROPERTIES_DOC: 'global_properties',
  CUSTOM_COLLECTIONS_DOC: 'custom_collections',
  KNOWN_COLLECTIONS: [
    { name: 'plugins', isSystem: true },
    { name: 'studio_projects', isSystem: true },
    { name: 'plugin_data', isSystem: true },
    { name: 'users', isSystem: true },
    { name: 'platform_settings', isSystem: true },
    { name: 'storage_meta', isSystem: true },
    { name: 'dormitory_records', isSystem: false },
    { name: 'whiteboard_sessions', isSystem: false },
    { name: 'study_rooms', isSystem: false }
  ]
} as const;

export const LOCAL_STORAGE_KEYS = {
  STUDIO_PROJECTS_INDEX: 'gnflhs_studio_projects_index_v1',
  STUDIO_DRAFT_PREFIX: 'gnflhs_studio_draft_',
  STUDIO_CACHE_PREFIX: 'gnflhs_cache_',
  RUNTIME_LOCALDB_PREFIX: 'gnflhs_localdb_'
} as const;

export const STORAGE_ROOT_FOLDERS = [
  { id: 'shared', label: '공용 자료', path: 'shared' },
  { id: 'whiteboard', label: '칠판 판서', path: 'plugins/whiteboard' },
  { id: 'dormitory', label: '기숙사 증빙', path: 'dormitory-evidence' },
  { id: 'teachers', label: '교직원함', path: 'teachers' },
  { id: 'system', label: '시스템', path: 'system' }
] as const;
