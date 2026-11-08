/**
 * GNFLHS V2 스튜디오 가상 모듈(VFS) & ImportMap 컴파일러 오케스트레이터
 * - 하위 모듈 분리:
 *   1) ./compiler/studioDefaults.ts : 공유 라이브러리·서비스 메타데이터 및 스타터 템플릿
 *   2) ./compiler/envSync.ts        : env.json 양방향 동기화 · 시그니처 비교 · AI 명세서 생성
 *   3) ./compiler/runtimeBootstrap.ts : 샌드박스 V8 런타임 & @gnflhs/* ES 모듈 브릿지 생성
 */
import {
  DeviceViewportType,
  StudioLibraryBinding,
  StudioRuntimeConfig,
  VirtualFile
} from '@gnflhs/shared-types';
import {
  DEFAULT_LIBRARIES,
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SCRIPT_PROPERTIES
} from './compiler/studioDefaults';
import { extractEnvFromFiles } from './compiler/envSync';
import {
  buildRuntimeBootstrapJs,
  buildSdkImportMap,
  buildUiKitCss,
  toEsmDataUri
} from './compiler/runtimeBootstrap';

export * from './compiler/studioDefaults';
export * from './compiler/envSync';

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
 * 스튜디오 멀티 파일 + env.json + ES Module ImportMap(@vfs/* & @gnflhs/*)을 단일 실행 HTML로 결합
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
  const jsFiles = files.filter(
    (f) => f.name.endsWith('.js') || f.name.endsWith('.mjs') || f.name.endsWith('.gs')
  );

  const uiKitCss = buildUiKitCss(mergedProps, uiKitEnabled);
  const runtimeBootstrapJs = buildRuntimeBootstrapJs({
    projectId,
    projectName,
    forcedDevice,
    runtimeConfig,
    mergedProps,
    iconsEnabled,
    currentUser
  });
  const sdkModuleMap = buildSdkImportMap(manifestCustomImports);

  let html = htmlFile
    ? htmlFile.content
    : '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';

  const usesEsm = detectUsesEsModules(html, jsFiles);

  // about:srcdoc 및 data:text/javascript 모듈 내부에서도 상대경로(./config.js 등)가 100% 해석되도록
  // 로컬 VFS 모듈 참조를 WHATWG 표준 Bare Specifier(@vfs/*)로 정규화
  const resolveLocalBareSpec = (rawSpec: string): string | null => {
    if (!rawSpec.startsWith('./') && !rawSpec.startsWith('/')) return null;
    const stripped = rawSpec.replace(/^(?:\.\/|\/)+/, '');
    const matched = jsFiles.find(
      (f) => f.name === stripped || f.name.replace(/\.(m?js|gs)$/, '') === stripped
    );
    return matched ? `@vfs/${matched.name.replace(/^\.?\//, '')}` : null;
  };

  const rewriteLocalVfsImports = (sourceCode: string): string => {
    return sourceCode
      .replace(
        /\b((?:import|export)\s+(?:type\s+)?[\w$*{}\s,]+\s+from\s+)(['"])(\.?\/[^'"]+)\2/g,
        (full, prefix, quote, spec) => {
          const mapped = resolveLocalBareSpec(spec);
          return mapped ? `${prefix}${quote}${mapped}${quote}` : full;
        }
      )
      .replace(/\b(import\s+)(['"])(\.?\/[^'"]+)\2/g, (full, prefix, quote, spec) => {
        const mapped = resolveLocalBareSpec(spec);
        return mapped ? `${prefix}${quote}${mapped}${quote}` : full;
      })
      .replace(
        /\b(import\s*\(\s*)(['"])(\.?\/[^'"]+)\2(\s*\))/g,
        (full, prefix, quote, spec, suffix) => {
          const mapped = resolveLocalBareSpec(spec);
          return mapped ? `${prefix}${quote}${mapped}${quote}${suffix}` : full;
        }
      );
  };

  if (usesEsm) {
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

  if (!html.includes('name="viewport"')) {
    const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n  ${viewportMeta}`);
    } else {
      html = `<head>${viewportMeta}</head>${html}`;
    }
  }

  cssFiles.forEach((cf) => {
    const escaped = cf.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<link[^>]*href=["']\\.?\\/?${escaped}["'][^>]*>`, 'gi'), '');
  });
  const combinedCss = [uiKitCss, ...cssFiles.map((c) => `/* ${c.name} */\n${c.content}`)]
    .filter(Boolean)
    .join('\n');

  const headInjection = `${importMapTag}\n<script>\n${runtimeBootstrapJs}\n</script>${
    combinedCss ? `\n<style>\n${combinedCss}\n</style>` : ''
  }`;

  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${headInjection}`);
  } else {
    html = `<head>\n${headInjection}\n</head>\n${html}`;
  }

  const referencedScripts: string[] = [];
  const scriptTagRegex = /<script[^>]*src=["']\.?\/?([^"']+)["'][^>]*>\s*<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTagRegex.exec(html)) !== null) {
    const srcName = match[1].trim();
    if (jsFiles.some((jf) => jf.name === srcName)) {
      referencedScripts.push(srcName);
    }
  }

  jsFiles.forEach((jf) => {
    const escaped = jf.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`<script[^>]*src=["']\\.?\\/?${escaped}["'][^>]*>\\s*<\\/script>`, 'gi'),
      ''
    );
  });

  let bodyScriptBlock = '';
  if (usesEsm) {
    html = html.replace(
      /(<script[^>]*type=["']module["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
      (_m, openTag, innerCode, closeTag) => `${openTag}${rewriteLocalVfsImports(innerCode)}${closeTag}`
    );

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
