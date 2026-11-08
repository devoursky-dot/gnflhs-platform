# GNFLHS Studio & Plugin V2 표준 아키텍처 (Gemini AI-First 명세)

이 문서는 AI 에이전트(Gemini 등)와 개발자가 **플랫폼 코어(`apps/portal`)를 매번 수정하지 않고 오직 개별 앱(`plugins/<app-id>/`) 제작에만 100% 집중**할 수 있도록 설계된 **GNFLHS V2 표준 규격**입니다.

---

## 0. 2계층(Two-Tier) 중앙집중식 환경변수 & 방어 검증 아키텍처

하드코딩으로 인한 오작동(`NaN`, 레이아웃 붕괴, 환경설정 드리프트, 샌드박스 플래그 불일치)을 원천 방지하기 위해 플랫폼 전체는 **2계층 환경변수 체계**로 동작합니다.

1. **Tier 1 — 플랫폼 전역 설정 (루트 `.env` 단일 원천)**
   - **Frontend (Vite 4개 워크스페이스 공통)**: `packages/shared-types/src/platformEnv.ts`가 루트 `.env`(`envDir: '../..'`)를 읽어 상·하한 범위 클램핑(`safeInt`, `safeStr`, `safeCsvList`)을 거친 `PLATFORM_ENV`, `FIRESTORE_COLLECTIONS`, `LOCAL_STORAGE_KEYS`, `STORAGE_ROOT_FOLDERS`를 제공합니다.
   - **Node CLI (`sync-plugins.mjs`, `db-query.mjs`)**: `scripts/load-env.mjs`가 루트 `.env`를 직접 파싱하여 `CLI_FIREBASE_CONFIG`, `CLI_ENV`, `CLI_COLLECTIONS`를 제공합니다.
2. **Tier 2 — 개별 배포 앱 설정 (`plugins/<app-id>/env.json` + `config.js`)**
   - 각 앱의 모든 수치·문자열·배열 기본값은 `env.json`에 선언하며, 앱 내부 `config.js`에서 `@gnflhs/sdk`의 `env`를 통해 로드한 뒤 **방어적 클램핑(`clampInt`, `clampFloat`, 비어있지 않은 배열 폴백)**을 거쳐 `Object.freeze(...)` 상수로 노출합니다.
   - 따라서 스튜디오 환경변수 탭에서 잘못된 값이 입력되더라도 앱 런타임 오작동이 절대 발생하지 않습니다.

---

## 1. 시스템 보호 경계 (최고관리자 전용 앱 격리)

- **`account-manager` (`/account/`)** 는 최고관리자(`super_admin`) 전용 **통합 계정·권한 시스템 콘솔**입니다.
- 일반 배포 카탈로그(`Firestore plugins`)나 스튜디오 배포 대상에 절대 등록되지 않으며(`VITE_RESERVED_SYSTEM_IDS=account-manager`), 포털 상단 `SUPER ADMIN CONSOLE` 바 및 `<SuperAdminGuard>`를 통해서만 접근할 수 있습니다.

---

## 2. 직관적 3단계 배포 파이프라인 (1:1 연결 구조)

기존처럼 편집할 때마다 `(사본)` 프로젝트나 난수 ID(`app-xxxxxx`)가 중복 생성되지 않습니다. 모든 앱은 **시맨틱 ID 1:1 매핑**으로 동작합니다.

1. **[1단계: HEAD 작업본 편집]** (`studio_projects/proj-<app-id>`)
   - 포털 카드의 `편집` 버튼 또는 CLI `node scripts/sync-plugins.mjs push <app-id>` 실행 시, 운영 중인 `LIVE` 앱에 아무 영향을 주지 않고 `HEAD` 작업본만 안전하게 갱신됩니다.
   - 스튜디오 우측 **실시간 분할 샌드박스 프리뷰**(`PC` / `TABLET` / `MOBILE`)와 `TEST` 러너에서 즉시 검증합니다.
2. **[2단계: 채널 선택 버전 릴리즈]** (`plugins/<app-id>`)
   - 검증이 끝나면 `🟡 BETA 검증 채널`(`development`, 최고관리자 미리보기 전용) 또는 `🟢 정식 운영 채널`(`production`, 교사·학생 공개)과 접근 허용 역할(`교사` / `학생`)을 지정하여 버전을 릴리즈합니다.
3. **[3단계: 스냅샷 이력 & 1초 즉시 롤백]** (`deployments[]`)
   - 배포할 때마다 파일·`env.json`·런타임 설정 전체가 불변 스냅샷으로 보존되며, 문제 발생 시 스튜디오 `배포 · 롤백` 탭에서 이전 버전으로 **1초 만에 즉시 롤백**하거나 특정 스냅샷을 `HEAD`로 다시 불러올 수 있습니다.

---

## 3. 앱 표준 디렉토리 구조 (`plugins/<app-id>/`)

