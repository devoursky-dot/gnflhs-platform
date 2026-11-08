import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@gnflhs/shared-auth';
import { AppPlugin, StudioProject } from '@gnflhs/shared-types';
import {
  DEFAULT_LIBRARIES,
  DEFAULT_RUNTIME_CONFIG,
  DEFAULT_SCRIPT_PROPERTIES,
  DEFAULT_SERVICES,
  getStarterFilesForPlugin
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
  } catch (e) {}
}

function loadLocalProjectsList(): StudioProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    if (!raw) return [];
    const map: Record<string, StudioProject> = JSON.parse(raw);
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    return [];
  }
}

/**
 * 스튜디오 미배포 프로젝트 실시간 구독
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
  } catch (e) {
    callback(loadLocalProjectsList());
    return () => {};
  }
}

/**
 * 단일 스튜디오 프로젝트 조회 (새 탭 테스트 실행용: 로컬 즉시 로드 + Firestore 동기화)
 */
export async function getStudioProjectById(projectId: string): Promise<StudioProject | null> {
  try {
    const localRaw = localStorage.getItem(`gnflhs_studio_draft_${projectId}`);
    if (localRaw) {
      return JSON.parse(localRaw) as StudioProject;
    }
  } catch (e) {}

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

/**
 * 단일 스튜디오 프로젝트 실시간 구독 (새 탭 실행 중 실시간 반영용)
 */
export function subscribeSingleStudioProject(
  projectId: string,
  callback: (project: StudioProject | null) => void
): () => void {
  try {
    const localRaw = localStorage.getItem(`gnflhs_studio_draft_${projectId}`);
    if (localRaw) {
      callback(JSON.parse(localRaw) as StudioProject);
    }
  } catch (e) {}

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
  } catch (e) {
    return () => {};
  }
}

/**
 * 새로운 빈 스튜디오 프로젝트 생성
 */
export async function createBlankStudioProject(name: string = '새 스튜디오 프로젝트'): Promise<StudioProject> {
  const now = Date.now();
  const id = `proj-${now.toString(36)}`;
  const project: StudioProject = {
    id,
    name: name.trim() || '새 스튜디오 프로젝트',
    description: '스튜디오에서 작성 중인 미배포 프로젝트',
    icon: 'Puzzle',
    category: 'utility',
    files: getStarterFilesForPlugin(undefined, name.trim() || '새 스튜디오 프로젝트'),
    scriptProperties: { ...DEFAULT_SCRIPT_PROPERTIES },
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
 * 현재 구동중인 운영 앱을 수정하지 않고 안전한 스튜디오 프로젝트 사본으로 복제
 */
export async function cloneAppToStudioProject(
  sourceApp: AppPlugin,
  customName?: string
): Promise<StudioProject> {
  const now = Date.now();
  const id = `proj-${sourceApp.id}-${now.toString().slice(-5)}`;
  const projectName = customName?.trim() || `${sourceApp.name} (사본)`;

  const clonedFiles =
    sourceApp.files && sourceApp.files.length > 0
      ? sourceApp.files.map((f) => ({ ...f }))
      : sourceApp.customCode
      ? [
          { name: 'index.html', content: sourceApp.customCode },
          { name: 'script.js', content: '// custom script' },
          { name: 'style.css', content: '/* custom style */' }
        ]
      : getStarterFilesForPlugin(sourceApp.id, sourceApp.name);

  const project: StudioProject = {
    id,
    name: projectName,
    description: sourceApp.description || `${sourceApp.name} 기반 스튜디오 작업본`,
    icon: sourceApp.icon || 'Puzzle',
    category: sourceApp.category || 'utility',
    sourcePluginId: sourceApp.id,
    files: clonedFiles,
    scriptProperties: {
      ...DEFAULT_SCRIPT_PROPERTIES,
      ...(sourceApp.scriptProperties || {})
    },
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
 * 스튜디오 프로젝트 저장 (인메모리 즉시 로컬 동기화 + Firestore 영구 저장)
 */
export async function saveStudioProject(project: StudioProject): Promise<StudioProject> {
  const updated: StudioProject = {
    ...project,
    updatedAt: Date.now()
  };
  saveLocalProjectMirror(updated);
  await setDoc(doc(db, STUDIO_COLLECTION, updated.id), updated, { merge: true });
  return updated;
}

/**
 * 스튜디오 미배포 프로젝트 삭제
 */
export async function deleteStudioProject(projectId: string): Promise<void> {
  removeLocalProjectMirror(projectId);
  await deleteDoc(doc(db, STUDIO_COLLECTION, projectId));
}

/**
 * 플랫폼 전역 공유 스크립트 속성 구독 및 저장
 */
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
  } catch (e) {
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

/**
 * 프로젝트별 CacheService 상태 조회 및 초기화
 */
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
  } catch (e) {}
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
  } catch (e) {}
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
      } catch (e) {}
    };

    try {
      const scopeId = String(projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (action === 'DB_GET') {
        const key = String(args?.key || 'default');
        const snap = await getDoc(doc(db, 'plugin_data', scopeId, 'items', key));
        reply(snap.exists() ? snap.data()?.value ?? null : null);
      } else if (action === 'DB_SET') {
        const key = String(args?.key || 'default');
        await setDoc(doc(db, 'plugin_data', scopeId, 'items', key), {
          value: args?.value ?? null,
          updatedAt: Date.now()
        });
        reply(true);
      } else if (action === 'DB_REMOVE') {
        const key = String(args?.key || 'default');
        await deleteDoc(doc(db, 'plugin_data', scopeId, 'items', key));
        reply(true);
      } else if (action === 'DB_LIST') {
        const snap = await getDocs(collection(db, 'plugin_data', scopeId, 'items'));
        const items: Array<{ id: string; value: unknown }> = [];
        snap.forEach((d) => items.push({ id: d.id, value: d.data()?.value }));
        reply(items);
      } else if (action === 'STORAGE_LIST') {
        const folder = String(args?.folder || 'shared');
        const res = await listStoragePath(folder);
        reply(res.files);
      } else {
        reply(null, `Unknown RPC action: ${action}`);
      }
    } catch (err: any) {
      reply(null, err?.message || 'RPC Error');
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
