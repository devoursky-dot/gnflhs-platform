import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { isSuperAdmin } from '@gnflhs/shared-auth';
import {
  AppPlugin,
  DeviceViewportType,
  PluginDeployment,
  PluginStatus,
  StudioLibraryBinding,
  StudioProject,
  StudioRuntimeConfig,
  UserRole,
  VirtualFile
} from '@gnflhs/shared-types';
import { ENV } from '../config/env';
import {
  activateDeploymentSnapshot,
  publishStudioProjectAsNewApp,
  removeDeploymentSnapshot,
  suggestNextVersion,
  updateDeploymentMetadata,
  upgradeAppWithStudioProject
} from '../services/pluginService';
import {
  attachRuntimeRpcBridge,
  CacheEntryInfo,
  clearProjectCache,
  cloneAppToStudioProject,
  createBlankStudioProject,
  deleteStudioProject,
  listProjectCacheEntries,
  openOrEnsureAppWorkspace,
  restoreSnapshotToWorkspace,
  saveGlobalProperties,
  saveStudioProject
} from '../services/studioService';
import {
  BUILTIN_LIBRARIES,
  BUILTIN_SERVICES,
  buildGeminiDeveloperSpec,
  buildManifestContent,
  compileStudioBundle,
  computeBundleSignature,
  DEFAULT_LIBRARIES,
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SCRIPT_PROPERTIES,
  DEFAULT_SERVICES,
  extractEnvFromFiles,
  getStarterFilesForPlugin,
  syncEnvJsonFile
} from '../services/studioCompiler';
import {
  Play,
  Copy,
  RotateCcw,
  Trash2,
  X,
  FileCode,
  Palette,
  Code2,
  Plus,
  Monitor,
  Tablet,
  Smartphone,
  CheckCircle2,
  Save,
  Rocket,
  Layers,
  SlidersHorizontal,
  Terminal,
  FolderKanban,
  Eraser,
  Lock,
  Pencil,
  Braces,
  Package,
  Cpu,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Database,
  Search,
  Table,
  Columns2,
  Sparkles,
  GitBranch,
  RefreshCw
} from 'lucide-react';
import {
  listActiveCollections,
  registerCustomCollection,
  subscribeCollection,
  executeDatabaseQuery,
  upsertRow,
  deleteRow,
  CollectionMeta,
  DatabaseRowItem
} from '../services/dbQueryService';

interface PluginDevStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: AppPlugin[];
  studioProjects: StudioProject[];
  globalProperties: Record<string, string>;
  currentUser: User | null;
  initialProjectId?: string | null;
}

type StudioSection = 'projects' | 'editor' | 'database' | 'settings' | 'deployments' | 'executions';

interface ExecutionLogItem {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export const PluginDevStudioModal: React.FC<PluginDevStudioModalProps> = ({
  isOpen,
  onClose,
  plugins,
  studioProjects,
  globalProperties,
  currentUser,
  initialProjectId
}) => {
  const [activeSection, setActiveSection] = useState<StudioSection>('editor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  // 작업본(HEAD) 상태
  const [projectName, setProjectName] = useState<string>('');
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [activeFileName, setActiveFileName] = useState<string>('index.html');
  const [scriptProps, setScriptProps] = useState<Record<string, string>>({
    ...DEFAULT_SCRIPT_PROPERTIES
  });
  const [libraries, setLibraries] = useState<StudioLibraryBinding[]>([...DEFAULT_LIBRARIES]);
  const [services, setServices] = useState<string[]>([...DEFAULT_SERVICES]);
  const [runtimeConfig, setRuntimeConfig] = useState<StudioRuntimeConfig>({
    ...DEFAULT_RUNTIME_CONFIG
  });
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // 인라인 실시간 프리뷰 상태
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [previewDevice, setPreviewDevice] = useState<DeviceViewportType>('pc');
  const [previewReloadKey, setPreviewReloadKey] = useState<number>(0);

  // 라인 번호 스크롤 동기화
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 전역 및 프로젝트 환경변수 편집 상태
  const [globalPropsDraft, setGlobalPropsDraft] = useState<Record<string, string>>({});
  const [newPropKey, setNewPropKey] = useState<string>('');
  const [newPropVal, setNewPropVal] = useState<string>('');
  const [newGlobalKey, setNewGlobalKey] = useState<string>('');
  const [newGlobalVal, setNewGlobalVal] = useState<string>('');

  // 사이드바 섹션 토글
  const [openFilesTree, setOpenFilesTree] = useState<boolean>(true);
  const [openEnvTree, setOpenEnvTree] = useState<boolean>(true);
  const [openLibsTree, setOpenLibsTree] = useState<boolean>(true);
  const [openServicesTree, setOpenServicesTree] = useState<boolean>(false);
  const [showLibPicker, setShowLibPicker] = useState<boolean>(false);

  // 로그 & 캐시
  const [showBottomLogs, setShowBottomLogs] = useState<boolean>(false);
  const [logs, setLogs] = useState<ExecutionLogItem[]>([]);
  const [cacheEntries, setCacheEntries] = useState<CacheEntryInfo[]>([]);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // 배포 파이프라인 폼 상태
  const [deployMode, setDeployMode] = useState<'upgrade' | 'new'>('upgrade');
  const [deployTargetAppId, setDeployTargetAppId] = useState<string>('');
  const [deployChannel, setDeployChannel] = useState<PluginStatus>('production');
  const [deployAllowedRoles, setDeployAllowedRoles] = useState<UserRole[]>([
    'super_admin',
    'admin',
    'teacher',
    'student'
  ]);
  const [deployNewAppName, setDeployNewAppName] = useState<string>('');
  const [deployNewAppId, setDeployNewAppId] = useState<string>('');
  const [deployNewIcon, setDeployNewIcon] = useState<string>('Puzzle');
  const [deployNewCategory, setDeployNewCategory] = useState<'classroom' | 'management' | 'utility'>(
    'classroom'
  );
  const [deployVersion, setDeployVersion] = useState<string>('1.1.0');
  const [deployNote, setDeployNote] = useState<string>('');
  const [historyFilterAppId, setHistoryFilterAppId] = useState<string>('all');

  // 데이터베이스 스튜디오 상태
  const [dbCollections, setDbCollections] = useState<CollectionMeta[]>([]);
  const [selectedColName, setSelectedColName] = useState<string>('plugins');
  const [colSearchQuery, setColSearchQuery] = useState<string>('');
  const [colRows, setColRows] = useState<DatabaseRowItem[]>([]);
  const [dbQueryText, setDbQueryText] = useState<string>('SELECT * FROM plugins LIMIT 50');
  const [dbQueryOutput, setDbQueryOutput] = useState<{
    success: boolean;
    message: string;
    elapsed?: number;
  } | null>(null);
  const [dbIsLoading, setDbIsLoading] = useState<boolean>(false);
  const [dbViewMode, setDbViewMode] = useState<'table' | 'json'>('table');
  const [editingRowModal, setEditingRowModal] = useState<{
    isOpen: boolean;
    isNew: boolean;
    docId: string;
    jsonText: string;
  }>({
    isOpen: false,
    isNew: false,
    docId: '',
    jsonText: ''
  });

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 2600);
  };

  useEffect(() => {
    setGlobalPropsDraft({ ...globalProperties });
  }, [globalProperties]);