별도의 Webpack/Vite 설정 없이 브라우저 네이티브 `<script type="importmap">` + `@vfs/*` 가상 모듈 컴파일러(`apps/portal/src/services/studioCompiler.ts` 및 `services/compiler/*`)가 상대경로 로컬 모듈(`./config.js` 등)을 `@vfs/*` Bare Specifier로 자동 매핑·결합합니다.

```text
plugins/<app-id>/
 ├── index.html     # 앱 마크업 (<script type="module" src="./script.js"></script>)
 ├── config.js      # env.json 로드 및 방어적 범위 검증(clamp) 전용 설정 모듈
 ├── state.js       # 상태·스토리지·도메인 비즈니스 로직 모듈 (기능별 자유 분할)
 ├── script.js      # 메인 엔트리 UI 렌더링 & 이벤트 컨트롤러
 ├── style.css      # 스타일시트 (:root { --env-* } CSS 변수 자동 주입)
 └── env.json       # 선언형 환경변수 (코드 수정 없이 학교명·수치·컬럼수 제어)
```

---

## 4. 선언형 환경변수 (`env.json`) & 자동 바인딩

`env.json`에 정의된 모든 키-값은 스튜디오 에디터의 **환경변수 빠른 편집 바**, **설정 탭**, **HTML/CSS/JS**와 양방향 자동 동기화됩니다.

- **JavaScript 타입 안전 조회 (`@gnflhs/sdk`)**:
  ```js
  import { env } from '@gnflhs/sdk';

  const school = env.str('SCHOOL_NAME', '경남외국어고등학교');
  const cols   = env.int('DEFAULT_ZONES', 3);
  const ratio  = env.float('SMOOTHING_FACTOR', 0.42);
  const grid   = env.bool('SHOW_GRID_DEFAULT', true);
  const themes = env.json('BOARD_THEMES', ['#0f172a', '#ffffff']);
  ```
- **HTML 자동 텍스트 바인딩**:
  `<h1 data-env="APP_TITLE">기본 제목</h1>` ➔ `env.json`의 `APP_TITLE` 값으로 자동 치환
- **CSS Custom Properties 자동 주입**:
  `env.json`의 `"PRIMARY_ACCENT": "#2563eb"` ➔ CSS에서 `var(--env-primary-accent)`로 즉시 참조 가능

---

## 5. 내장 공유 모듈 라이브러리 (`@gnflhs/*` ES Modules)

모든 앱에서 별도 설치 없이 즉시 `import`하여 사용할 수 있습니다.

| 패키지명 | 주요 Export 심볼 | 설명 |
| :--- | :--- | :--- |
| `@gnflhs/sdk` | `env`, `db`, `auth`, `cache`, `createStore` | 환경변수, Firestore 영구 KV/컬렉션(`db.collection('name')`), 로그인 사용자 정보, Undo/Redo 반응형 스토어 |
| `@gnflhs/ui` | `toast`, `confirmDialog`, `promptDialog`, `alertDialog`, `parseTsv`, `getDevice`, `onDeviceChange` | 샌드박스 호환 비동기 모달 다이얼로그, 토스트 알림, 나이스/엑셀 TSV 파서, 반응형 뷰포트 감지 |
| `@gnflhs/print` | `configurePrint`, `fitSingleLine`, `fitAllSingleLine`, `printNow` | A4 가로/세로 1페이지 인쇄 여백 제어 및 긴 학생 이름 줄바꿈 방지 자동 폭 축소(`font-size` / `condensed`) |
| `@gnflhs/canvas` | `StrokeStabilizer`, `PressureEngine`, `drawSmoothStroke` | 삼성노트 REA 역추적 기반 손떨림 보정, 구형 전자칠판 속도 가변 필압 엔진, 2차 베지에 곡선 벡터 렌더링 |
| `@gnflhs/storage` | `storage` | 플랫폼 클라우드 스토리지 폴더 조회 브릿지 |
| `@gnflhs/icons` | `icon` | 경량 인라인 SVG 벡터 아이콘 생성기 |

---

## 6. CLI 빠른 명령어 (`scripts/sync-plugins.mjs`)

```bash
# 1. 전체 로컬/원격(LIVE·HEAD) 앱 인벤토리 확인
node scripts/sync-plugins.mjs list

# 2. 새 V2 모듈형 앱 템플릿 즉시 생성
node scripts/sync-plugins.mjs scaffold club-apply "동아리 수강신청"

# 3. 로컬 수정본을 스튜디오 작업본(HEAD)에만 반영 (운영 LIVE 영향 없음)
node scripts/sync-plugins.mjs push seating-chart

# 4. 로컬 수정본을 HEAD 동기화 + 정식 운영(LIVE) 버전 스냅샷으로 즉시 릴리즈
node scripts/sync-plugins.mjs deploy seating-chart 1.3.0 "5단 모듈화 및 환경변수 분리"

# 5. 운영(LIVE) 배포본 소스를 로컬 plugins/ 폴더로 내려받기
node scripts/sync-plugins.mjs pull
```
