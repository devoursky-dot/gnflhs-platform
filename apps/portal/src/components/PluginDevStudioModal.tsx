import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { isSuperAdmin } from '@gnflhs/shared-auth';
import {
  AppPlugin,
  DeviceViewportType,
  PluginDeployment,
  StudioLibraryBinding,
  StudioProject,
  StudioRuntimeConfig,
  VirtualFile
} from '@gnflhs/shared-types';
import {
  activateDeploymentSnapshot,
  publishStudioProjectAsNewApp,
  removeDeploymentSnapshot,
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
  saveGlobalProperties,
  saveStudioProject
} from '../services/studioService';
import {
  BUILTIN_LIBRARIES,
  BUILTIN_SERVICES,
  buildManifestContent,
  compileStudioBundle,
  DEFAULT_LIBRARIES,
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SCRIPT_PROPERTIES,
  DEFAULT_SERVICES,
  getStarterFilesForPlugin
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
  ExternalLink,
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
  Check
} from 'lucide-react';

interface PluginDevStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: AppPlugin[];
  studioProjects: StudioProject[];
  globalProperties: Record<string, string>;
  currentUser: User | null;
  initialProjectId?: string | null;
}

type StudioSection = 'projects' | 'editor' | 'settings' | 'deployments' | 'executions';

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

  // 현재 선택된 대상: 'proj:<id>' (미배포 스튜디오 프로젝트) 또는 'app:<id>' (구동중 운영 앱 읽기전용 조회)
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  // 로컬 작업 상태 (스튜디오 프로젝트 편집용)
  const [projectName, setProjectName] = useState<string>('');
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [activeFileName, setActiveFileName] = useState<string>('index.html');
  const [scriptProps, setScriptProps] = useState<Record<string, string>>({ ...DEFAULT_SCRIPT_PROPERTIES });
  const [libraries, setLibraries] = useState<StudioLibraryBinding[]>([...DEFAULT_LIBRARIES]);
  const [services, setServices] = useState<string[]>([...DEFAULT_SERVICES]);
  const [runtimeConfig, setRuntimeConfig] = useState<StudioRuntimeConfig>({ ...DEFAULT_RUNTIME_CONFIG });
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // 전역 공유 속성 편집 상태
  const [globalPropsDraft, setGlobalPropsDraft] = useState<Record<string, string>>({});
  const [newPropKey, setNewPropKey] = useState<string>('');
  const [newPropVal, setNewPropVal] = useState<string>('');
  const [newGlobalKey, setNewGlobalKey] = useState<string>('');
  const [newGlobalVal, setNewGlobalVal] = useState<string>('');

  // 사이드바 섹션 아코디언
  const [openFilesTree, setOpenFilesTree] = useState<boolean>(true);
  const [openLibsTree, setOpenLibsTree] = useState<boolean>(true);
  const [openServicesTree, setOpenServicesTree] = useState<boolean>(false);
  const [showLibPicker, setShowLibPicker] = useState<boolean>(false);

  // 뷰포트 & 실행 로그 & 캐시
  const [previewDevice, setPreviewDevice] = useState<DeviceViewportType>('pc');
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [logs, setLogs] = useState<ExecutionLogItem[]>([]);
  const [cacheEntries, setCacheEntries] = useState<CacheEntryInfo[]>([]);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // 배포 관리 폼 상태
  const [deployMode, setDeployMode] = useState<'upgrade' | 'new'>('upgrade');
  const [deployTargetAppId, setDeployTargetAppId] = useState<string>('whiteboard');
  const [deployNewAppName, setDeployNewAppName] = useState<string>('');
  const [deployNewAppId, setDeployNewAppId] = useState<string>('');
  const [deployNewIcon, setDeployNewIcon] = useState<string>('Puzzle');
  const [deployNewCategory, setDeployNewCategory] = useState<'classroom' | 'management' | 'utility'>('utility');
  const [deployVersion, setDeployVersion] = useState<string>('1.1.0');
  const [deployNote, setDeployNote] = useState<string>('');
  const [historyFilterAppId, setHistoryFilterAppId] = useState<string>('all');

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 2600);
  };

  useEffect(() => {
    setGlobalPropsDraft({ ...globalProperties });
  }, [globalProperties]);

  // RPC 브릿지 & 샌드박스 로그 수신기 연결
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

  const currentScopeId = activeStudioProject?.id || activeReadOnlyApp?.id || 'studio-temp';
  const isReadOnly = !isStudioProjectSelected;

  const refreshCacheInspector = () => {
    setCacheEntries(listProjectCacheEntries(currentScopeId));
  };

  // 타겟 변경 시 에디터 상태 로드
  useEffect(() => {
    if (activeStudioProject) {
      setProjectName(activeStudioProject.name);
      setFiles(activeStudioProject.files.map((f) => ({ ...f })));
      setActiveFileName(activeStudioProject.files[0]?.name || 'index.html');
      setScriptProps({ ...DEFAULT_SCRIPT_PROPERTIES, ...(activeStudioProject.scriptProperties || {}) });
      setLibraries(
        activeStudioProject.libraries?.length
          ? activeStudioProject.libraries.map((l) => ({ ...l }))
          : DEFAULT_LIBRARIES.map((l) => ({ ...l }))
      );
      setServices(activeStudioProject.services?.length ? [...activeStudioProject.services] : [...DEFAULT_SERVICES]);
      setRuntimeConfig({ ...DEFAULT_RUNTIME_CONFIG, ...(activeStudioProject.runtimeConfig || {}) });
      setIsDirty(false);

      if (activeStudioProject.sourcePluginId) {
        setDeployMode('upgrade');
        setDeployTargetAppId(activeStudioProject.sourcePluginId);
        const srcApp = plugins.find((p) => p.id === activeStudioProject.sourcePluginId);
        const nextVer = srcApp ? `1.${(srcApp.deployments?.length || 0) + 1}.0` : '1.1.0';
        setDeployVersion(nextVer);
      } else if (activeStudioProject.publishedPluginId) {
        setDeployMode('upgrade');
        setDeployTargetAppId(activeStudioProject.publishedPluginId);
      } else {
        setDeployNewAppName(activeStudioProject.name);
        setDeployNewAppId(
          activeStudioProject.id.replace(/^proj-/, 'app-').toLowerCase().replace(/[^a-z0-9-_]/g, '-')
        );
      }
      setCacheEntries(listProjectCacheEntries(activeStudioProject.id));
    } else if (activeReadOnlyApp) {
      setProjectName(activeReadOnlyApp.name);
      const roFiles =
        activeReadOnlyApp.files && activeReadOnlyApp.files.length > 0
          ? activeReadOnlyApp.files
          : getStarterFilesForPlugin(activeReadOnlyApp.id, activeReadOnlyApp.name);
      setFiles(roFiles);
      setActiveFileName(roFiles[0]?.name || 'index.html');
      setScriptProps({ ...DEFAULT_SCRIPT_PROPERTIES, ...(activeReadOnlyApp.scriptProperties || {}) });
      setLibraries(
        activeReadOnlyApp.libraries?.length ? activeReadOnlyApp.libraries : DEFAULT_LIBRARIES
      );
      setServices([...DEFAULT_SERVICES]);
      setRuntimeConfig({ ...DEFAULT_RUNTIME_CONFIG, ...(activeReadOnlyApp.runtimeConfig || {}) });
      setIsDirty(false);
      setCacheEntries(listProjectCacheEntries(activeReadOnlyApp.id));
    }
  }, [activeStudioProject?.id, activeReadOnlyApp?.id]);

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

  // 현재 표시할 파일 목록 (매니페스트 포함 여부 반영)
  const displayedFiles: VirtualFile[] = runtimeConfig.showManifest
    ? [
        ...files.filter((f) => f.name !== 'appsscript.json'),
        {
          name: 'appsscript.json',
          content:
            files.find((f) => f.name === 'appsscript.json')?.content ||
            buildManifestContent(runtimeConfig, libraries, services)
        }
      ]
    : files.filter((f) => f.name !== 'appsscript.json');

  const activeFile = displayedFiles.find((f) => f.name === activeFileName) || displayedFiles[0];

  const buildCurrentStudioSnapshot = (): StudioProject | null => {
    if (!activeStudioProject) return null;
    return {
      ...activeStudioProject,
      name: projectName.trim() || activeStudioProject.name,
      files,
      scriptProperties: scriptProps,
      libraries,
      services,
      runtimeConfig,
      updatedAt: Date.now()
    };
  };

  // 프로젝트 저장
  const handleSaveProject = async (): Promise<StudioProject | null> => {
    const snap = buildCurrentStudioSnapshot();
    if (!snap) return null;
    try {
      const saved = await saveStudioProject(snap);
      setIsDirty(false);
      setPreviewKey((k) => k + 1);
      showToast('저장됨');
      return saved;
    } catch (e: any) {
      alert('저장 실패: ' + (e?.message || e));
      return null;
    }
  };

  // 새 빈 프로젝트 생성
  const handleCreateNewProject = async () => {
    const inputName = prompt('새 프로젝트 이름:', `새 프로젝트 ${studioProjects.length + 1}`);
    if (!inputName) return;
    try {
      const created = await createBlankStudioProject(inputName);
      setSelectedTarget(`proj:${created.id}`);
      setActiveSection('editor');
      showToast('새 프로젝트 생성됨');
    } catch (e: any) {
      alert('생성 실패: ' + (e?.message || e));
    }
  };

  // 현재 구동중인 앱을 안전한 스튜디오 프로젝트 사본으로 복제
  const handleCopyAppToStudio = async (app: AppPlugin) => {
    try {
      const cloned = await cloneAppToStudioProject(app, `${app.name} (사본)`);
      setSelectedTarget(`proj:${cloned.id}`);
      setActiveSection('editor');
      showToast('스튜디오 사본 생성됨');
    } catch (e: any) {
      alert('복사 실패: ' + (e?.message || e));
    }
  };

  // 미배포 프로젝트 삭제
  const handleDeleteStudioProject = async (proj: StudioProject) => {
    if (!confirm(`'${proj.name}' 미배포 프로젝트를 삭제하시겠습니까?`)) return;
    try {
      await deleteStudioProject(proj.id);
      const remaining = studioProjects.filter((p) => p.id !== proj.id);
      if (remaining.length > 0) {
        setSelectedTarget(`proj:${remaining[0].id}`);
      } else if (plugins.length > 0) {
        setSelectedTarget(`app:${plugins[0].id}`);
      }
      showToast('프로젝트 삭제됨');
    } catch (e: any) {
      alert('삭제 실패: ' + (e?.message || e));
    }
  };

  // 새 탭에서 PC / 태블릿 / 스마트폰 실행 (미배포 프로젝트 자동 저장 후 즉시 오픈)
  const handleRunInNewTab = async (targetDevice: DeviceViewportType) => {
    try {
      if (activeStudioProject) {
        const saved = await handleSaveProject();
        const pid = saved?.id || activeStudioProject.id;
        window.open(`/?testRunner=${encodeURIComponent(pid)}&device=${targetDevice}`, '_blank');
      } else if (activeReadOnlyApp) {
        // 읽기 전용 앱인 경우 임시 사본을 만들지 않고도 즉시 새 탭 프리뷰할 수 있도록 임시 드래프트 캐시 기록 후 실행
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

  // 파일 추가 / 이름 변경 / 삭제
  const handleAddFile = () => {
    if (isReadOnly) return;
    const rawName = prompt('파일 이름 입력 (.html / .js / .css):', 'module.js');
    if (!rawName) return;
    const clean = rawName.trim();
    if (files.some((f) => f.name === clean)) {
      alert('동일한 파일 이름이 이미 존재합니다.');
      return;
    }
    const initialContent = clean.endsWith('.css')
      ? '/* 추가 스타일 */\n'
      : clean.endsWith('.html')
      ? '<!-- 추가 마크업 -->\n'
      : '// 추가 모듈 스크립트\n';
    setFiles((prev) => [...prev, { name: clean, content: initialContent }]);
    setActiveFileName(clean);
    setIsDirty(true);
  };

  const handleRenameFile = (oldName: string) => {
    if (isReadOnly || oldName === 'appsscript.json') return;
    const nextName = prompt('새 파일 이름:', oldName);
    if (!nextName || nextName.trim() === oldName) return;
    const clean = nextName.trim();
    setFiles((prev) => prev.map((f) => (f.name === oldName ? { ...f, name: clean } : f)));
    if (activeFileName === oldName) setActiveFileName(clean);
    setIsDirty(true);
  };

  const handleDeleteFile = (name: string) => {
    if (isReadOnly || name === 'index.html' || name === 'appsscript.json') return;
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
    } else {
      setFiles((prev) => prev.map((f) => (f.name === activeFileName ? { ...f, content: val } : f)));
    }
    setIsDirty(true);
  };

  // 스크립트 속성 제어
  const updateScriptProp = (key: string, value: string) => {
    if (isReadOnly) return;
    setScriptProps((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const removeScriptProp = (key: string) => {
    if (isReadOnly) return;
    setScriptProps((prev) => {
      const copy = { ...prev };
      delete copy[key];
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
    showToast('공유 속성 저장됨');
  };

  // 라이브러리 토글 & 버전 전환
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
        l.libraryId === libId ? { ...l, version: l.version === 'HEAD' ? '1.0.0' : 'HEAD' } : l
      )
    );
    setIsDirty(true);
  };

  // 서비스 토글
  const toggleService = (serviceId: string) => {
    if (isReadOnly) return;
    setServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
    setIsDirty(true);
  };

  // 배포 실행 (신규 정식 앱 배포 OR 기존 앱 업그레이드 교체)
  const handleExecuteDeploy = async () => {
    const saved = await handleSaveProject();
    if (!saved) return;

    try {
      if (deployMode === 'new') {
        const cleanName = deployNewAppName.trim() || saved.name;
        const cleanId =
          deployNewAppId.trim() ||
          `app-${Date.now().toString(36)}`;
        if (plugins.some((p) => p.id === cleanId)) {
          alert(`이미 '${cleanId}' ID를 가진 운영 앱이 있습니다. 다른 ID를 입력하거나 '기존 앱 업그레이드 교체'를 선택하세요.`);
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
            note: deployNote.trim() || '신규 정식 앱 배포'
          },
          globalPropsDraft
        );
        await saveStudioProject({ ...saved, publishedPluginId: published.id });
        setDeployNote('');
        showToast(`'${published.name}' 정식 앱 배포 완료`);
      } else {
        const targetApp = plugins.find((p) => p.id === deployTargetAppId);
        if (!targetApp) {
          alert('업그레이드할 대상 운영 앱을 선택해주세요.');
          return;
        }
        if (!confirm(`'${targetApp.name}' 운영 앱을 새 배포본(v${deployVersion})으로 교체하시겠습니까?\n이전 상태는 배포 히스토리에 자동 백업되어 언제든 복원 가능합니다.`)) {
          return;
        }
        await upgradeAppWithStudioProject(
          saved,
          targetApp,
          deployVersion.trim() || '1.1.0',
          deployNote.trim() || `${saved.name} 업그레이드 배포`,
          globalPropsDraft
        );
        setDeployNote('');
        showToast(`'${targetApp.name}' 업그레이드 완료`);
      }
    } catch (e: any) {
      alert('배포 실패: ' + (e?.message || e));
    }
  };

  // 배포본 롤백/복원
  const handleActivateSnapshot = async (app: AppPlugin, dep: PluginDeployment) => {
    if (!confirm(`'${app.name}' 앱을 버전 v${dep.version} 배포본 상태로 전환하시겠습니까?`)) return;
    try {
      await activateDeploymentSnapshot(app, dep, globalPropsDraft);
      showToast(`v${dep.version} 상태로 복원됨`);
    } catch (e: any) {
      alert('복원 실패: ' + (e?.message || e));
    }
  };

  // 배포 스냅샷을 새 스튜디오 프로젝트로 복제
  const handleForkDeploymentToStudio = async (app: AppPlugin, dep: PluginDeployment) => {
    const tempPlugin: AppPlugin = {
      ...app,
      version: dep.version,
      files: dep.files,
      scriptProperties: dep.scriptProperties,
      libraries: dep.libraries,
      runtimeConfig: dep.runtimeConfig,
      codeType: dep.codeType || 'inline_html'
    };
    await handleCopyAppToStudio(tempPlugin);
  };

  const handleEditSnapshotNote = async (app: AppPlugin, dep: PluginDeployment) => {
    const next = prompt('배포 메모 수정:', dep.note || '');
    if (next === null) return;
    await updateDeploymentMetadata(app, dep, next);
    showToast('배포 메모 수정됨');
  };

  const handleDeleteSnapshot = async (app: AppPlugin, dep: PluginDeployment) => {
    if (!confirm(`버전 v${dep.version} 배포 스냅샷을 삭제하시겠습니까?`)) return;
    await removeDeploymentSnapshot(app, dep);
    showToast('배포본 삭제됨');
  };

  const compiledPreviewHtml = useMemo(() => {
    if (!isOpen) return '';
    return compileStudioBundle({
      projectId: currentScopeId,
      projectName: projectName || 'Preview',
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
    isOpen,
    currentScopeId,
    projectName,
    files,
    scriptProps,
    globalPropsDraft,
    libraries,
    runtimeConfig,
    previewDevice,
    currentUser,
    previewKey
  ]);

  if (!isOpen) return null;

  const getFileIcon = (name: string) => {
    if (name === 'appsscript.json' || name.endsWith('.json')) return <Braces size={14} color="#c084fc" />;
    if (name.endsWith('.html')) return <Code2 size={14} color="#f97316" />;
    if (name.endsWith('.css')) return <Palette size={14} color="#38bdf8" />;
    return <FileCode size={14} color="#facc15" />;
  };

  const customScriptPropEntries = Object.entries(scriptProps).filter(
    ([k]) => !k.startsWith('UI_')
  );

  const filteredPluginsForHistory =
    historyFilterAppId === 'all'
      ? plugins
      : plugins.filter((p) => p.id === historyFilterAppId);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(2, 6, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
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
      }}>
        {/* ==================== 1. 상단 Apps Script 헤더 바 ==================== */}
        <header style={{
          height: '48px',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: '12px'
        }}>
          {/* 좌측: 프로젝트 선택기 + 이름 편집 / 운영 보호 잠금 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Code2 size={19} color="#38bdf8" />

            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              title="작업할 스튜디오 프로젝트 또는 조회할 운영 앱 선택"
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
                <optgroup label="스튜디오 프로젝트 (미배포)">
                  {studioProjects.map((sp) => (
                    <option key={sp.id} value={`proj:${sp.id}`}>
                      📝 {sp.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="구동중인 운영 앱 (읽기 전용)">
                {plugins.map((ap) => (
                  <option key={ap.id} value={`app:${ap.id}`}>
                    🔒 {ap.name} (v{ap.version})
                  </option>
                ))}
              </optgroup>
            </select>

            <button
              onClick={handleCreateNewProject}
              title="새 스튜디오 프로젝트 만들기"
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
                  title="현재 구동중인 운영 앱은 직접 수정할 수 없습니다. 복사 버튼을 눌러 안전하게 편집하세요."
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
                  <Lock size={11} /> 보호됨
                </span>
                <button
                  onClick={() => handleCopyAppToStudio(activeReadOnlyApp)}
                  title="현재 구동중인 앱을 스튜디오 프로젝트로 복사하여 편집"
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
                  <Copy size={13} />
                  <span>사본 편집</span>
                </button>
              </div>
            ) : activeStudioProject ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setIsDirty(true);
                  }}
                  title="프로젝트 이름 편집"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 6px',
                    width: '150px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#334155')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                />
                <button
                  onClick={handleSaveProject}
                  title="프로젝트 저장 (Ctrl+S)"
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
                <button
                  onClick={() => handleDeleteStudioProject(activeStudioProject)}
                  title="미배포 프로젝트 삭제"
                  style={{
                    border: '1px solid #334155',
                    backgroundColor: '#1e293b',
                    color: '#f87171',
                    padding: '6px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null}

            {statusToast && (
              <span style={{
                fontSize: '11px',
                color: '#4ade80',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle2 size={13} /> {statusToast}
              </span>
            )}
          </div>

          {/* 중앙: 인라인 샌드박스 뷰포트 전환 (PC · 태블릿 · 스마트폰) + 새로고침 + 캐시 초기화 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: '#1e293b',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <button
              onClick={() => setPreviewDevice('pc')}
              title="인라인 미리보기: PC (전체 표시)"
              style={{
                border: 'none',
                background: previewDevice === 'pc' ? '#334155' : 'transparent',
                color: previewDevice === 'pc' ? '#38bdf8' : '#94a3b8',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Monitor size={15} />
            </button>
            <button
              onClick={() => setPreviewDevice('tablet')}
              title="인라인 미리보기: 태블릿 (768px)"
              style={{
                border: 'none',
                background: previewDevice === 'tablet' ? '#334155' : 'transparent',
                color: previewDevice === 'tablet' ? '#38bdf8' : '#94a3b8',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Tablet size={15} />
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              title="인라인 미리보기: 스마트폰 (390px)"
              style={{
                border: 'none',
                background: previewDevice === 'mobile' ? '#334155' : 'transparent',
                color: previewDevice === 'mobile' ? '#38bdf8' : '#94a3b8',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Smartphone size={15} />
            </button>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#334155', margin: '0 2px' }} />
            <button
              onClick={() => setPreviewKey((k) => k + 1)}
              title="인라인 미리보기 실행"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#4ade80',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Play size={14} fill="#4ade80" />
            </button>
            <button
              onClick={() => {
                clearProjectCache(currentScopeId);
                refreshCacheInspector();
                setPreviewKey((k) => k + 1);
                showToast('캐시 초기화됨');
              }}
              title="프로젝트 런타임 캐시(CacheService) 비우기"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Eraser size={14} />
            </button>
          </div>

          {/* 우측: 새 탭 디바이스별 실행 (PC / 태블릿 / 스마트폰) + 배포 관리 + 닫기 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              title="미배포 프로젝트를 새 탭에서 기기별로 즉시 테스트 실행"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '2px 4px'
              }}
            >
              <span style={{ fontSize: '11px', color: '#94a3b8', padding: '0 5px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                <ExternalLink size={12} color="#38bdf8" /> 새탭
              </span>
              <button
                onClick={() => handleRunInNewTab('pc')}
                title="새 탭에서 PC용으로 실행"
                style={{
                  border: 'none',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  padding: '5px 7px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <Monitor size={13} />
              </button>
              <button
                onClick={() => handleRunInNewTab('tablet')}
                title="새 탭에서 태블릿용으로 실행"
                style={{
                  border: 'none',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  padding: '5px 7px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <Tablet size={13} />
              </button>
              <button
                onClick={() => handleRunInNewTab('mobile')}
                title="새 탭에서 스마트폰용으로 실행"
                style={{
                  border: 'none',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  padding: '5px 7px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <Smartphone size={13} />
              </button>
            </div>

            <button
              onClick={() => setActiveSection('deployments')}
              title="배포 및 버전 스냅샷 관리"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Rocket size={14} />
              <span>배포</span>
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

        {/* ==================== 2. 하단 워크스페이스 (좌측 액티비티 레일 + 메인 영역) ==================== */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* 좌측 Apps Script 액티비티 아이콘 레일 (46px) */}
          <nav style={{
            width: '46px',
            backgroundColor: '#090d16',
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {(
                [
                  { id: 'projects', icon: <FolderKanban size={18} />, tip: '프로젝트 보관함 · 운영 앱 복사' },
                  { id: 'editor', icon: <Code2 size={18} />, tip: '코드 편집기 (파일 · 라이브러리 · 서비스)' },
                  { id: 'settings', icon: <SlidersHorizontal size={18} />, tip: '프로젝트 설정 · 스크립트 속성 · 반응형 제어' },
                  { id: 'deployments', icon: <Layers size={18} />, tip: '배포 관리 · 버전 롤백' },
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
                      justifyContent: 'center',
                      position: 'relative'
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
                title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
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

          {/* ==================== SECTION A: 코드 편집기 (좌측 트리 사이드바 + 에디터 + 프리뷰) ==================== */}
          {activeSection === 'editor' && (
            <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
              {/* Apps Script 스타일 왼쪽 탐색 사이드바 (파일 / 라이브러리 / 서비스) */}
              {!sidebarCollapsed && (
                <aside style={{
                  width: '228px',
                  backgroundColor: '#0b0f19',
                  borderRight: '1px solid #1e293b',
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  flexShrink: 0,
                  userSelect: 'none'
                }}>
                  {/* 1) 파일 섹션 */}
                  <div style={{ borderBottom: '1px solid #1e293b' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#94a3b8',
                      letterSpacing: '0.04em'
                    }}>
                      <div
                        onClick={() => setOpenFilesTree((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {openFilesTree ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>파일</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={handleAddFile}
                          title="새 파일 추가 (.html / .js / .css)"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
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
                              </div>
                              {!isReadOnly && f.name !== 'appsscript.json' && (
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

                  {/* 2) 라이브러리 섹션 (공유 모듈 & 표준 반응형 컴포넌트) */}
                  <div style={{ borderBottom: '1px solid #1e293b' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#94a3b8',
                      letterSpacing: '0.04em'
                    }}>
                      <div
                        onClick={() => setOpenLibsTree((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {openLibsTree ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>라이브러리</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => setShowLibPicker((v) => !v)}
                          title="공유 라이브러리 추가/관리"
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
                                fontSize: '12px'
                              }}
                            >
                              <div
                                onClick={() => !isReadOnly && toggleLibrary(meta.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isReadOnly ? 'default' : 'pointer', minWidth: 0 }}
                              >
                                <Package size={13} color={enabled ? '#38bdf8' : '#475569'} />
                                <span style={{ color: enabled ? '#e2e8f0' : '#64748b', fontWeight: 600, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {meta.identifier}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {enabled && (
                                  <button
                                    onClick={() => toggleLibraryVersion(meta.id)}
                                    title="버전 모드 전환 (HEAD 개발 최신본 / 1.0.0 고정본)"
                                    style={{
                                      border: 'none',
                                      backgroundColor: '#0f172a',
                                      color: binding?.version === 'HEAD' ? '#4ade80' : '#94a3b8',
                                      fontSize: '10px',
                                      fontFamily: 'monospace',
                                      padding: '1px 5px',
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
                                    showToast(`${meta.identifier} 스니펫 복사됨`);
                                  }}
                                  title="사용 예제 코드 클립보드 복사"
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

                  {/* 3) 내장 서비스 섹션 */}
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
                        <span>서비스</span>
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

                  {/* 빠른 스크립트 속성 바로가기 */}
                  <div style={{ marginTop: 'auto', padding: '10px', borderTop: '1px solid #1e293b' }}>
                    <button
                      onClick={() => setActiveSection('settings')}
                      title="스크립트 속성(환경변수) 및 기기별 표시 설정 열기"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '7px',
                        border: '1px solid #1e293b',
                        backgroundColor: '#0f172a',
                        color: '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>스크립트 속성</span>
                      <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                        {Object.keys(scriptProps).length}
                      </span>
                    </button>
                  </div>
                </aside>
              )}

              {/* 중앙: 코드 에디터 */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid #1e293b',
                minWidth: 0
              }}>
                <div style={{
                  height: '32px',
                  backgroundColor: '#0b0f19',
                  borderBottom: '1px solid #1e293b',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontFamily: 'Consolas, monospace',
                  color: '#cbd5e1'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {activeFile && getFileIcon(activeFile.name)}
                    <span>{activeFile?.name}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    V8 · {isReadOnly ? 'READ-ONLY' : isDirty ? 'UNSAVED' : 'SAVED'}
                  </span>
                </div>

                <textarea
                  value={activeFile?.content || ''}
                  readOnly={isReadOnly}
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
                    padding: '16px',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: isReadOnly ? '#0b1120' : '#0f172a',
                    color: '#f1f5f9',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    resize: 'none',
                    boxSizing: 'border-box',
                    whiteSpace: 'pre',
                    overflow: 'auto'
                  }}
                />
              </div>

              {/* 우측: 실시간 디바이스 반응형 샌드박스 프리뷰 */}
              <div style={{
                flex: 1,
                backgroundColor: '#020617',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: previewDevice === 'pc' ? 0 : '14px',
                overflow: 'hidden',
                minWidth: 0
              }}>
                <div style={{
                  width: previewDevice === 'pc' ? '100%' : previewDevice === 'tablet' ? '768px' : '390px',
                  maxWidth: '100%',
                  height: previewDevice === 'pc' ? '100%' : '94%',
                  borderRadius: previewDevice === 'pc' ? 0 : previewDevice === 'tablet' ? '14px' : '22px',
                  border: previewDevice === 'pc' ? 'none' : '4px solid #1e293b',
                  boxShadow: previewDevice === 'pc' ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.6)',
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                  transition: 'width 0.2s ease'
                }}>
                  <iframe
                    key={`${previewKey}-${previewDevice}-${currentScopeId}`}
                    srcDoc={compiledPreviewHtml}
                    title="Studio Live Preview"
                    sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      backgroundColor: '#fff'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECTION B: 프로젝트 보관함 & 운영 앱 복사 ==================== */}
          {activeSection === 'projects' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignContent: 'start' }}>
              {/* 미배포 스튜디오 프로젝트 목록 */}
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>스튜디오 프로젝트 ({studioProjects.length})</span>
                  <button
                    onClick={handleCreateNewProject}
                    title="새 프로젝트 생성"
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
                    <Plus size={14} /> 새 프로젝트
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studioProjects.length === 0 ? (
                    <div style={{ padding: '28px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                      저장된 미배포 프로젝트가 없습니다.
                    </div>
                  ) : (
                    studioProjects.map((proj) => (
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
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{proj.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                            {proj.sourcePluginId ? `원본: ${proj.sourcePluginId} · ` : ''}
                            {new Date(proj.updatedAt).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            onClick={() => window.open(`/?testRunner=${encodeURIComponent(proj.id)}&device=pc`, '_blank')}
                            title="PC 새 탭 실행"
                            style={{ border: '1px solid #334155', background: '#090d16', color: '#cbd5e1', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                          >
                            <Monitor size={13} />
                          </button>
                          <button
                            onClick={() => window.open(`/?testRunner=${encodeURIComponent(proj.id)}&device=tablet`, '_blank')}
                            title="태블릿 새 탭 실행"
                            style={{ border: '1px solid #334155', background: '#090d16', color: '#cbd5e1', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                          >
                            <Tablet size={13} />
                          </button>
                          <button
                            onClick={() => window.open(`/?testRunner=${encodeURIComponent(proj.id)}&device=mobile`, '_blank')}
                            title="스마트폰 새 탭 실행"
                            style={{ border: '1px solid #334155', background: '#090d16', color: '#cbd5e1', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                          >
                            <Smartphone size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteStudioProject(proj)}
                            title="프로젝트 삭제"
                            style={{ border: '1px solid #334155', background: '#090d16', color: '#f87171', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 현재 구동중인 운영 앱 목록 (수정 잠금 + 원클릭 사본 복제) */}
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>구동중인 운영 앱 ({plugins.length})</span>
                  <span style={{ fontSize: '11px', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> 직접 수정 보호
                  </span>
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
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                          ID: {app.id} · 배포본 {(app.deployments || []).length}개
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyAppToStudio(app)}
                        title="이 운영 앱을 스튜디오 프로젝트로 복사하여 안전하게 수정"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '7px',
                          border: '1px solid #334155',
                          backgroundColor: '#1e293b',
                          color: '#38bdf8',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Copy size={13} /> 복사
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECTION C: 프로젝트 설정 & 스크립트 속성 & 표준 반응형 매트릭스 ==================== */}
          {activeSection === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1) 표준 디바이스별 표시 제어 매트릭스 (PC 전체 표시 / 태블릿·스마트폰 조절) */}
              <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>디바이스별 표준 표시 정책 (Responsive UI Properties)</span>
                  {!isReadOnly && (
                    <button
                      onClick={handleSaveProject}
                      title="설정 저장"
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

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>핵심 콘텐츠 (core)</div>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <span style={{ color: '#4ade80' }}>표시</span>

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>보조 상세 정보 (detail)</div>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_TABLET_SHOW_DETAIL !== 'false'} onChange={(e) => updateScriptProp('UI_TABLET_SHOW_DETAIL', String(e.target.checked))} />
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_MOBILE_SHOW_DETAIL === 'true'} onChange={(e) => updateScriptProp('UI_MOBILE_SHOW_DETAIL', String(e.target.checked))} />

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>사이드바 패널 (sidebar)</div>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_TABLET_SHOW_SIDEBAR === 'true'} onChange={(e) => updateScriptProp('UI_TABLET_SHOW_SIDEBAR', String(e.target.checked))} />
                  <input type="checkbox" disabled={isReadOnly} checked={scriptProps.UI_MOBILE_SHOW_SIDEBAR === 'true'} onChange={(e) => updateScriptProp('UI_MOBILE_SHOW_SIDEBAR', String(e.target.checked))} />

                  <div style={{ color: '#cbd5e1', padding: '6px 0' }}>데스크톱 전용 (pc-only)</div>
                  <span style={{ color: '#4ade80' }}>표시</span>
                  <span style={{ color: '#64748b' }}>자동 숨김</span>
                  <span style={{ color: '#64748b' }}>자동 숨김</span>
                </div>
              </section>

              {/* 2) 프로젝트 스크립트 속성 & 플랫폼 전역 공유 속성 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* 프로젝트 전용 스크립트 속성 */}
                <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>프로젝트 스크립트 속성 (PropertiesService)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {customScriptPropEntries.map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px', alignItems: 'center' }}>
                        <input readOnly value={k} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                        <input readOnly={isReadOnly} value={v} onChange={(e) => updateScriptProp(k, e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                        {!isReadOnly && (
                          <button onClick={() => removeScriptProp(k)} title="속성 삭제" style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {!isReadOnly && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px' }}>
                      <input placeholder="속성 키 (예: API_URL)" value={newPropKey} onChange={(e) => setNewPropKey(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                      <input placeholder="값" value={newPropVal} onChange={(e) => setNewPropVal(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                      <button onClick={handleAddScriptProp} title="스크립트 속성 추가" style={{ border: 'none', backgroundColor: '#2563eb', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </section>

                {/* 플랫폼 전역 공유 속성 */}
                <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>플랫폼 전역 공유 속성 (모든 플러그인 공유)</span>
                    <button onClick={handleSaveGlobalProps} title="공유 속성 저장" style={{ border: 'none', backgroundColor: '#0284c7', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Save size={12} /> 반영
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {Object.entries(globalPropsDraft).map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px', alignItems: 'center' }}>
                        <input readOnly value={k} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#38bdf8', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                        <input
                          value={v}
                          onChange={(e) => setGlobalPropsDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                          style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }}
                        />
                        <button
                          onClick={() =>
                            setGlobalPropsDraft((prev) => {
                              const next = { ...prev };
                              delete next[k];
                              return next;
                            })
                          }
                          title="공유 속성 삭제"
                          style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', padding: '4px', display: 'flex' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: '6px' }}>
                    <input placeholder="공유 키 (예: SEMESTER)" value={newGlobalKey} onChange={(e) => setNewGlobalKey(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }} />
                    <input placeholder="공유 값" value={newGlobalVal} onChange={(e) => setNewGlobalVal(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }} />
                    <button onClick={handleSaveGlobalProps} title="공유 속성 추가" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </section>
              </div>

              {/* 3) V8 실행 환경 & 매니페스트 & 캐시 정책 */}
              <section style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={runtimeConfig.showManifest}
                    onChange={(e) => {
                      setRuntimeConfig((prev) => ({ ...prev, showManifest: e.target.checked }));
                      setIsDirty(true);
                    }}
                  />
                  <span>에디터에 appsscript.json 매니페스트 표시</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={runtimeConfig.cacheEnabled}
                    onChange={(e) => {
                      setRuntimeConfig((prev) => ({ ...prev, cacheEnabled: e.target.checked }));
                      setIsDirty(true);
                    }}
                  />
                  <span>CacheService 활성화</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>기본 캐시 TTL(초):</span>
                  <input
                    type="number"
                    min={10}
                    max={86400}
                    disabled={isReadOnly}
                    value={runtimeConfig.cacheTtlSec}
                    onChange={(e) => {
                      setRuntimeConfig((prev) => ({ ...prev, cacheTtlSec: Number(e.target.value) || 300 }));
                      setIsDirty(true);
                    }}
                    style={{ width: '80px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '6px' }}
                  />
                </div>

                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  ID: {currentScopeId} · Engine: V8 · TZ: {runtimeConfig.timeZone}
                </span>
              </section>
            </div>
          )}

          {/* ==================== SECTION D: 배포 관리 (새로 배포 & 기존 앱 교체 & 스냅샷 복원) ==================== */}
          {activeSection === 'deployments' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignContent: 'start' }}>
              {/* 좌측: 새 배포 실행 패널 */}
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Rocket size={16} color="#38bdf8" /> 새 배포 (New Deployment)
                </div>

                {isReadOnly && activeReadOnlyApp ? (
                  <div style={{ padding: '16px', backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px' }}>
                      운영 앱을 수정·배포하려면 먼저 스튜디오 사본을 생성하세요.
                    </div>
                    <button
                      onClick={() => handleCopyAppToStudio(activeReadOnlyApp)}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={14} /> 사본 생성 후 편집
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                        기존 앱 업그레이드
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
                        신규 정식 앱 배포
                      </button>
                    </div>

                    {deployMode === 'upgrade' ? (
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>교체할 대상 운영 앱</div>
                        <select
                          value={deployTargetAppId}
                          onChange={(e) => setDeployTargetAppId(e.target.value)}
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
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>정식 앱 이름</div>
                          <input
                            value={deployNewAppName}
                            onChange={(e) => setDeployNewAppName(e.target.value)}
                            placeholder="예: 자습실 좌석 예약"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>고유 앱 ID</div>
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
                                <option value="Puzzle">Puzzle</option>
                                <option value="PenTool">PenTool</option>
                                <option value="Users">Users</option>
                                <option value="ShieldAlert">Shield</option>
                              </select>
                              <select value={deployNewCategory} onChange={(e) => setDeployNewCategory(e.target.value as 'classroom' | 'management' | 'utility')} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}>
                                <option value="classroom">수업</option>
                                <option value="management">행정</option>
                                <option value="utility">도구</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>버전</div>
                        <input
                          value={deployVersion}
                          onChange={(e) => setDeployVersion(e.target.value)}
                          placeholder="1.1.0"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>배포 메모</div>
                        <input
                          value={deployNote}
                          onChange={(e) => setDeployNote(e.target.value)}
                          placeholder="변경 요약"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleExecuteDeploy}
                      style={{
                        marginTop: '6px',
                        padding: '10px 16px',
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
                      <span>{deployMode === 'upgrade' ? '새 배포본 저장 및 운영 앱 교체' : '정식 앱으로 신규 배포'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 우측: 배포본 히스토리 & 언제든 이전 상태로 롤백/복원 */}
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>배포본 버전 관리 (Manage Deployments)</span>
                  <select
                    value={historyFilterAppId}
                    onChange={(e) => setHistoryFilterAppId(e.target.value)}
                    style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '5px 10px', borderRadius: '7px', fontSize: '12px' }}
                  >
                    <option value="all">전체 운영 앱</option>
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
                              현재 v{app.version}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopyAppToStudio(app)}
                            title="현재 운영 버전을 스튜디오 프로젝트로 복사"
                            style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Copy size={12} /> 사본
                          </button>
                        </div>

                        {depList.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            초기 정적 빌드 상태 (첫 업그레이드 배포 시 원본이 자동 백업됩니다)
                          </div>
                        ) : (
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
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#4ade80' }}>ACTIVE</span>
                                      )}
                                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{dep.note || ''}</span>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                      {new Date(dep.deployedAt).toLocaleString()} · {dep.codeType === 'url' ? '정적 원본' : '스튜디오 배포본'}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {!isActive && (
                                      <button
                                        onClick={() => handleActivateSnapshot(app, dep)}
                                        title="이 버전으로 즉시 복원/전환"
                                        style={{ border: 'none', backgroundColor: '#0284c7', color: '#fff', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                                      >
                                        <RotateCcw size={13} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleForkDeploymentToStudio(app, dep)}
                                      title="이 배포본을 새 스튜디오 프로젝트로 복사"
                                      style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#cbd5e1', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleEditSnapshotNote(app, dep)}
                                      title="배포 메모 수정"
                                      style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    {!isActive && (
                                      <button
                                        onClick={() => handleDeleteSnapshot(app, dep)}
                                        title="배포 스냅샷 삭제"
                                        style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f87171', padding: '5px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECTION E: 실행 로그 & CacheService 모니터 ==================== */}
          {activeSection === 'executions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }}>
              {/* 실시간 실행 로그 */}
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>실행 로그 (Logger & Console)</span>
                  <button
                    onClick={() => setLogs([])}
                    title="로그 비우기"
                    style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ flex: 1, minHeight: '300px', backgroundColor: '#020617', borderRadius: '8px', padding: '12px', fontFamily: 'Consolas, monospace', fontSize: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {logs.length === 0 ? (
                    <span style={{ color: '#475569' }}>출력된 실행 로그가 없습니다.</span>
                  ) : (
                    logs.map((item, idx) => (
                      <div key={item.timestamp + '-' + idx} style={{ color: item.level === 'error' ? '#f87171' : item.level === 'warn' ? '#facc15' : '#cbd5e1' }}>
                        <span style={{ color: '#475569', marginRight: '8px' }}>
                          [{new Date(item.timestamp).toLocaleTimeString()}]
                        </span>
                        <span>{item.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* CacheService 키 모니터 */}
              <div style={{ backgroundColor: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>캐시 모니터 (CacheService)</span>
                  <button
                    onClick={() => {
                      clearProjectCache(currentScopeId);
                      refreshCacheInspector();
                      showToast('캐시 비움 완료');
                    }}
                    title="전체 캐시 비우기"
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
        </div>
      </div>
    </div>
  );
};