  useEffect(() => {
    if (!isOpen) return;
    const detachRpc = attachRuntimeRpcBridge();
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || !data.__gnflhs_studio__) return;
      if (data.type === 'EXECUTION_LOG' && data.payload) {
        setLogs((prev) => [data.payload as ExecutionLogItem, ...prev].slice(0, 120));
      } else if (data.type === 'CACHE_UPDATED') {
        refreshCacheInspector();
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      detachRpc();
      window.removeEventListener('message', onMsg);
    };
  }, [isOpen, selectedTarget]);

  // 초기 진입 타겟 결정
  useEffect(() => {
    if (!isOpen) return;
    if (initialProjectId) {
      setSelectedTarget(`proj:${initialProjectId}`);
      setActiveSection('editor');
      return;
    }
    if (!selectedTarget) {
      if (studioProjects.length > 0) {
        setSelectedTarget(`proj:${studioProjects[0].id}`);
      } else if (plugins.length > 0) {
        setSelectedTarget(`app:${plugins[0].id}`);
      }
    }
  }, [isOpen, initialProjectId, studioProjects.length, plugins.length]);

  const isStudioProjectSelected = selectedTarget.startsWith('proj:');
  const activeStudioProject: StudioProject | undefined = useMemo(() => {
    if (!isStudioProjectSelected) return undefined;
    const id = selectedTarget.slice(5);
    return studioProjects.find((p) => p.id === id);
  }, [selectedTarget, studioProjects, isStudioProjectSelected]);

  const activeReadOnlyApp: AppPlugin | undefined = useMemo(() => {
    if (isStudioProjectSelected) return undefined;
    const id = selectedTarget.startsWith('app:') ? selectedTarget.slice(4) : selectedTarget;
    return plugins.find((p) => p.id === id) || plugins[0];
  }, [selectedTarget, plugins, isStudioProjectSelected]);

  const linkedOperatingApp: AppPlugin | undefined = useMemo(() => {
    if (activeReadOnlyApp) return activeReadOnlyApp;
    if (!activeStudioProject) return undefined;
    const linkedId =
      activeStudioProject.publishedPluginId ||
      activeStudioProject.sourcePluginId ||
      activeStudioProject.id.replace(/^proj-/, '');
    return plugins.find((p) => p.id === linkedId);
  }, [activeStudioProject, activeReadOnlyApp, plugins]);

  const currentScopeId = activeStudioProject?.id || activeReadOnlyApp?.id || 'studio-temp';
  const isReadOnly = !isStudioProjectSelected;

  // 작업본(HEAD)과 운영본(LIVE) 간 변경 유무 판정
  const hasUnreleasedChanges = useMemo(() => {
    if (!activeStudioProject) return false;
    if (!linkedOperatingApp) return true;
    const headSig = computeBundleSignature(files, scriptProps);
    const liveSig = computeBundleSignature(
      linkedOperatingApp.files || [],
      linkedOperatingApp.scriptProperties || {}
    );
    return headSig !== liveSig;
  }, [activeStudioProject, linkedOperatingApp, files, scriptProps]);

  const refreshCacheInspector = () => {
    setCacheEntries(listProjectCacheEntries(currentScopeId));
  };

  // 타겟 변경 시 에디터 상태 로드
  useEffect(() => {
    if (activeStudioProject) {
      setProjectName(activeStudioProject.name);
      const mergedProps = {
        ...DEFAULT_SCRIPT_PROPERTIES,
        ...(activeStudioProject.scriptProperties || {}),
        ...extractEnvFromFiles(activeStudioProject.files || [])
      };
      const ensuredFiles = syncEnvJsonFile(
        activeStudioProject.files.map((f) => ({ ...f })),
        mergedProps
      );
      setFiles(ensuredFiles);
      setActiveFileName(ensuredFiles[0]?.name || 'index.html');
      setScriptProps(mergedProps);
      setLibraries(
        activeStudioProject.libraries?.length
          ? activeStudioProject.libraries.map((l) => ({ ...l }))
          : DEFAULT_LIBRARIES.map((l) => ({ ...l }))
      );
      setServices(
        activeStudioProject.services?.length ? [...activeStudioProject.services] : [...DEFAULT_SERVICES]
      );
      setRuntimeConfig({ ...DEFAULT_RUNTIME_CONFIG, ...(activeStudioProject.runtimeConfig || {}) });
      setIsDirty(false);

      const candidateId =
        activeStudioProject.publishedPluginId ||
        activeStudioProject.sourcePluginId ||
        activeStudioProject.id.replace(/^proj-/, '');
      const matchedApp = plugins.find((p) => p.id === candidateId);

      if (matchedApp) {
        setDeployMode('upgrade');
        setDeployTargetAppId(matchedApp.id);
        setDeployChannel(matchedApp.status === 'disabled' ? 'production' : matchedApp.status);
        setDeployAllowedRoles(
          matchedApp.allowedRoles || ['super_admin', 'admin', 'teacher', 'student']
        );
        setDeployVersion(suggestNextVersion(matchedApp.version));
      } else {
        setDeployMode('new');
        setDeployChannel('production');
        setDeployAllowedRoles(['super_admin', 'admin', 'teacher', 'student']);
        setDeployNewAppName(activeStudioProject.name);
        setDeployNewAppId(
          activeStudioProject.id
            .replace(/^proj-(fork-)?/, '')
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
        );
        setDeployVersion('1.0.0');
      }
      setCacheEntries(listProjectCacheEntries(activeStudioProject.id));
    } else if (activeReadOnlyApp) {
      setProjectName(activeReadOnlyApp.name);
      const roBase =
        activeReadOnlyApp.files && activeReadOnlyApp.files.length > 0
          ? activeReadOnlyApp.files
          : getStarterFilesForPlugin(activeReadOnlyApp.id, activeReadOnlyApp.name);
      const mergedProps = {
        ...DEFAULT_SCRIPT_PROPERTIES,
        ...(activeReadOnlyApp.scriptProperties || {}),
        ...extractEnvFromFiles(roBase)
      };
      const roFiles = syncEnvJsonFile(roBase, mergedProps);
      setFiles(roFiles);
      setActiveFileName(roFiles[0]?.name || 'index.html');
      setScriptProps(mergedProps);
      setLibraries(
        activeReadOnlyApp.libraries?.length ? activeReadOnlyApp.libraries : DEFAULT_LIBRARIES
      );
      setServices([...DEFAULT_SERVICES]);
      setRuntimeConfig({ ...DEFAULT_RUNTIME_CONFIG, ...(activeReadOnlyApp.runtimeConfig || {}) });
      setIsDirty(false);
      setCacheEntries(listProjectCacheEntries(activeReadOnlyApp.id));
    }
  }, [activeStudioProject?.id, activeStudioProject?.updatedAt, activeReadOnlyApp?.id, plugins.length]);

  // Ctrl+S 단축키 저장
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isReadOnly) {
          handleSaveProject();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // 현재 표시할 파일 목록 (env.json 항상 보장 + appsscript.json 선택 표시)
  const displayedFiles: VirtualFile[] = useMemo(() => {
    const core = files.filter((f) => f.name !== 'appsscript.json');
    // index.html -> .js/.mjs -> .css -> env.json 순서 정렬
    const rank = (n: string) => {
      if (n === 'index.html') return 0;
      if (n.endsWith('.html')) return 1;
      if (n === 'script.js' || n === 'main.js') return 2;
      if (n.endsWith('.js') || n.endsWith('.mjs')) return 3;
      if (n.endsWith('.css')) return 4;
      if (n === 'env.json') return 5;
      return 6;
    };
    const sorted = [...core].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
    if (runtimeConfig.showManifest) {
      sorted.push({
        name: 'appsscript.json',
        content:
          files.find((f) => f.name === 'appsscript.json')?.content ||
          buildManifestContent(runtimeConfig, libraries, services)
      });
    }
    return sorted;
  }, [files, runtimeConfig, libraries, services]);

  const activeFile = displayedFiles.find((f) => f.name === activeFileName) || displayedFiles[0];
  const lineCount = useMemo(
    () => Math.max(1, (activeFile?.content || '').split('\n').length),
    [activeFile?.content]
  );

  // 인라인 실시간 프리뷰 컴파일 결과
  const livePreviewSrcDoc = useMemo(() => {
    if (!showLivePreview) return '';
    return compileStudioBundle({
      projectId: currentScopeId,
      projectName: projectName || 'Studio Preview',
      files,
      scriptProperties: scriptProps,
      globalProperties: globalPropsDraft,
      libraries,
      runtimeConfig,
      forcedDevice: previewDevice,
      currentUser: currentUser
        ? {
            email: currentUser.email,
            displayName: currentUser.displayName,
            isSuperAdmin: isSuperAdmin(currentUser)
          }
        : null
    });
  }, [
    showLivePreview,
    currentScopeId,
    projectName,
    files,
    scriptProps,
    globalPropsDraft,
    libraries,
    runtimeConfig,
    previewDevice,
    currentUser,
    previewReloadKey
  ]);

  const buildCurrentStudioSnapshot = (): StudioProject | null => {
    if (!activeStudioProject) return null;
    const envFromEditor = extractEnvFromFiles(files);
    const mergedProps = { ...scriptProps, ...envFromEditor };
    const syncedFiles = syncEnvJsonFile(files, mergedProps);
    return {
      ...activeStudioProject,
      name: projectName.trim() || activeStudioProject.name,
      files: syncedFiles,
      scriptProperties: mergedProps,
      libraries,
      services,
      runtimeConfig,
      updatedAt: Date.now()
    };
  };

  const handleSaveProject = async (): Promise<StudioProject | null> => {
    const snap = buildCurrentStudioSnapshot();
    if (!snap) return null;
    try {
      const saved = await saveStudioProject(snap);
      setFiles(saved.files);
      setScriptProps(saved.scriptProperties);
      setIsDirty(false);
      setPreviewReloadKey((k) => k + 1);
      showToast('작업본(HEAD) 저장됨');
      return saved;
    } catch (e: any) {
      alert('저장 실패: ' + (e?.message || e));
      return null;
    }
  };

  const handleCreateNewProject = async () => {
    const inputName = prompt('새 앱/프로젝트 이름:', `새 스마트스쿨 앱 ${studioProjects.length + 1}`);
    if (!inputName) return;
    const slug = prompt(
      '영문 고유 슬러그 ID (예: study-timer, club-apply):',
      `app-${Date.now().toString(36).slice(-5)}`
    );
    if (!slug) return;
    try {
      const created = await createBlankStudioProject(inputName, slug);
      setSelectedTarget(`proj:${created.id}`);
      setActiveSection('editor');
      showToast('새 V2 모듈 프로젝트 생성됨');
    } catch (e: any) {
      alert('생성 실패: ' + (e?.message || e));
    }
  };

  // [핵심 개선] 운영 앱의 1:1 연결 작업본(HEAD) 즉시 열기
  const handleOpenAppWorkspace = async (app: AppPlugin) => {
    try {
      const ws = await openOrEnsureAppWorkspace(app, studioProjects);
      setSelectedTarget(`proj:${ws.id}`);
      setActiveSection('editor');
      showToast(`'${app.name}' 작업본(HEAD) 열림`);
    } catch (e: any) {
      alert('작업본 열기 실패: ' + (e?.message || e));
    }
  };

  // 별도 새 앱으로 분기 복제 (Fork)
  const handleForkAsSeparateApp = async (app: AppPlugin) => {
    const forkName = prompt('분기하여 새로 만들 앱 이름:', `${app.name} (확장판)`);
    if (!forkName) return;
    try {
      const forked = await cloneAppToStudioProject(app, forkName);
      setSelectedTarget(`proj:${forked.id}`);
      setActiveSection('editor');
      showToast('별도 신규 앱 프로젝트로 분기 복제됨');
    } catch (e: any) {
      alert('분기 복제 실패: ' + (e?.message || e));
    }
  };

  const handleDeleteStudioProject = async (proj: StudioProject) => {
    if (!confirm(`'${proj.name}' 스튜디오 작업본을 삭제하시겠습니까?\n(이미 배포된 운영 앱에는 영향을 주지 않습니다.)`)) return;
    try {
      await deleteStudioProject(proj.id);
      const remaining = studioProjects.filter((p) => p.id !== proj.id);
      if (remaining.length > 0) {
        setSelectedTarget(`proj:${remaining[0].id}`);
      } else if (plugins.length > 0) {
        setSelectedTarget(`app:${plugins[0].id}`);
      }
      showToast('작업본 삭제됨');
    } catch (e: any) {
      alert('삭제 실패: ' + (e?.message || e));
    }
  };

  const handleRunInNewTab = async (targetDevice: DeviceViewportType) => {
    try {
      if (activeStudioProject) {
        const saved = isDirty ? await handleSaveProject() : activeStudioProject;
        const pid = saved?.id || activeStudioProject.id;
        window.open(`/?testRunner=${encodeURIComponent(pid)}&device=${targetDevice}`, '_blank');
      } else if (activeReadOnlyApp) {
        const tempProj: StudioProject = {
          id: `preview-${activeReadOnlyApp.id}`,
          name: activeReadOnlyApp.name,
          description: activeReadOnlyApp.description,
          icon: activeReadOnlyApp.icon,
          category: activeReadOnlyApp.category,
          sourcePluginId: activeReadOnlyApp.id,
          files,
          scriptProperties: scriptProps,
          libraries,
          services,
          runtimeConfig,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        localStorage.setItem(`gnflhs_studio_draft_${tempProj.id}`, JSON.stringify(tempProj));
        window.open(`/?testRunner=${encodeURIComponent(tempProj.id)}&device=${targetDevice}`, '_blank');
      }
    } catch (e: any) {
      alert('새 탭 실행 오류: ' + (e?.message || e));
    }
  };

  const handleAddFile = () => {
    if (isReadOnly) return;
    const rawName = prompt('추가할 모듈/파일 이름 (.js / .mjs / .css / .html):', 'utils.js');
    if (!rawName) return;
    const clean = rawName.trim();
    if (files.some((f) => f.name === clean)) {
      alert('동일한 파일 이름이 이미 존재합니다.');
      return;
    }
    const initialContent = clean.endsWith('.css')
      ? '/* 추가 스타일 모듈 */\n'
      : clean.endsWith('.html')
      ? '<!-- 추가 마크업 -->\n'
      : `// ES 모듈: script.js에서 import { helper } from './${clean}'; 로 즉시 호출 가능\nexport function helper() {\n  return true;\n}\n`;
    setFiles((prev) => [...prev, { name: clean, content: initialContent }]);
    setActiveFileName(clean);
    setIsDirty(true);
  };

  const handleRenameFile = (oldName: string) => {
    if (isReadOnly || oldName === 'appsscript.json' || oldName === 'env.json') return;
    const nextName = prompt('새 파일 이름:', oldName);
    if (!nextName || nextName.trim() === oldName) return;
    const clean = nextName.trim();
    setFiles((prev) => prev.map((f) => (f.name === oldName ? { ...f, name: clean } : f)));
    if (activeFileName === oldName) setActiveFileName(clean);
    setIsDirty(true);
  };

  const handleDeleteFile = (name: string) => {
    if (isReadOnly || name === 'index.html' || name === 'appsscript.json' || name === 'env.json') return;
    if (!confirm(`'${name}' 파일을 삭제하시겠습니까?`)) return;
    const next = files.filter((f) => f.name !== name);
    setFiles(next);
    if (activeFileName === name) setActiveFileName(next[0]?.name || 'index.html');
    setIsDirty(true);
  };

  const handleCodeChange = (val: string) => {
    if (isReadOnly) return;
    if (activeFileName === 'appsscript.json') {
      const exists = files.some((f) => f.name === 'appsscript.json');
      setFiles((prev) =>
        exists
          ? prev.map((f) => (f.name === 'appsscript.json' ? { ...f, content: val } : f))
          : [...prev, { name: 'appsscript.json', content: val }]
      );
    } else if (activeFileName === 'env.json') {
      setFiles((prev) => prev.map((f) => (f.name === 'env.json' ? { ...f, content: val } : f)));
      // 유효한 JSON이면 즉시 scriptProps와 동기화
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const nextProps: Record<string, string> = {};
          Object.entries(parsed).forEach(([k, v]) => {
            if (v !== undefined && v !== null) nextProps[k] = String(v);
          });
          setScriptProps(nextProps);
        }
      } catch {}
    } else {
      setFiles((prev) => prev.map((f) => (f.name === activeFileName ? { ...f, content: val } : f)));
    }
    setIsDirty(true);
  };

  // 환경변수 업데이트 시 env.json 파일 내용도 즉시 양방향 동기화
  const updateScriptProp = (key: string, value: string) => {
    if (isReadOnly) return;
    setScriptProps((prev) => {
      const next = { ...prev, [key]: value };
      setFiles((fPrev) => syncEnvJsonFile(fPrev, next));
      return next;
    });
    setIsDirty(true);
  };

  const removeScriptProp = (key: string) => {
    if (isReadOnly) return;
    setScriptProps((prev) => {
      const copy = { ...prev };
      delete copy[key];
      setFiles((fPrev) => syncEnvJsonFile(fPrev, copy));
      return copy;
    });
    setIsDirty(true);
  };

  const handleAddScriptProp = () => {
    if (isReadOnly || !newPropKey.trim()) return;
    updateScriptProp(newPropKey.trim(), newPropVal);
    setNewPropKey('');
    setNewPropVal('');
  };

  const handleSaveGlobalProps = async () => {
    const next = { ...globalPropsDraft };
    if (newGlobalKey.trim()) {
      next[newGlobalKey.trim()] = newGlobalVal;
      setNewGlobalKey('');
      setNewGlobalVal('');
    }
    setGlobalPropsDraft(next);
    await saveGlobalProperties(next);
    showToast('플랫폼 전역 환경변수 저장됨');
  };

  const toggleLibrary = (libId: string) => {
    if (isReadOnly) return;
    setLibraries((prev) => {
      const found = prev.find((l) => l.libraryId === libId);
      if (found) {
        return prev.map((l) => (l.libraryId === libId ? { ...l, enabled: !l.enabled } : l));
      }
      const meta = BUILTIN_LIBRARIES.find((m) => m.id === libId);
      return [
        ...prev,
        {
          libraryId: libId,
          version: 'HEAD',
          enabled: true,
          identifier: meta?.identifier || libId
        }
      ];
    });
    setIsDirty(true);
  };

  const toggleLibraryVersion = (libId: string) => {
    if (isReadOnly) return;
    setLibraries((prev) =>
      prev.map((l) =>
        l.libraryId === libId ? { ...l, version: l.version === 'HEAD' ? '2.0.0' : 'HEAD' } : l
      )
    );
    setIsDirty(true);
  };

  const toggleService = (serviceId: string) => {
    if (isReadOnly) return;
    setServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
    setIsDirty(true);
  };

  const handleCopyGeminiSpec = () => {
    const spec = buildGeminiDeveloperSpec(projectName || 'GNFLHS App', files, scriptProps);
    navigator.clipboard?.writeText(spec);
    showToast('Gemini 표준 개발 규격 클립보드 복사 완료');
  };

  // 통합 배포 릴리즈 실행
  const handleExecuteDeploy = async () => {
    const saved = await handleSaveProject();
    if (!saved) return;

    try {
      if (deployMode === 'new') {
        const cleanName = deployNewAppName.trim() || saved.name;
        const cleanId =
          deployNewAppId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') ||
          `app-${Date.now().toString(36)}`;
        if (plugins.some((p) => p.id === cleanId)) {
          alert(
            `이미 '${cleanId}' ID를 가진 운영 앱이 있습니다. '기존 운영 앱 업데이트' 모드를 선택하세요.`
          );
          return;
        }
        const published = await publishStudioProjectAsNewApp(
          saved,
          {
            appId: cleanId,
            name: cleanName,
            description: saved.description,
            icon: deployNewIcon,
            category: deployNewCategory,
            version: deployVersion.trim() || '1.0.0',
            note: deployNote.trim() || '신규 정식 릴리즈',
            channel: deployChannel,
            allowedRoles: deployAllowedRoles
          },
          globalPropsDraft
        );
        await saveStudioProject({
          ...saved,
          publishedPluginId: published.id,
          sourcePluginId: published.id
        });
        setDeployMode('upgrade');
        setDeployTargetAppId(published.id);
        setDeployVersion(suggestNextVersion(published.version));
        setDeployNote('');
        showToast(
          `'${published.name}' ${deployChannel === 'production' ? '정식(LIVE)' : '베타(BETA)'} 배포 완료`
        );
      } else {
        const targetApp = plugins.find((p) => p.id === deployTargetAppId);
        if (!targetApp) {
          alert('업데이트할 대상 운영 앱을 선택해주세요.');
          return;
        }
        const upgraded = await upgradeAppWithStudioProject(
          saved,
          targetApp,
          deployVersion.trim() || suggestNextVersion(targetApp.version),
          deployNote.trim() || `v${deployVersion.trim()} 업데이트 릴리즈`,
          globalPropsDraft,
          {
            channel: deployChannel,
            allowedRoles: deployAllowedRoles
          }
        );
        await saveStudioProject({
          ...saved,
          publishedPluginId: upgraded.id,
          sourcePluginId: upgraded.id
        });
        setDeployVersion(suggestNextVersion(upgraded.version));
        setDeployNote('');
        showToast(`'${upgraded.name}' v${upgraded.version} 배포 릴리즈 완료`);
      }
    } catch (e: any) {
      alert('배포 실패: ' + (e?.message || e));
    }
  };

  // 운영 배포본 즉시 롤백
  const handleActivateSnapshot = async (app: AppPlugin, dep: PluginDeployment) => {
    if (!confirm(`'${app.name}' 운영 버전을 즉시 v${dep.version} 스냅샷으로 전환(롤백)하시겠습니까?`))
      return;
    try {
      await activateDeploymentSnapshot(app, dep, globalPropsDraft);
      showToast(`운영 앱이 v${dep.version} 상태로 즉시 롤백됨`);
    } catch (e: any) {
      alert('롤백 실패: ' + (e?.message || e));
    }
  };

  // 스냅샷 코드를 스튜디오 작업본(HEAD)으로 복원
  const handleRestoreSnapshotToHead = async (app: AppPlugin, dep: PluginDeployment) => {
    if (
      !confirm(
        `v${dep.version} 스냅샷의 파일과 env.json을 '${app.name}' 스튜디오 작업본(HEAD)으로 불러오시겠습니까?\n(현재 운영 LIVE 앱은 변경되지 않습니다.)`
      )
    ) {
      return;
    }
    try {
      const restored = await restoreSnapshotToWorkspace(app, dep, studioProjects);
      setSelectedTarget(`proj:${restored.id}`);
      setActiveSection('editor');
      showToast(`v${dep.version} 코드가 작업본(HEAD)으로 로드됨`);
    } catch (e: any) {
      alert('작업본 복원 실패: ' + (e?.message || e));
    }
  };

  const handleEditSnapshotNote = async (app: AppPlugin, dep: PluginDeployment) => {
    const next = prompt('배포 메모 수정:', dep.note || '');
    if (next === null) return;
    await updateDeploymentMetadata(app, dep, next);
    showToast('배포 메모 수정됨');
  };

  const handleDeleteSnapshot = async (app: AppPlugin, dep: PluginDeployment) => {
    if (!confirm(`버전 v${dep.version} 배포 스냅샷 기록을 삭제하시겠습니까?`)) return;
    await removeDeploymentSnapshot(app, dep);
    showToast('스냅샷 기록 삭제됨');
  };

  // 데이터베이스 스튜디오 이펙트
  useEffect(() => {
    if (!isOpen || activeSection !== 'database') return;
    let isMounted = true;
    listActiveCollections().then((cols) => {
      if (isMounted) {
        setDbCollections(cols);
        if (cols.length > 0 && !cols.some((c) => c.name === selectedColName)) {
          setSelectedColName(cols[0].name);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeSection]);

  useEffect(() => {
    if (!isOpen || activeSection !== 'database' || !selectedColName) return;
    const unsubscribe = subscribeCollection(selectedColName, (rows) => {
      setColRows(rows);
    });
    return () => {
      unsubscribe();
    };
  }, [isOpen, activeSection, selectedColName]);

  const handleRunDbQuery = async (customQuery?: string) => {
    const q = (customQuery || dbQueryText).trim();
    if (!q) return;
    setDbIsLoading(true);
    setDbQueryOutput(null);
    try {
      const res = await executeDatabaseQuery(q);
      setDbQueryOutput({
        success: res.success,
        message: res.message,
        elapsed: res.executionTimeMs
      });
      if (res.data) setColRows(res.data);
      const updatedCols = await listActiveCollections();
      setDbCollections(updatedCols);
      showToast(res.message);
    } catch (err: any) {
      setDbQueryOutput({
        success: false,
        message: err?.message || String(err),
        elapsed: 0
      });
    } finally {
      setDbIsLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    const name = prompt('새 컬렉션(테이블) 이름 입력 (영문/숫자/언더바):');
    if (!name) return;
    const clean = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!clean) return;
    try {
      await registerCustomCollection(clean);
      const cols = await listActiveCollections();
      setDbCollections(cols);
      setSelectedColName(clean);
      setDbQueryText(`SELECT * FROM ${clean} LIMIT 50`);
      showToast(`컬렉션 '${clean}' 등록됨`);
    } catch (err: any) {
      alert('컬렉션 생성 실패: ' + (err?.message || err));
    }
  };

  const handleOpenAddRowModal = () => {
    setEditingRowModal({
      isOpen: true,
      isNew: true,
      docId: '',
      jsonText: JSON.stringify({ title: '새 항목', createdAt: Date.now() }, null, 2)
    });
  };

  const handleOpenEditRowModal = (row: DatabaseRowItem) => {
    const copy = { ...row };
    const docId = copy._id;
    delete copy._id;
    setEditingRowModal({
      isOpen: true,
      isNew: false,
      docId,
      jsonText: JSON.stringify(copy, null, 2)
    });
  };

  const handleSaveRowModal = async () => {
    try {
      let parsed: any;
      try {
        parsed = Function(`"use strict"; return (${editingRowModal.jsonText})`)();
      } catch (e: any) {
        alert('JSON 형식 오류: ' + e.message);
        return;
      }
      const targetId = editingRowModal.isNew
        ? editingRowModal.docId.trim() || null
        : editingRowModal.docId;
      await upsertRow(selectedColName, targetId, parsed);
      setEditingRowModal({ isOpen: false, isNew: false, docId: '', jsonText: '' });
      showToast('저장 완료');
    } catch (err: any) {
      alert('저장 실패: ' + (err?.message || err));
    }
  };

  const handleDeleteRow = async (docId: string) => {
    if (!confirm(`'${docId}' 문서를 정말 삭제하시겠습니까?`)) return;
    try {
      await deleteRow(selectedColName, docId);
      showToast('삭제 완료');
    } catch (err: any) {
      alert('삭제 실패: ' + (err?.message || err));
    }
  };

  const colKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add('_id');
    colRows.slice(0, 50).forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== '_id') keys.add(k);
      });
    });
    return Array.from(keys);
  }, [colRows]);

  if (!isOpen) return null;

  const getFileIcon = (name: string) => {
    if (name === 'env.json') return <SlidersHorizontal size={13} color="#4ade80" />;
    if (name === 'appsscript.json' || name.endsWith('.json')) return <Braces size={14} color="#c084fc" />;
    if (name.endsWith('.html')) return <Code2 size={14} color="#f97316" />;
    if (name.endsWith('.css')) return <Palette size={14} color="#38bdf8" />;
    return <FileCode size={14} color="#facc15" />;
  };

  const customScriptPropEntries = Object.entries(scriptProps).filter(([k]) => !k.startsWith('UI_'));

  const filteredPluginsForHistory =
    historyFilterAppId === 'all' ? plugins : plugins.filter((p) => p.id === historyFilterAppId);

  const toggleDeployRole = (role: UserRole) => {
    setDeployAllowedRoles((prev) => {
      const s = new Set(prev);
      if (s.has(role)) s.delete(role);
      else s.add(role);
      s.add('super_admin');
      return Array.from(s);
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div
        style={{
          width: '98vw',
          height: '96vh',
          backgroundColor: '#0f172a',
          borderRadius: '14px',
          border: '1px solid #1e293b',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e2e8f0'
        }}
      >
        {/* ==================== 1. 상단 V2 파이프라인 헤더 바 ==================== */}
        <header
          style={{
            height: '50px',
            backgroundColor: '#090d16',
            borderBottom: '1px solid #1e293b',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '12px'
          }}
        >
          {/* 좌측: 워크스페이스 선택기 + 작업본 상태 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Code2 size={19} color="#38bdf8" />

            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              title="작업할 스튜디오 작업본(HEAD) 또는 운영 배포본(LIVE) 선택"
              style={{
                backgroundColor: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155',
                borderRadius: '7px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '250px'
              }}
            >
              {studioProjects.length > 0 && (
                <optgroup label="스튜디오 작업본 (HEAD · 자유 편집)">
                  {studioProjects.map((sp) => (
                    <option key={sp.id} value={`proj:${sp.id}`}>
                      🛠️ {sp.name} (HEAD)
                    </option>
                  ))}
                </optgroup>
              )}
              {plugins.length > 0 && (
                <optgroup label="운영 배포본 스냅샷 조회 (LIVE · 읽기전용)">
                  {plugins.map((ap) => (
                    <option key={ap.id} value={`app:${ap.id}`}>
                      🔒 {ap.name} (LIVE v{ap.version})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              onClick={handleCreateNewProject}
              title="새 스마트스쿨 앱 프로젝트 생성"
              style={{
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                padding: '6px',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Plus size={14} />
            </button>

            {isReadOnly && activeReadOnlyApp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <Lock size={11} /> LIVE 운영 보호됨
                </span>
                <button
                  onClick={() => handleOpenAppWorkspace(activeReadOnlyApp)}
                  title="이 앱과 1:1 연결된 스튜디오 작업본(HEAD)으로 전환하여 편집"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Pencil size={12} />
                  <span>작업본(HEAD) 편집</span>
                </button>
              </div>
            ) : activeStudioProject ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setIsDirty(true);
                  }}
                  title="앱 이름 편집"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 6px',
                    width: '140px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#334155')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                />
                <button
                  onClick={handleSaveProject}
                  title="작업본 저장 (Ctrl+S)"
                  style={{
                    border: '1px solid #334155',
                    backgroundColor: isDirty ? '#0284c7' : '#1e293b',
                    color: '#fff',
                    padding: '6px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <Save size={14} />
                </button>
                <span
                  title={
                    linkedOperatingApp
                      ? hasUnreleasedChanges
                        ? `운영본(v${linkedOperatingApp.version}) 대비 미배포 변경사항이 있습니다.`
                        : `운영본(v${linkedOperatingApp.version})과 완전히 동기화되어 있습니다.`
                      : '아직 정식 배포되지 않은 신규 작업본입니다.'
                  }
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: hasUnreleasedChanges
                      ? 'rgba(250, 204, 21, 0.14)'
                      : 'rgba(74, 222, 128, 0.14)',
                    color: hasUnreleasedChanges ? '#facc15' : '#4ade80',
                    border: hasUnreleasedChanges
                      ? '1px solid rgba(250, 204, 21, 0.3)'
                      : '1px solid rgba(74, 222, 128, 0.3)'
                  }}
                >
                  {linkedOperatingApp
                    ? hasUnreleasedChanges
                      ? `● 미배포 수정분 (LIVE v${linkedOperatingApp.version})`
                      : `✓ LIVE v${linkedOperatingApp.version} 동기화됨`
                    : '● 미배포 신규 앱'}
                </span>
              </div>
            ) : null}

            {statusToast && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#4ade80',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2 size={13} /> {statusToast}
              </span>
            )}
          </div>

          {/* 우측: AI 규격 복사 + 인라인 프리뷰 토글 + 새 탭 테스트 + 배포 파이프라인 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <button
              onClick={handleCopyGeminiSpec}
              title="제미나이(Gemini) 표준 모듈·env.json 개발 규격 복사"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#c084fc',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Sparkles size={13} />
              <span>AI 규격</span>
            </button>

            {activeSection === 'editor' && (
              <button
                onClick={() => setShowLivePreview((v) => !v)}
                title="에디터 우측 실시간 분할 미리보기 켜기/끄기"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: showLivePreview ? '1px solid #38bdf8' : '1px solid #334155',
                  backgroundColor: showLivePreview ? 'rgba(2, 132, 199, 0.22)' : '#1e293b',
                  color: showLivePreview ? '#38bdf8' : '#cbd5e1',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Columns2 size={13} />
                <span>실시간 프리뷰</span>
              </button>
            )}

            <button
              onClick={() => handleRunInNewTab('pc')}
              title="새 탭에서 작업본(HEAD) 테스트 실행"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Play size={13} fill="#fff" />
              <span>테스트 실행</span>
            </button>

            <div
              title="기기 규격별 새 탭 테스트"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                backgroundColor: '#1e293b',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}
            >
              <button
                onClick={() => handleRunInNewTab('pc')}
                title="PC 새 탭 테스트"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#38bdf8',
                  padding: '5px 7px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <Monitor size={14} />
              </button>
              <button
                onClick={() => handleRunInNewTab('tablet')}
                title="태블릿(768×1024) 새 탭 테스트"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#38bdf8',
                  padding: '5px 7px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <Tablet size={14} />
              </button>
              <button
                onClick={() => handleRunInNewTab('mobile')}
                title="스마트폰(390×844) 새 탭 테스트"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#38bdf8',
                  padding: '5px 7px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <Smartphone size={14} />
              </button>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#334155', margin: '0 2px' }} />

            <button
              onClick={() => setActiveSection('deployments')}
              title="3단계 정식/베타 배포 파이프라인 및 버전 롤백"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 13px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: hasUnreleasedChanges ? '#16a34a' : '#2563eb',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Rocket size={14} />
              <span>배포 릴리즈</span>
            </button>

            <button
              onClick={onClose}
              title="스튜디오 닫기"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                padding: '5px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ==================== 2. 메인 워크스페이스 ==================== */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* 좌측 액티비티 레일 */}
          <nav
            style={{
              width: '46px',
              backgroundColor: '#090d16',
              borderRight: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {(
                [
                  { id: 'projects', icon: <FolderKanban size={18} />, tip: '워크스페이스 · 운영 앱 목록' },
                  { id: 'editor', icon: <Code2 size={18} />, tip: '코드 편집기 (ES 모듈 · env.json · 라이브러리)' },
                  { id: 'deployments', icon: <Rocket size={18} />, tip: '배포 릴리즈 파이프라인 · 버전 롤백' },
                  { id: 'settings', icon: <SlidersHorizontal size={18} />, tip: '환경변수(env.json) · 반응형 디바이스 정책' },
                  { id: 'database', icon: <Database size={18} />, tip: '데이터베이스 쿼리 콘솔' },
                  { id: 'executions', icon: <Terminal size={18} />, tip: '실행 로그 · 캐시 모니터' }
                ] as Array<{ id: StudioSection; icon: React.ReactNode; tip: string }>
              ).map((nav) => {
                const active = activeSection === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => {
                      setActiveSection(nav.id);
                      if (nav.id === 'executions') refreshCacheInspector();
                    }}
                    title={nav.tip}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: active ? '#1e293b' : 'transparent',
                      color: active ? '#38bdf8' : '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {nav.icon}
                  </button>
                );
              })}
            </div>

            {activeSection === 'editor' && (
              <button
                onClick={() => setSidebarCollapsed((c) => !c)}
                title={sidebarCollapsed ? '탐색기 펼치기' : '탐색기 접기'}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
            )}
          </nav>

          {/* ==================== SECTION A: V2 모듈형 코드 편집기 ==================== */}
          {activeSection === 'editor' && (
            <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
              {/* 왼쪽 탐색 사이드바 (파일 / env.json 빠른 제어 / ES 모듈 라이브러리 / 서비스) */}
              {!sidebarCollapsed && (
                <aside
                  style={{
                    width: '248px',
                    backgroundColor: '#0b0f19',
                    borderRight: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    flexShrink: 0,
                    userSelect: 'none'
                  }}
                >
                  {/* 1) 모듈 파일 트리 */}
                  <div style={{ borderBottom: '1px solid #1e293b' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8'
                      }}
                    >
                      <div
                        onClick={() => setOpenFilesTree((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {openFilesTree ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>모듈 & 설정 파일</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={handleAddFile}
                          title="새 ES 모듈(.js) / 스타일(.css) 파일 추가"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {openFilesTree && (
                      <div style={{ padding: '0 6px 8px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {displayedFiles.map((f) => {
                          const selected = f.name === activeFile?.name;
                          return (
                            <div
                              key={f.name}
                              onClick={() => setActiveFileName(f.name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                backgroundColor: selected ? '#1e293b' : 'transparent',
                                color: selected ? '#f8fafc' : '#94a3b8',
                                fontSize: '12px',
                                fontFamily: 'Consolas, monospace',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                {getFileIcon(f.name)}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {f.name}
                                </span>
                                {f.name === 'env.json' && (
                                  <span style={{ fontSize: '9px', color: '#4ade80', backgroundColor: 'rgba(74,222,128,0.12)', padding: '1px 4px', borderRadius: '4px' }}>
                                    ENV
                                  </span>
                                )}
                              </div>
                              {!isReadOnly && f.name !== 'appsscript.json' && f.name !== 'env.json' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameFile(f.name);
                                    }}
                                    title="파일 이름 변경"
                                    style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  {f.name !== 'index.html' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFile(f.name);
                                      }}
                                      title="파일 삭제"
                                      style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2) 인라인 환경변수(env.json) 즉시 제어 패널 */}
                  <div style={{ borderBottom: '1px solid #1e293b' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8'
                      }}
                    >
                      <div
                        onClick={() => setOpenEnvTree((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {openEnvTree ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>환경변수 (env.json)</span>
                      </div>
                      <button
                        onClick={() => setActiveFileName('env.json')}
                        title="env.json 원본 열기"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#4ade80',
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          cursor: 'pointer'
                        }}
                      >
                        JSON
                      </button>
                    </div>

                    {openEnvTree && (
                      <div style={{ padding: '0 8px 10px 8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {customScriptPropEntries.slice(0, 8).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                              <span>{k}</span>
                              {!isReadOnly && (
                                <button
                                  onClick={() => removeScriptProp(k)}
                                  style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <input
                              readOnly={isReadOnly}
                              value={v}
                              onChange={(e) => updateScriptProp(k, e.target.value)}
                              style={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                color: '#e2e8f0',
                                borderRadius: '5px',
                                padding: '4px 6px',
                                fontSize: '11px'
                              }}
                            />
                          </div>
                        ))}
                        {!isReadOnly && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '4px', marginTop: '4px' }}>
                            <input
                              placeholder="KEY"
                              value={newPropKey}
                              onChange={(e) => setNewPropKey(e.target.value)}
                              style={{ backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '5px', padding: '4px 6px', fontSize: '10px', fontFamily: 'monospace', minWidth: 0 }}
                            />
                            <input
                              placeholder="값"
                              value={newPropVal}
                              onChange={(e) => setNewPropVal(e.target.value)}
                              style={{ backgroundColor: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '5px', padding: '4px 6px', fontSize: '10px', minWidth: 0 }}
                            />
                            <button
                              onClick={handleAddScriptProp}
                              title="환경변수 추가"
                              style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#4ade80', borderRadius: '5px', padding: '0 6px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3) 공유 ES 모듈 라이브러리 (@gnflhs/*) */}
                  <div style={{ borderBottom: '1px solid #1e293b' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8'
                      }}
                    >
                      <div
                        onClick={() => setOpenLibsTree((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {openLibsTree ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>모듈 라이브러리 (@gnflhs)</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => setShowLibPicker((v) => !v)}
                          title="전체 내장 모듈 보기/토글"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: showLibPicker ? '#38bdf8' : '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {openLibsTree && (
                      <div style={{ padding: '0 8px 8px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {BUILTIN_LIBRARIES.map((meta) => {
                          const binding = libraries.find((l) => l.libraryId === meta.id);
                          const enabled = Boolean(binding?.enabled);
                          if (!enabled && !showLibPicker) return null;
                          return (
                            <div
                              key={meta.id}
                              title={meta.summary}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                backgroundColor: enabled ? 'rgba(30, 41, 59, 0.65)' : 'transparent',
                                border: enabled ? '1px solid #1e293b' : '1px dashed #1e293b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px'
                              }}
                            >
                              <div
                                onClick={() => !isReadOnly && toggleLibrary(meta.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: isReadOnly ? 'default' : 'pointer',
                                  minWidth: 0
                                }}
                              >
                                <Package size={12} color={enabled ? '#38bdf8' : '#475569'} />
                                <span
                                  style={{
                                    color: enabled ? '#e2e8f0' : '#64748b',
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {meta.packageName}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {enabled && (
                                  <button
                                    onClick={() => toggleLibraryVersion(meta.id)}
                                    style={{
                                      border: 'none',
                                      backgroundColor: '#0f172a',
                                      color: binding?.version === 'HEAD' ? '#4ade80' : '#94a3b8',
                                      fontSize: '9px',
                                      fontFamily: 'monospace',
                                      padding: '1px 4px',
                                      borderRadius: '4px',
                                      cursor: isReadOnly ? 'default' : 'pointer'
                                    }}
                                  >
                                    {binding?.version || 'HEAD'}
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    navigator.clipboard?.writeText(meta.snippet);
                                    showToast(`${meta.packageName} import 스니펫 복사됨`);
                                  }}
                                  title="import 구문 복사"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex'
                                  }}
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 4) 런타임 서비스 */}
                  <div>
                    <div
                      onClick={() => setOpenServicesTree((o) => !o)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {openServicesTree ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>런타임 브릿지 서비스</span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#475569' }}>{services.length}</span>
                    </div>

                    {openServicesTree && (
                      <div style={{ padding: '0 8px 10px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {BUILTIN_SERVICES.map((svc) => {
                          const active = services.includes(svc.id);
                          return (
                            <div
                              key={svc.id}
                              onClick={() => toggleService(svc.id)}
                              title={`${svc.summary} (${svc.globalSymbol})`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                cursor: isReadOnly ? 'default' : 'pointer',
                                color: active ? '#cbd5e1' : '#475569',
                                fontSize: '11px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Cpu size={12} color={active ? '#a78bfa' : '#475569'} />
                                <span>{svc.id}</span>
                              </div>
                              {active && <Check size={12} color="#4ade80" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </aside>
              )}

              {/* 중앙: 라인 번호 거터 + 코드 에디터 (+ 우측 분할 실시간 프리뷰) */}
              <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    backgroundColor: isReadOnly ? '#0b1120' : '#0f172a'
                  }}
                >
                  <div
                    style={{
                      height: '34px',
                      backgroundColor: '#0b0f19',
                      borderBottom: '1px solid #1e293b',
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontFamily: 'Consolas, monospace',
                      color: '#cbd5e1'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeFile && getFileIcon(activeFile.name)}
                      <span style={{ fontWeight: 700 }}>{activeFile?.name}</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>({lineCount}줄)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setShowBottomLogs((v) => !v)}
                        style={{
                          border: 'none',
                          background: showBottomLogs ? '#1e293b' : 'transparent',
                          color: logs.length > 0 ? '#38bdf8' : '#64748b',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        <Terminal size={12} />
                        <span>로그 {logs.length > 0 ? `(${logs.length})` : ''}</span>
                      </button>
                      <span style={{ fontSize: '10px', color: isDirty ? '#facc15' : '#64748b' }}>
                        ESM V2 · {isReadOnly ? 'READ-ONLY' : isDirty ? 'UNSAVED (Ctrl+S)' : 'SAVED'}
                      </span>
                    </div>
                  </div>

                  {/* 라인 번호 동기화 에디터 본문 */}
                  <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
                    <div
                      ref={gutterRef}
                      style={{
                        width: '48px',
                        padding: '16px 8px 16px 0',
                        backgroundColor: '#090d16',
                        borderRight: '1px solid #1e293b',
                        color: '#475569',
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: '13px',
                        lineHeight: 1.65,
                        textAlign: 'right',
                        userSelect: 'none',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      {Array.from({ length: lineCount }).map((_, idx) => (
                        <div key={idx}>{idx + 1}</div>
                      ))}
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={activeFile?.content || ''}
                      readOnly={isReadOnly}
                      onScroll={(e) => {
                        if (gutterRef.current) {
                          gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                        }
                      }}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !isReadOnly) {
                          e.preventDefault();
                          const start = e.currentTarget.selectionStart;
                          const end = e.currentTarget.selectionEnd;
                          const cur = activeFile?.content || '';
                          const updated = cur.substring(0, start) + '  ' + cur.substring(end);
                          handleCodeChange(updated);
                          const target = e.currentTarget;
                          requestAnimationFrame(() => {
                            target.selectionStart = target.selectionEnd = start + 2;
                          });
                        }
                      }}
                      spellCheck={false}
                      style={{
                        flex: 1,
                        width: '100%',
                        padding: '16px 20px',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        color: '#f1f5f9',
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: '13px',
                        lineHeight: 1.65,
                        resize: 'none',
                        boxSizing: 'border-box',
                        whiteSpace: 'pre',
                        overflow: 'auto'
                      }}
                    />
                  </div>

                  {showBottomLogs && (
                    <div
                      style={{
                        height: '150px',
                        backgroundColor: '#070b13',
                        borderTop: '1px solid #1e293b',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#090d16',
                          borderBottom: '1px solid #1e293b',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '11px',
                          color: '#94a3b8'
                        }}
                      >
                        <span>실행 콘솔 로그</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setLogs([])}
                            style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                          >
                            <Eraser size={11} />
                          </button>
                          <button
                            onClick={() => setShowBottomLogs(false)}
                            style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '8px 14px',
                          fontFamily: 'Consolas, monospace',
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        {logs.length === 0 ? (
                          <span style={{ color: '#475569' }}>출력된 실행 로그가 없습니다.</span>
                        ) : (
                          logs.map((l, i) => (
                            <div
                              key={i}
                              style={{
                                color:
                                  l.level === 'error'
                                    ? '#f87171'
                                    : l.level === 'warn'
                                    ? '#facc15'
                                    : '#cbd5e1'
                              }}
                            >
                              <span style={{ color: '#475569', marginRight: '6px' }}>
                                [{new Date(l.timestamp).toLocaleTimeString()}]
                              </span>
                              <span>{l.message}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 우측 분할 실시간 프리뷰 창 */}
                {showLivePreview && (
                  <div
                    style={{
                      width: '46%',
                      minWidth: '380px',
                      borderLeft: '1px solid #1e293b',
                      backgroundColor: '#020617',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        height: '34px',
                        backgroundColor: '#0b0f19',
                        borderBottom: '1px solid #1e293b',
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px'
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>실시간 샌드박스 프리뷰</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {(['pc', 'tablet', 'mobile'] as DeviceViewportType[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setPreviewDevice(d)}
                            style={{
                              border: 'none',
                              background: previewDevice === d ? '#2563eb' : '#1e293b',
                              color: '#fff',
                              fontSize: '10px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                          >
                            {d}
                          </button>
                        ))}
                        <button
                          onClick={() => setPreviewReloadKey((k) => k + 1)}
                          title="프리뷰 새로고침"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '3px',
                            display: 'flex'
                          }}
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'auto',
                        padding: previewDevice === 'pc' ? 0 : '12px'
                      }}
                    >
                      <iframe
                        key={`${currentScopeId}-${previewDevice}-${previewReloadKey}`}
                        title="Live Studio Preview"
                        sandbox={ENV.IFRAME_SANDBOX_FLAGS}
                        srcDoc={livePreviewSrcDoc}
                        style={{
                          width:
                            previewDevice === 'pc'
                              ? '100%'
                              : previewDevice === 'tablet'
                              ? `${ENV.VIEWPORTS.tablet.width}px`
                              : `${ENV.VIEWPORTS.mobile.width}px`,
                          height:
                            previewDevice === 'pc'
                              ? '100%'
                              : previewDevice === 'tablet'
                              ? '92%'
                              : `${ENV.VIEWPORTS.mobile.height}px`,
                          maxWidth: '100%',
                          maxHeight: '100%',
                          border: previewDevice === 'pc' ? 'none' : '1px solid #334155',
                          borderRadius: previewDevice === 'pc' ? 0 : '12px',
                          backgroundColor: '#fff'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== SECTION B: 워크스페이스 & 운영 앱 1:1 통합 관리 ==================== */}
          {activeSection === 'projects' && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 32px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                alignContent: 'start'
              }}
            >
              {/* 좌측: 스튜디오 작업본 (HEAD) */}
              <div
                style={{
                  backgroundColor: '#0b0f19',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '18px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>
                      스튜디오 작업본 (HEAD · {studioProjects.length})
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      운영 앱에 영향을 주지 않고 안전하게 개발·테스트하는 작업 공간입니다.
                    </div>
                  </div>
                  <button
                    onClick={handleCreateNewProject}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '7px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} /> 신규 앱 제작
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studioProjects.map((proj) => {
                    const linkedId = proj.publishedPluginId || proj.sourcePluginId || proj.id.replace(/^proj-/, '');
                    const linked = plugins.find((p) => p.id === linkedId);
                    return (
                      <div
                        key={proj.id}
                        style={{
                          padding: '12px',
                          borderRadius: '9px',
                          backgroundColor: selectedTarget === `proj:${proj.id}` ? '#1e293b' : '#0f172a',
                          border: '1px solid #334155',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div
                          onClick={() => {
                            setSelectedTarget(`proj:${proj.id}`);
                            setActiveSection('editor');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{proj.name}</span>
                            {linked ? (
                              <span style={{ fontSize: '10px', color: '#4ade80', backgroundColor: 'rgba(74,222,128,0.12)', padding: '1px 6px', borderRadius: '999px', fontFamily: 'monospace' }}>
                                LIVE v{linked.version} 연결됨
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#facc15', backgroundColor: 'rgba(250,204,21,0.12)', padding: '1px 6px', borderRadius: '999px' }}>
                                미배포 초안
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', fontFamily: 'monospace' }}>
                            {proj.id} · {new Date(proj.updatedAt).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            onClick={() => {
                              setSelectedTarget(`proj:${proj.id}`);
                              setActiveSection('editor');
                            }}
                            style={{ border: '1px solid #334155', background: '#0284c7', color: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                          >
                            편집
                          </button>
                          <button
                            onClick={() => handleDeleteStudioProject(proj)}
                            title="작업본 삭제"
                            style={{ border: '1px solid #334155', background: '#090d16', color: '#f87171', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 우측: 현재 배포된 운영 앱 (LIVE / BETA) */}
              <div
                style={{
                  backgroundColor: '#0b0f19',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '18px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>
                      배포된 운영 앱 (LIVE · {plugins.length})
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      '작업본 편집'을 누르면 1:1 연결된 HEAD 공간에서 중복 사본 없이 바로 수정됩니다.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {plugins.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        padding: '12px',
                        borderRadius: '9px',
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{app.name}</span>
                          <span style={{ fontSize: '10px', color: '#38bdf8', backgroundColor: '#1e293b', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                            v{app.version}
                          </span>
                          <span style={{ fontSize: '10px', color: app.status === 'production' ? '#4ade80' : '#facc15' }}>
                            {app.status === 'production' ? 'LIVE' : app.status === 'development' ? 'BETA' : 'OFF'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                          ID: {app.id} · 스냅샷 {(app.deployments || []).length}개
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenAppWorkspace(app)}
                          title="1:1 연결 작업본(HEAD)에서 안전하게 수정"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            borderRadius: '7px',
                            border: 'none',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Code2 size={13} /> 작업본 편집
                        </button>
                        <button
                          onClick={() => handleForkAsSeparateApp(app)}
                          title="별개의 새로운 독립 앱으로 분기 복제 (Fork)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 9px',
                            borderRadius: '7px',
                            border: '1px solid #334155',
                            backgroundColor: '#1e293b',
                            color: '#cbd5e1',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          <GitBranch size={12} /> 분기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECTION C: 환경변수(env.json) & 반응형 정책 ==================== */}
          {activeSection === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>디바이스별 표준 표시 정책 (env.json 자동 동기화)</span>
                  {!isReadOnly && (
                    <button
                      onClick={handleSaveProject}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '7px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Save size={13} /> 저장
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                  <div style={{ color: '#64748b', fontWeight: 700 }}>표준 영역 (data-tier)</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}><Monitor size={14} color="#38bdf8" /> PC</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}><Tablet size={14} color="#38bdf8" /> 태블릿</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}><Smartphone size={14} color="#38bdf8" /> 스마트폰</div>

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>그리드 열 수 (.gn-grid)</div>
                  <input type="number" min={1} max={6} disabled={isReadOnly} value={scriptProps.UI_PC_COLS || '3'} onChange={(e) => updateScriptProp('UI_PC_COLS', e.target.value)} style={{ width: '70px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '6px' }} />
                  <input type="number" min={1} max={4} disabled={isReadOnly} value={scriptProps.UI_TABLET_COLS || '2'} onChange={(e) => updateScriptProp('UI_TABLET_COLS', e.target.value)} style={{ width: '70px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '6px' }} />
                  <input type="number" min={1} max={2} disabled={isReadOnly} value={scriptProps.UI_MOBILE_COLS || '1'} onChange={(e) => updateScriptProp('UI_MOBILE_COLS', e.target.value)} style={{ width: '70px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '6px' }} />

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>보조 상세 정보 (detail)</div>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_TABLET_SHOW_DETAIL !== 'false'} onChange={(e) => updateScriptProp('UI_TABLET_SHOW_DETAIL', String(e.target.checked))} />
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_MOBILE_SHOW_DETAIL === 'true'} onChange={(e) => updateScriptProp('UI_MOBILE_SHOW_DETAIL', String(e.target.checked))} />

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>사이드바 패널 (sidebar)</div>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_TABLET_SHOW_SIDEBAR === 'true'} onChange={(e) => updateScriptProp('UI_TABLET_SHOW_SIDEBAR', String(e.target.checked))} />
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_MOBILE_SHOW_SIDEBAR === 'true'} onChange={(e) => updateScriptProp('UI_MOBILE_SHOW_SIDEBAR', String(e.target.checked))} />
                </div>
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>앱 전용 환경변수 (env.json ↔ GNFLHS.env)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {customScriptPropEntries.map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px', alignItems: 'center' }}>
                        <input readOnly value={k} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                        <input readOnly={isReadOnly} value={v} onChange={(e) => updateScriptProp(k, e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                        {!isReadOnly && (
                          <button onClick={() => removeScriptProp(k)} style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isReadOnly && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px' }}>
                      <input placeholder="새 키 (예: MAX_DESKS)" value={newPropKey} onChange={(e) => setNewPropKey(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                      <input placeholder="기본값" value={newPropVal} onChange={(e) => setNewPropVal(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                      <button onClick={handleAddScriptProp} style={{ backgroundColor: '#2563eb', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </section>

                <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>플랫폼 전역 공통 환경변수</span>
                    <button onClick={handleSaveGlobalProps} style={{ border: 'none', backgroundColor: '#0284c7', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      전역 저장
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {Object.entries(globalPropsDraft).map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px', alignItems: 'center' }}>
                        <input readOnly value={k} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#38bdf8', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                        <input value={v} onChange={(e) => setGlobalPropsDraft((p) => ({ ...p, [k]: e.target.value }))} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                        <button
                          onClick={() =>
                            setGlobalPropsDraft((p) => {
                              const c = { ...p };
                              delete c[k];
                              return c;
                            })
                          }
                          style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', padding: '4px', display: 'flex' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px' }}>
                    <input placeholder="전역 키 (예: SEMESTER)" value={newGlobalKey} onChange={(e) => setNewGlobalKey(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                    <input placeholder="전역 값" value={newGlobalVal} onChange={(e) => setNewGlobalVal(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                    <button onClick={handleSaveGlobalProps} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ==================== SECTION D: 직관적 3단계 배포 파이프라인 & 버전 롤백 ==================== */}
          {activeSection === 'deployments' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 상단 3단계 파이프라인 흐름 표시 바 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>1</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>작업본 개발 (HEAD Draft)</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>운영 앱과 분리되어 자유롭게 코드·env.json 수정</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>2</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>베타(BETA) / 정식(LIVE) 릴리즈</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>검증 완료 시 불변 스냅샷 생성 및 포털 즉시 반영</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>3</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>1초 스냅샷 롤백 보장</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>언제든 이전 정식 버전으로 무중단 즉시 복원</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', alignContent: 'start' }}>
                {/* 좌측: 릴리즈 실행 패널 */}
                <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Rocket size={16} color="#38bdf8" /> 작업본(HEAD) 새 버전 릴리즈
                  </div>

                  {isReadOnly && activeReadOnlyApp ? (
                    <div style={{ padding: '16px', backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px' }}>
                        현재 읽기 전용 운영본 조회 중입니다. 연결된 작업본(HEAD)으로 전환하여 배포하세요.
                      </div>
                      <button
                        onClick={() => handleOpenAppWorkspace(activeReadOnlyApp)}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        작업본(HEAD) 열기
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', backgroundColor: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <button
                          onClick={() => setDeployMode('upgrade')}
                          style={{
                            padding: '7px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: deployMode === 'upgrade' ? '#2563eb' : 'transparent',
                            color: deployMode === 'upgrade' ? '#fff' : '#94a3b8',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          기존 운영 앱 업데이트
                        </button>
                        <button
                          onClick={() => setDeployMode('new')}
                          style={{
                            padding: '7px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: deployMode === 'new' ? '#2563eb' : 'transparent',
                            color: deployMode === 'new' ? '#fff' : '#94a3b8',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          신규 앱으로 첫 배포
                        </button>
                      </div>

                      {deployMode === 'upgrade' ? (
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>업데이트할 대상 운영 앱</div>
                          <select
                            value={deployTargetAppId}
                            onChange={(e) => {
                              const nextId = e.target.value;
                              setDeployTargetAppId(nextId);
                              const found = plugins.find((x) => x.id === nextId);
                              if (found) setDeployVersion(suggestNextVersion(found.version));
                            }}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
                          >
                            {plugins.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (현재 v{p.version})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>표시될 정식 앱 이름</div>
                            <input
                              value={deployNewAppName}
                              onChange={(e) => setDeployNewAppName(e.target.value)}
                              placeholder="예: 야간자습 좌석 신청"
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>고유 앱 ID (영문 슬러그)</div>
                              <input
                                value={deployNewAppId}
                                onChange={(e) => setDeployNewAppId(e.target.value)}
                                placeholder="study-seat"
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>아이콘 · 분류</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <select value={deployNewIcon} onChange={(e) => setDeployNewIcon(e.target.value)} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}>
                                  <option value="LayoutGrid">Grid</option>
                                  <option value="PenTool">PenTool</option>
                                  <option value="ShieldAlert">Shield</option>
                                  <option value="Puzzle">Puzzle</option>
                                </select>
                                <select value={deployNewCategory} onChange={(e) => setDeployNewCategory(e.target.value as 'classroom' | 'management' | 'utility')} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}>
                                  <option value="classroom">수업</option>
                                  <option value="management">생활</option>
                                  <option value="utility">도구</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* 배포 채널 선택 (LIVE vs BETA) */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>릴리즈 채널 선택</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setDeployChannel('production')}
                            style={{
                              padding: '8px',
                              borderRadius: '8px',
                              border: deployChannel === 'production' ? '1px solid #22c55e' : '1px solid #334155',
                              backgroundColor: deployChannel === 'production' ? 'rgba(34, 197, 94, 0.14)' : '#0f172a',
                              color: deployChannel === 'production' ? '#4ade80' : '#94a3b8',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            🟢 정식 배포 (LIVE)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeployChannel('development')}
                            style={{
                              padding: '8px',
                              borderRadius: '8px',
                              border: deployChannel === 'development' ? '1px solid #eab308' : '1px solid #334155',
                              backgroundColor: deployChannel === 'development' ? 'rgba(234, 179, 8, 0.14)' : '#0f172a',
                              color: deployChannel === 'development' ? '#facc15' : '#94a3b8',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            🟡 베타 검증 (BETA)
                          </button>
                        </div>
                      </div>

                      {/* 실행 대상 역할 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '12px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>접근 허용 대상:</span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={deployAllowedRoles.includes('teacher')} onChange={() => toggleDeployRole('teacher')} />
                            교사
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={deployAllowedRoles.includes('student')} onChange={() => toggleDeployRole('student')} />
                            학생
                          </label>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>버전 태그</div>
                          <input
                            value={deployVersion}
                            onChange={(e) => setDeployVersion(e.target.value)}
                            placeholder="1.1.0"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>릴리즈 요약 메모</div>
                          <input
                            value={deployNote}
                            onChange={(e) => setDeployNote(e.target.value)}
                            placeholder="주요 변경사항 기록"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleExecuteDeploy}
                        style={{
                          marginTop: '4px',
                          padding: '11px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Rocket size={15} />
                        <span>
                          {deployMode === 'upgrade'
                            ? `v${deployVersion} 스냅샷 생성 및 ${deployChannel === 'production' ? 'LIVE' : 'BETA'} 배포`
                            : `신규 앱 v${deployVersion} 정식 배포`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 우측: 버전 스냅샷 히스토리 & 원클릭 롤백 */}
                <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>배포 버전 히스토리 & 즉시 롤백</span>
                    <select
                      value={historyFilterAppId}
                      onChange={(e) => setHistoryFilterAppId(e.target.value)}
                      style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '5px 10px', borderRadius: '7px', fontSize: '12px' }}
                    >
                      <option value="all">전체 배포 앱 ({plugins.length})</option>
                      {plugins.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredPluginsForHistory.map((app) => {
                      const depList = app.deployments || [];
                      return (
                        <div key={app.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>{app.name}</strong>
                              <span style={{ fontSize: '11px', color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.12)', padding: '2px 7px', borderRadius: '999px', fontFamily: 'monospace' }}>
                                {app.status === 'production' ? 'LIVE' : 'BETA'} v{app.version}
                              </span>
                            </div>
                            <button
                              onClick={() => handleOpenAppWorkspace(app)}
                              style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Code2 size={12} /> 작업본 열기
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {depList.map((dep, idx) => {
                              const isActive =
                                (app.activeDeploymentId && dep.deploymentId === app.activeDeploymentId) ||
                                (!app.activeDeploymentId && dep.version === app.version && idx === 0);
                              return (
                                <div
                                  key={(dep.deploymentId || dep.version) + idx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    borderRadius: '7px',
                                    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.15)' : '#090d16',
                                    border: isActive ? '1px solid #2563eb' : '1px solid #1e293b'
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                                        v{dep.version}
                                      </span>
                                      {isActive && (
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#4ade80' }}>ACTIVE</span>
                                      )}
                                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{dep.note || ''}</span>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                      {new Date(dep.deployedAt).toLocaleString()} · 파일 {(dep.files || []).length}개
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {!isActive && (
                                      <button
                                        onClick={() => handleActivateSnapshot(app, dep)}
                                        title="운영 버전을 이 스냅샷으로 즉시 전환/롤백"
                                        style={{ border: 'none', backgroundColor: '#0284c7', color: '#fff', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
                                      >
                                        <RotateCcw size={12} /> 롤백
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleRestoreSnapshotToHead(app, dep)}
                                      title="이 스냅샷 소스를 작업본(HEAD) 에디터로 불러오기"
                                      style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#cbd5e1', padding: '5px 7px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px' }}
                                    >
                                      HEAD 로드
                                    </button>
                                    <button
                                      onClick={() => handleEditSnapshotNote(app, dep)}
                                      title="배포 메모 수정"
                                      style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    {!isActive && (
                                      <button
                                        onClick={() => handleDeleteSnapshot(app, dep)}
                                        title="스냅샷 기록 삭제"
                                        style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f87171', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECTION E: 실행 로그 & CacheService 모니터 ==================== */}
          {activeSection === 'executions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }}>
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>실행 로그 (Logger & Console)</span>
                  <button onClick={() => setLogs([])} style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: '300px', backgroundColor: '#020617', borderRadius: '8px', padding: '12px', fontFamily: 'Consolas, monospace', fontSize: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {logs.length === 0 ? (
                    <span style={{ color: '#475569' }}>출력된 실행 로그가 없습니다.</span>
                  ) : (
                    logs.map((item, idx) => (
                      <div key={item.timestamp + '-' + idx} style={{ color: item.level === 'error' ? '#f87171' : item.level === 'warn' ? '#facc15' : '#cbd5e1' }}>
                        <span style={{ color: '#475569', marginRight: '8px' }}>[{new Date(item.timestamp).toLocaleTimeString()}]</span>
                        <span>{item.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>캐시 모니터 (CacheService)</span>
                  <button
                    onClick={() => {
                      clearProjectCache(currentScopeId);
                      refreshCacheInspector();
                      showToast('캐시 비움 완료');
                    }}
                    style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f87171', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Eraser size={13} /> 비우기
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cacheEntries.length === 0 ? (
                    <span style={{ fontSize: '12px', color: '#475569' }}>저장된 활성 캐시 항목이 없습니다.</span>
                  ) : (
                    cacheEntries.map((ce) => (
                      <div key={ce.key} style={{ padding: '8px 10px', borderRadius: '7px', backgroundColor: '#0f172a', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'monospace' }}>
                        <div>
                          <div style={{ color: '#38bdf8', fontWeight: 700 }}>{ce.key}</div>
                          <div style={{ color: '#cbd5e1', fontSize: '11px' }}>{ce.value}</div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>TTL {ce.expiresInSec}s</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECTION F: 데이터베이스 쿼리 콘솔 ==================== */}
          {activeSection === 'database' && (
            <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ width: '220px', backgroundColor: '#090d16', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Database size={14} color="#38bdf8" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>컬렉션 목록</span>
                    </div>
                    <button onClick={handleCreateCollection} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex' }}>
                      <Plus size={13} />
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="컬렉션 검색..."
                      value={colSearchQuery}
                      onChange={(e) => setColSearchQuery(e.target.value)}
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', padding: '5px 8px 5px 26px', fontSize: '11px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {dbCollections
                    .filter((c) => !colSearchQuery || c.name.toLowerCase().includes(colSearchQuery.toLowerCase()))
                    .map((c) => {
                      const isSelected = selectedColName === c.name;
                      return (
                        <button
                          key={c.name}
                          onClick={() => {
                            setSelectedColName(c.name);
                            setDbQueryText(`SELECT * FROM ${c.name} LIMIT 50`);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: isSelected ? '#1e293b' : 'transparent',
                            color: isSelected ? '#38bdf8' : '#94a3b8',
                            fontSize: '12px',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            marginBottom: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Table size={13} color={isSelected ? '#38bdf8' : '#64748b'} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#0b101d' }}>
                <div style={{ padding: '12px 16px', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => {
                          const q = `SELECT * FROM ${selectedColName} LIMIT 50`;
                          setDbQueryText(q);
                          handleRunDbQuery(q);
                        }}
                        style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '5px', color: '#38bdf8', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
                      >
                        SELECT *
                      </button>
                      <button
                        onClick={() => setDbQueryText(`INSERT INTO ${selectedColName} {\n  "title": "새 항목",\n  "createdAt": ${Date.now()}\n}`)}
                        style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '5px', color: '#34d399', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
                      >
                        INSERT INTO
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {dbQueryOutput && (
                        <span style={{ fontSize: '11px', color: dbQueryOutput.success ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {dbQueryOutput.message}
                        </span>
                      )}
                      <button
                        onClick={() => handleRunDbQuery()}
                        disabled={dbIsLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Play size={13} fill="#fff" />
                        <span>{dbIsLoading ? '실행중...' : '실행'}</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={dbQueryText}
                    onChange={(e) => setDbQueryText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleRunDbQuery();
                      }
                    }}
                    rows={2}
                    style={{ width: '100%', backgroundColor: '#050811', border: '1px solid #1e293b', borderRadius: '6px', color: '#38bdf8', fontFamily: 'Consolas, monospace', fontSize: '12px', padding: '8px 10px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ padding: '8px 16px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                    {selectedColName} ({colRows.length}행)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setDbViewMode(dbViewMode === 'table' ? 'json' : 'table')} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}>
                      {dbViewMode === 'table' ? 'JSON 보기' : '표 보기'}
                    </button>
                    <button onClick={handleOpenAddRowModal} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#34d399', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      + 새 행 추가
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  {dbViewMode === 'json' ? (
                    <pre style={{ margin: 0, padding: '16px', color: '#a5b4fc', fontFamily: 'Consolas, monospace', fontSize: '12px', backgroundColor: '#050811', minHeight: '100%' }}>
                      {JSON.stringify(colRows, null, 2)}
                    </pre>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '8px 12px', color: '#64748b', width: '80px' }}>동작</th>
                          {colKeys.map((k) => (
                            <th key={k} style={{ padding: '8px 12px', color: '#94a3b8', borderLeft: '1px solid #1e293b' }}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {colRows.map((row, rIdx) => (
                          <tr key={row._id || rIdx} style={{ borderBottom: '1px solid #1e293b', backgroundColor: rIdx % 2 === 0 ? '#0b101d' : '#0e1424' }}>
                            <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                              <button onClick={() => handleOpenEditRowModal(row)} style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '3px' }}>
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDeleteRow(row._id)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '3px' }}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                            {colKeys.map((k) => (
                              <td key={k} style={{ padding: '6px 12px', borderLeft: '1px solid #1e293b', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {typeof row[k] === 'object' ? JSON.stringify(row[k]).slice(0, 50) : String(row[k] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DB 행 추가/수정 모달 */}
        {editingRowModal.isOpen && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ width: '520px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{editingRowModal.isNew ? '새 문서 추가' : `문서 편집 (${editingRowModal.docId})`}</span>
                <button onClick={() => setEditingRowModal({ isOpen: false, isNew: false, docId: '', jsonText: '' })} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              {editingRowModal.isNew && (
                <input
                  type="text"
                  placeholder="문서 ID (비워두면 자동 생성)"
                  value={editingRowModal.docId}
                  onChange={(e) => setEditingRowModal((p) => ({ ...p, docId: e.target.value }))}
                  style={{ width: '100%', backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '6px', padding: '6px 10px', color: '#f1f5f9', fontSize: '12px', boxSizing: 'border-box' }}
                />
              )}
              <textarea
                rows={10}
                value={editingRowModal.jsonText}
                onChange={(e) => setEditingRowModal((p) => ({ ...p, jsonText: e.target.value }))}
                style={{ width: '100%', backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '6px', padding: '8px 10px', color: '#38bdf8', fontFamily: 'Consolas, monospace', fontSize: '12px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setEditingRowModal({ isOpen: false, isNew: false, docId: '', jsonText: '' })} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={handleSaveRowModal} style={{ backgroundColor: '#0284c7', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
