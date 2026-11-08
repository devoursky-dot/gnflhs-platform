import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@gnflhs/shared-auth';
import { AppPlugin, PluginDeployment, StudioProject } from '@gnflhs/shared-types';
import {
  DEFAULT_LIBRARIES,
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SCRIPT_PROPERTIES,
  DEFAULT_SERVICES,
  extractEnvFromFiles,
  getStarterFilesForPlugin,
  syncEnvJsonFile
} from './studioCompiler';
import { listStoragePath } from './storageService';

const STUDIO_COLLECTION = 'studio_projects';
const PLATFORM_SETTINGS_COLLECTION = 'platform_settings';
const GLOBAL_PROPS_DOC = 'global_properties';
const LOCAL_PROJECTS_INDEX_KEY = 'gnflhs_studio_projects_index_v1';

function saveLocalProjectMirror(project: StudioProject) {
  try {
    localStorage.setItem(`gnflhs_studio_draft_${project.id}`, JSON.stringify(project));
    const raw = localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    const map: Record<string, StudioProject> = raw ? JSON.parse(raw) : {};
    map[project.id] = project;
    localStorage.setItem(LOCAL_PROJECTS_INDEX_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Local project mirror save failed:', e);
  }
}

function removeLocalProjectMirror(projectId: string) {
  try {
    localStorage.removeItem(`gnflhs_studio_draft_${projectId}`);
    const raw = localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    if (raw) {
      const map: Record<string, StudioProject> = JSON.parse(raw);
      delete map[projectId];
      localStorage.setItem(LOCAL_PROJECTS_INDEX_KEY, JSON.stringify(map));
    }
  } catch {}
}

function loadLocalProjectsList(): StudioProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    if (!raw) return [];
    const map: Record<string, StudioProject> = JSON.parse(raw);
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * 스튜디오 작업본(HEAD) 목록 실시간 구독
 */
export function subscribeStudioProjects(callback: (projects: StudioProject[]) => void): () => void {
  try {
    const colRef = collection(db, STUDIO_COLLECTION);
    return onSnapshot(
      colRef,
      (snap) => {
        const list: StudioProject[] = [];
        snap.forEach((d) => {
          const proj = d.data() as StudioProject;
          list.push(proj);
          saveLocalProjectMirror(proj);
        });
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        callback(list);
      },
      (err) => {
        console.warn('Studio projects fallback to local mirror:', err);
        callback(loadLocalProjectsList());
      }
    );
  } catch {
    callback(loadLocalProjectsList());
    return () => {};
  }
}

export async function getStudioProjectById(projectId: string): Promise<StudioProject | null> {
  try {
    const localRaw = localStorage.getItem(`gnflhs_studio_draft_${projectId}`);
    if (localRaw) {
      return JSON.parse(localRaw) as StudioProject;
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, STUDIO_COLLECTION, projectId));
    if (snap.exists()) {
      const data = snap.data() as StudioProject;
      saveLocalProjectMirror(data);
      return data;
    }
  } catch (e) {
    console.warn('Failed to fetch studio project from Firestore:', e);
  }
  return null;
}

export function subscribeSingleStudioProject(
  projectId: string,
  callback: (project: StudioProject | null) => void
): () => void {
  try {
    const localRaw = localStorage.getItem(`gnflhs_studio_draft_${projectId}`);
    if (localRaw) {
      callback(JSON.parse(localRaw) as StudioProject);
    }
  } catch {}

  try {
    const docRef = doc(db, STUDIO_COLLECTION, projectId);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as StudioProject;
          saveLocalProjectMirror(data);
          callback(data);
        }
      },
      () => {}
    );
  } catch {
    return () => {};
  }
}

/**
 * 새로운 독립 스튜디오 작업본(HEAD) 생성 (ES Module + env.json 기본 내장)
 */
