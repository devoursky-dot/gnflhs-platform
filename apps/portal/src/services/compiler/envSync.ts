import {
  PLATFORM_ENV,
  StudioLibraryBinding,
  StudioRuntimeConfig,
  VirtualFile
} from '@gnflhs/shared-types';
import {
  BUILTIN_LIBRARIES,
  DEFAULT_LIBRARIES,
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SCRIPT_PROPERTIES,
  DEFAULT_SERVICES
} from './studioDefaults';

/**
 * 가상 파일 배열 내 env.json에서 환경변수 추출 (JSON 오류 시 빈 객체 반환하여 오작동 방어)
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
 * scriptProperties 객체를 env.json 파일 내용으로 직렬화하여 가상 파일 배열에 양방향 동기화
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
      timeZone: runtimeConfig.timeZone || PLATFORM_ENV.TIMEZONE,
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
- \`script.js\` 및 분리 모듈(\`config.js\`, \`state.js\` 등): \`import { ... } from './config.js'\` 형태로 자유롭게 모듈화
- \`style.css\`: 스타일시트 (\`env.json\`의 모든 키가 \`:root { --env-키이름 }\` CSS 변수로 자동 주입됨)
- \`env.json\`: 선언형 환경변수 파일 (코드 하드코딩 없이 상수·옵션·기본값 일괄 제어)

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
- JS 조회: \`env.str('KEY', '기본값')\`, \`env.int('KEY', 3)\`, \`env.float('KEY', 0.5)\`, \`env.bool('KEY', true)\`, \`env.json('KEY', [])\`
- DB 영구 저장: \`await db.get('key')\`, \`await db.set('key', data)\`, \`db.collection('records')\`
`;
}
