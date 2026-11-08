import {
  PLATFORM_ENV,
  StudioLibraryBinding,
  StudioRuntimeConfig,
  VirtualFile
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
  timeZone: PLATFORM_ENV.TIMEZONE,
  showManifest: true,
  cacheEnabled: true,
  cacheTtlSec: PLATFORM_ENV.DEFAULT_CACHE_TTL_SEC
};

export const DEFAULT_SCRIPT_PROPERTIES: Record<string, string> = {
  SCHOOL_NAME: PLATFORM_ENV.SCHOOL_NAME,
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
const school = env.str('SCHOOL_NAME');
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
    summary: 'A4 가로/세로 1페이지 인쇄 규격 제어 및 긴 이름 줄바꿈 방지 자동 축소(font-size/condensed)',
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
          SCHOOL_NAME: PLATFORM_ENV.SCHOOL_NAME,
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