export async function createBlankStudioProject(
  name: string = '새 스마트스쿨 앱',
  customSlug?: string
): Promise<StudioProject> {
  const now = Date.now();
  const slug = customSlug
    ? customSlug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-')
    : now.toString(36);
  const id = `proj-${slug}`;
  const cleanName = name.trim() || '새 스마트스쿨 앱';
  const starterFiles = getStarterFilesForPlugin(undefined, cleanName);
  const mergedProps = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...extractEnvFromFiles(starterFiles)
  };
  const files = syncEnvJsonFile(starterFiles, mergedProps);

  const project: StudioProject = {
    id,
    name: cleanName,
    description: `${cleanName} 스튜디오 작업본`,
    icon: 'Puzzle',
    category: 'classroom',
    files,
    scriptProperties: mergedProps,
    libraries: DEFAULT_LIBRARIES.map((l) => ({ ...l })),
    services: [...DEFAULT_SERVICES],
    runtimeConfig: { ...DEFAULT_RUNTIME_CONFIG },
    createdAt: now,
    updatedAt: now
  };
  saveLocalProjectMirror(project);
  await setDoc(doc(db, STUDIO_COLLECTION, id), project);
  return project;
}

/**
 * [핵심 V2 개선] 운영 앱과 1:1 연결된 작업본(HEAD) 열기 (불필요한 '(사본)' 중복 생성을 원천 방지)
 * - 이미 연결된 스튜디오 작업본이 있으면 즉시 해당 작업본을 반환
 * - 없으면 운영 앱의 최신 배포본을 기반으로 `proj-<appId>` 작업본을 1회 초기화하여 연결
 */
export async function openOrEnsureAppWorkspace(
  sourceApp: AppPlugin,
  existingProjects: StudioProject[] = []
): Promise<StudioProject> {
  const canonicalId = `proj-${sourceApp.id}`;
  const matched =
    existingProjects.find((p) => p.id === canonicalId) ||
    existingProjects.find((p) => p.publishedPluginId === sourceApp.id) ||
    (sourceApp.sourceStudioProjectId
      ? existingProjects.find((p) => p.id === sourceApp.sourceStudioProjectId)
      : undefined);

  if (matched) {
    // env.json 파일이 아직 없다면 자동 보장
    if (!matched.files.some((f) => f.name === 'env.json')) {
      const merged = { ...DEFAULT_SCRIPT_PROPERTIES, ...(matched.scriptProperties || {}) };
      const synced = await saveStudioProject({
        ...matched,
        publishedPluginId: sourceApp.id,
        files: syncEnvJsonFile(matched.files, merged),
        scriptProperties: merged
      });
      return synced;
    }
    return matched;
  }

  // Firestore에 이미 있는지 한 번 더 확인
  const remoteSnap = await getDoc(doc(db, STUDIO_COLLECTION, canonicalId));
  if (remoteSnap.exists()) {
    const data = remoteSnap.data() as StudioProject;
    saveLocalProjectMirror(data);
    return data;
  }

  const now = Date.now();
  const baseFiles =
    sourceApp.files && sourceApp.files.length > 0
      ? sourceApp.files.map((f) => ({ ...f }))
      : getStarterFilesForPlugin(sourceApp.id, sourceApp.name);

  const mergedProps = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...(sourceApp.scriptProperties || {}),
    ...extractEnvFromFiles(baseFiles)
  };
  const syncedFiles = syncEnvJsonFile(baseFiles, mergedProps);

  const workspace: StudioProject = {
    id: canonicalId,
    name: sourceApp.name,
    description: sourceApp.description || `${sourceApp.name} 작업본`,
    icon: sourceApp.icon || 'Puzzle',
    category: sourceApp.category || 'classroom',
    sourcePluginId: sourceApp.id,
    publishedPluginId: sourceApp.id,
    files: syncedFiles,
    scriptProperties: mergedProps,
    libraries:
      sourceApp.libraries && sourceApp.libraries.length > 0
        ? sourceApp.libraries.map((l) => ({ ...l }))
        : DEFAULT_LIBRARIES.map((l) => ({ ...l })),
    services: [...DEFAULT_SERVICES],
    runtimeConfig: sourceApp.runtimeConfig
      ? { ...sourceApp.runtimeConfig }
      : { ...DEFAULT_RUNTIME_CONFIG },
    createdAt: now,
    updatedAt: now
  };

  saveLocalProjectMirror(workspace);
  await setDoc(doc(db, STUDIO_COLLECTION, canonicalId), workspace);
  return workspace;
}

/**
 * 특정 배포 스냅샷의 소스코드를 현재 앱의 스튜디오 작업본(HEAD)으로 복원 (운영 LIVE는 건드리지 않음)
 */
export async function restoreSnapshotToWorkspace(
  app: AppPlugin,
  snapshot: PluginDeployment,
  existingProjects: StudioProject[] = []
): Promise<StudioProject> {
  const workspace = await openOrEnsureAppWorkspace(app, existingProjects);
  const mergedProps = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...(snapshot.scriptProperties || {}),
    ...extractEnvFromFiles(snapshot.files || [])
  };
  const syncedFiles = syncEnvJsonFile(
    (snapshot.files || []).map((f) => ({ ...f })),
    mergedProps
  );

  return saveStudioProject({
    ...workspace,
    files: syncedFiles,
    scriptProperties: mergedProps,
    libraries: snapshot.libraries?.length ? snapshot.libraries.map((l) => ({ ...l })) : workspace.libraries,
    runtimeConfig: snapshot.runtimeConfig ? { ...snapshot.runtimeConfig } : workspace.runtimeConfig
  });
}

/**
 * 기존 앱을 완전히 새로운 별개의 앱으로 분기 복제할 때만 사용하는 명시적 Fork 함수
 */
export async function cloneAppToStudioProject(
  sourceApp: AppPlugin,
  customName?: string
): Promise<StudioProject> {
  const now = Date.now();
  const id = `proj-fork-${now.toString(36)}`;
  const projectName = customName?.trim() || `${sourceApp.name} (새 분기 앱)`;

  const baseFiles =
    sourceApp.files && sourceApp.files.length > 0
      ? sourceApp.files.map((f) => ({ ...f }))
      : getStarterFilesForPlugin(sourceApp.id, projectName);

  const mergedProps = {
    ...DEFAULT_SCRIPT_PROPERTIES,
    ...(sourceApp.scriptProperties || {}),
    ...extractEnvFromFiles(baseFiles),
    APP_TITLE: projectName
  };
  const clonedFiles = syncEnvJsonFile(baseFiles, mergedProps);

  const project: StudioProject = {
    id,
    name: projectName,
    description: `${sourceApp.name}에서 분기된 독립 프로젝트`,
    icon: sourceApp.icon || 'Puzzle',
    category: sourceApp.category || 'utility',
    files: clonedFiles,
    scriptProperties: mergedProps,
    libraries:
      sourceApp.libraries && sourceApp.libraries.length > 0
        ? sourceApp.libraries.map((l) => ({ ...l }))
        : DEFAULT_LIBRARIES.map((l) => ({ ...l })),
    services: [...DEFAULT_SERVICES],
    runtimeConfig: sourceApp.runtimeConfig
      ? { ...sourceApp.runtimeConfig }
      : { ...DEFAULT_RUNTIME_CONFIG },
    createdAt: now,
    updatedAt: now
  };

  saveLocalProjectMirror(project);
  await setDoc(doc(db, STUDIO_COLLECTION, id), project);
  return project;
}

/**
 * 스튜디오 프로젝트 저장 (env.json <-> scriptProperties 양방향 자동 동기화 보장)
 */
export async function saveStudioProject(project: StudioProject): Promise<StudioProject> {
  const envFromFiles = extractEnvFromFiles(project.files);
  const mergedProps = {
    ...(project.scriptProperties || {}),
    ...envFromFiles
  };
  const syncedFiles = syncEnvJsonFile(project.files, mergedProps);

  const updated: StudioProject = {
    ...project,
    files: syncedFiles,
    scriptProperties: mergedProps,
    updatedAt: Date.now()
  };
  saveLocalProjectMirror(updated);
  await setDoc(doc(db, STUDIO_COLLECTION, updated.id), updated, { merge: true });
  return updated;
}

export async function deleteStudioProject(projectId: string): Promise<void> {
  removeLocalProjectMirror(projectId);
  await deleteDoc(doc(db, STUDIO_COLLECTION, projectId));
}

export function subscribeGlobalProperties(
  callback: (props: Record<string, string>) => void
): () => void {
  try {
    const docRef = doc(db, PLATFORM_SETTINGS_COLLECTION, GLOBAL_PROPS_DOC);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { values?: Record<string, string> };
          callback(data.values || {});
        } else {
          callback({
            SCHOOL_NAME: '경남외국어고등학교',
            ACADEMIC_YEAR: '2026'
          });
        }
      },
      () => {
        callback({ SCHOOL_NAME: '경남외국어고등학교', ACADEMIC_YEAR: '2026' });
      }
    );
  } catch {
    callback({ SCHOOL_NAME: '경남외국어고등학교', ACADEMIC_YEAR: '2026' });
    return () => {};
  }
}

export async function saveGlobalProperties(values: Record<string, string>): Promise<void> {
  await setDoc(
    doc(db, PLATFORM_SETTINGS_COLLECTION, GLOBAL_PROPS_DOC),
    { values, updatedAt: Date.now() },
    { merge: true }
  );
}

export interface CacheEntryInfo {
  key: string;
  value: string;
  expiresInSec: number;
}

export function listProjectCacheEntries(projectId: string): CacheEntryInfo[] {
  const prefix = `gnflhs_cache_${projectId}_`;
  const result: CacheEntryInfo[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(prefix)) {
        const raw = localStorage.getItem(fullKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const remainMs = (parsed.exp || 0) - Date.now();
        if (remainMs <= 0) {
          localStorage.removeItem(fullKey);
          continue;
        }
        result.push({
          key: fullKey.slice(prefix.length),
          value: String(parsed.val ?? ''),
          expiresInSec: Math.max(1, Math.round(remainMs / 1000))
        });
      }
    }
  } catch {}
  return result;
}

export function clearProjectCache(projectId: string): number {
  const prefix = `gnflhs_cache_${projectId}_`;
  let removed = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
      removed++;
    });
  } catch {}
  return removed;
}

/**
 * 샌드박스 iframe에서 요청하는 GNFLHS.db / GNFLHS.storage RPC 메시지 브릿지 핸들러
 */
export function attachRuntimeRpcBridge(): () => void {
  const handler = async (ev: MessageEvent) => {
    const data = ev.data;
    if (!data || !data.__gnflhs_rpc_req__) return;
    const { reqId, projectId, action, args } = data;
    const sourceWin = ev.source as Window | null;
    if (!sourceWin) return;

    const reply = (result: unknown, error?: string) => {
      try {
        sourceWin.postMessage({ __gnflhs_rpc_res__: true, reqId, result, error }, '*');
      } catch {}
    };

    // proj-xxx 스튜디오 작업본에서 실행해도 연결된 앱 ID의 DB 스코프를 일관되게 참조하도록 정규화
    const normalizedScope = String(projectId || 'default').replace(/^proj-/, '');

    try {
      if (action === 'DB_GET') {
        const ref = doc(db, 'plugin_data', normalizedScope, 'items', String(args?.key || 'default'));
        const snap = await getDoc(ref);
        reply(snap.exists() ? snap.data().value : null);
      } else if (action === 'DB_SET') {
        const ref = doc(db, 'plugin_data', normalizedScope, 'items', String(args?.key || 'default'));
        await setDoc(ref, { value: args?.value ?? null, updatedAt: Date.now() });
        reply(true);
      } else if (action === 'DB_REMOVE') {
        const ref = doc(db, 'plugin_data', normalizedScope, 'items', String(args?.key || 'default'));
        await deleteDoc(ref);
        reply(true);
      } else if (action === 'DB_LIST') {
        const { getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'plugin_data', normalizedScope, 'items'));
        const items: Array<{ id: string; value: unknown }> = [];
        snap.forEach((d) => items.push({ id: d.id, value: d.data().value }));
        reply(items);
      } else if (action === 'STORAGE_LIST') {
        const files = await listStoragePath(String(args?.folder || 'shared'));
        reply(files);
      } else {
        reply(null, `Unknown RPC action: ${action}`);
      }
    } catch (err: any) {
      reply(null, err?.message || String(err));
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
