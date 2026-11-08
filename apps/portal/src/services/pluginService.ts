import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@gnflhs/shared-auth';
import {
  AppPlugin,
  PluginDeployment,
  PluginStatus,
  StudioProject,
  UserRole,
  VirtualFile
} from '@gnflhs/shared-types';
import { compileStudioBundle, extractEnvFromFiles, syncEnvJsonFile } from './studioCompiler';

const PLUGINS_COLLECTION = 'plugins';

/**
 * 최고관리자 전용 시스템 인프라는 일반 배포용 플러그인 카탈로그와 엄격히 분리
 */
export const RESERVED_SYSTEM_IDS = ['account-manager'];

/**
 * 실시간 정식/베타 배포 앱 목록 구독 (하드코딩 없음 · 최고관리자 시스템 앱 원천 배제)
 */
export function subscribePlugins(callback: (plugins: AppPlugin[]) => void): () => void {
  try {
    const colRef = collection(db, PLUGINS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: AppPlugin[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as AppPlugin;
          const pid = data.id || d.id;
          if (RESERVED_SYSTEM_IDS.includes(pid)) return;
          list.push({ ...data, id: pid });
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        callback(list);
      },
      (error) => {
        console.warn('Firestore plugins subscription error:', error);
        callback([]);
      }
    );
  } catch (err) {
    console.warn('Failed to listen to plugins:', err);
    callback([]);
    return () => {};
  }
}

export async function deletePlugin(pluginId: string): Promise<void> {
  if (RESERVED_SYSTEM_IDS.includes(pluginId)) {
    throw new Error('예약된 시스템 모듈은 플러그인 카탈로그에서 조작할 수 없습니다.');
  }
  await deleteDoc(doc(db, PLUGINS_COLLECTION, pluginId));
}

export async function updatePlugin(plugin: AppPlugin): Promise<void> {
  if (RESERVED_SYSTEM_IDS.includes(plugin.id)) {
    throw new Error(`'${plugin.id}'는 최고관리자 전용 시스템 예약 ID입니다.`);
  }
  const docRef = doc(db, PLUGINS_COLLECTION, plugin.id);
  await setDoc(
    docRef,
    {
      ...plugin,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

/**
 * 스튜디오 작업본(HEAD)을 새로운 독립 앱으로 신규 배포 (LIVE 정식 또는 BETA 검증 채널)
 */
export async function publishStudioProjectAsNewApp(
  project: StudioProject,
  meta: {
    appId: string;
    name: string;
    description: string;
    icon: string;
    category: 'classroom' | 'management' | 'utility';
    version: string;
    note: string;
    channel?: PluginStatus;
    allowedRoles?: UserRole[];
  },
  globalProperties: Record<string, string> = {}
): Promise<AppPlugin> {
  const now = Date.now();
  const appId = meta.appId.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');
  if (!appId || RESERVED_SYSTEM_IDS.includes(appId)) {
    throw new Error(`사용할 수 없는 예약된 시스템 ID입니다: ${appId}`);
  }

  const mergedProps = {
    ...project.scriptProperties,
    ...extractEnvFromFiles(project.files)
  };
  const syncedFiles: VirtualFile[] = syncEnvJsonFile(
    project.files.map((f) => ({ ...f })),
    mergedProps
  );

  const deploymentId = `dep-${appId}-v${(meta.version || '1.0.0').replace(/[^a-zA-Z0-9]/g, '')}-${now
    .toString(36)
    .slice(-4)}`;

  const compiledHtml = compileStudioBundle({
    projectId: appId,
    projectName: meta.name.trim(),
    files: syncedFiles,
    scriptProperties: mergedProps,
    globalProperties,
    libraries: project.libraries,
    runtimeConfig: project.runtimeConfig,
    forcedDevice: 'auto'
  });

  const initialDeployment: PluginDeployment = {
    deploymentId,
    version: meta.version.trim() || '1.0.0',
    deployedAt: now,
    note: meta.note.trim() || '신규 배포 릴리즈',
    files: syncedFiles,
    scriptProperties: mergedProps,
    libraries: project.libraries.map((l) => ({ ...l })),
    runtimeConfig: { ...project.runtimeConfig },
    codeType: 'inline_html',
    entryUrl: `/plugin/${appId}`
  };

  const newApp: AppPlugin = {
    id: appId,
    name: meta.name.trim(),
    description: meta.description.trim() || project.description,
    icon: meta.icon || project.icon || 'Puzzle',
    category: meta.category || project.category || 'utility',
    version: initialDeployment.version,
    status: meta.channel || 'production',
    entryUrl: `/plugin/${appId}`,
    allowedRoles: meta.allowedRoles || ['super_admin', 'admin', 'teacher', 'student'],
    codeType: 'inline_html',
    customCode: compiledHtml,
    files: syncedFiles,
    scriptProperties: mergedProps,
    libraries: project.libraries.map((l) => ({ ...l })),
    runtimeConfig: { ...project.runtimeConfig },
    activeDeploymentId: deploymentId,
    sourceStudioProjectId: project.id,
    deployments: [initialDeployment],
    updatedAt: now
  };

  await setDoc(doc(db, PLUGINS_COLLECTION, appId), newApp);
  return newApp;
}

/**
 * 스튜디오 작업본(HEAD)을 연결된 운영 앱의 새 버전 스냅샷으로 릴리즈 (이전 버전 스냅샷 자동 보존)
 */
export async function upgradeAppWithStudioProject(
  project: StudioProject,
  targetApp: AppPlugin,
  version: string,
  note: string,
  globalProperties: Record<string, string> = {},
  options?: {
    channel?: PluginStatus;
    allowedRoles?: UserRole[];
  }
): Promise<AppPlugin> {
  if (RESERVED_SYSTEM_IDS.includes(targetApp.id)) {
    throw new Error(`시스템 전용 모듈('${targetApp.id}')은 배포 파이프라인 대상이 아닙니다.`);
  }

  const now = Date.now();
  const targetRef = doc(db, PLUGINS_COLLECTION, targetApp.id);
  const existingSnap = await getDoc(targetRef);
  const baseApp: AppPlugin = existingSnap.exists() ? (existingSnap.data() as AppPlugin) : targetApp;

  const history: PluginDeployment[] = [...(baseApp.deployments || [])];

  if (history.length === 0 && (baseApp.files?.length || baseApp.customCode)) {
    history.push({
      deploymentId: `dep-origin-${baseApp.id}`,
      version: baseApp.version || '1.0.0',
      deployedAt: baseApp.updatedAt || now - 1000,
      note: '초기 운영 배포본 (자동 백업)',
      files: baseApp.files || [],
      scriptProperties: baseApp.scriptProperties || {},
      libraries: baseApp.libraries || [],
      runtimeConfig: baseApp.runtimeConfig,
      codeType: baseApp.codeType || 'inline_html',
      entryUrl: baseApp.entryUrl
    });
  }

  const mergedProps = {
    ...project.scriptProperties,
    ...extractEnvFromFiles(project.files)
  };
  const syncedFiles: VirtualFile[] = syncEnvJsonFile(
    project.files.map((f) => ({ ...f })),
    mergedProps
  );

  const cleanVersion = version.trim() || suggestNextVersion(baseApp.version);
  const newDeploymentId = `dep-${baseApp.id}-v${cleanVersion.replace(/[^a-zA-Z0-9]/g, '')}-${now
    .toString(36)
    .slice(-4)}`;

  const compiledHtml = compileStudioBundle({
    projectId: baseApp.id,
    projectName: baseApp.name,
    files: syncedFiles,
    scriptProperties: mergedProps,
    globalProperties,
    libraries: project.libraries,
    runtimeConfig: project.runtimeConfig,
    forcedDevice: 'auto'
  });

  const newDeployment: PluginDeployment = {
    deploymentId: newDeploymentId,
    version: cleanVersion,
    deployedAt: now,
    note: note.trim() || `v${cleanVersion} 정식 업데이트`,
    files: syncedFiles,
    scriptProperties: mergedProps,
    libraries: project.libraries.map((l) => ({ ...l })),
    runtimeConfig: { ...project.runtimeConfig },
    codeType: 'inline_html',
    entryUrl: baseApp.entryUrl
  };

  const nextDeployments = [newDeployment, ...history].slice(0, 30);

  const upgraded: AppPlugin = {
    ...baseApp,
    name: project.name.replace(/\s*\(사본\)\s*$/, '').trim() || baseApp.name,
    description: project.description || baseApp.description,
    version: cleanVersion,
    status: options?.channel || baseApp.status || 'production',
    allowedRoles: options?.allowedRoles || baseApp.allowedRoles || ['super_admin', 'admin', 'teacher', 'student'],
    codeType: 'inline_html',
    customCode: compiledHtml,
    files: syncedFiles,
    scriptProperties: mergedProps,
    libraries: project.libraries.map((l) => ({ ...l })),
    runtimeConfig: { ...project.runtimeConfig },
    activeDeploymentId: newDeploymentId,
    sourceStudioProjectId: project.id,
    deployments: nextDeployments,
    updatedAt: now
  };

  await setDoc(targetRef, upgraded, { merge: true });
  return upgraded;
}

export function suggestNextVersion(currentVersion?: string): string {
  if (!currentVersion) return '1.0.0';
  const parts = currentVersion.replace(/^v/, '').split('-')[0].split('.').map(Number);
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    return `${parts[0]}.${parts[1] + 1}.0`;
  }
  return '1.1.0';
}

/**
 * 특정 배포 스냅샷 버전으로 즉시 운영 버전 롤백/전환
 */
export async function activateDeploymentSnapshot(
  plugin: AppPlugin,
  deployment: PluginDeployment,
  globalProperties: Record<string, string> = {}
): Promise<void> {
  const targetRef = doc(db, PLUGINS_COLLECTION, plugin.id);

  if (deployment.codeType === 'url') {
    await setDoc(
      targetRef,
      {
        version: deployment.version,
        codeType: 'url',
        customCode: '',
        entryUrl: deployment.entryUrl || plugin.entryUrl,
        activeDeploymentId: deployment.deploymentId || `dep-${deployment.version}`,
        updatedAt: Date.now()
      },
      { merge: true }
    );
    return;
  }

  const mergedProps = {
    ...(deployment.scriptProperties || {}),
    ...extractEnvFromFiles(deployment.files || [])
  };

  const compiledHtml = compileStudioBundle({
    projectId: plugin.id,
    projectName: plugin.name,
    files: deployment.files || [],
    scriptProperties: mergedProps,
    globalProperties,
    libraries: deployment.libraries,
    runtimeConfig: deployment.runtimeConfig,
    forcedDevice: 'auto'
  });

  await setDoc(
    targetRef,
    {
      version: deployment.version,
      codeType: 'inline_html',
      customCode: compiledHtml,
      files: deployment.files || [],
      scriptProperties: mergedProps,
      libraries: deployment.libraries || [],
      runtimeConfig: deployment.runtimeConfig || plugin.runtimeConfig,
      activeDeploymentId: deployment.deploymentId || `dep-${deployment.version}`,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

export async function updateDeploymentMetadata(
  plugin: AppPlugin,
  targetDep: PluginDeployment,
  newNote: string
): Promise<void> {
  const list = (plugin.deployments || []).map((d) => {
    const match =
      (d.deploymentId && d.deploymentId === targetDep.deploymentId) ||
      (d.version === targetDep.version && d.deployedAt === targetDep.deployedAt);
    return match ? { ...d, note: newNote.trim() } : d;
  });
  await setDoc(doc(db, PLUGINS_COLLECTION, plugin.id), { deployments: list, updatedAt: Date.now() }, { merge: true });
}

export async function removeDeploymentSnapshot(
  plugin: AppPlugin,
  targetDep: PluginDeployment
): Promise<void> {
  const list = (plugin.deployments || []).filter((d) => {
    if (d.deploymentId && targetDep.deploymentId) {
      return d.deploymentId !== targetDep.deploymentId;
    }
    return !(d.version === targetDep.version && d.deployedAt === targetDep.deployedAt);
  });
  await setDoc(doc(db, PLUGINS_COLLECTION, plugin.id), { deployments: list, updatedAt: Date.now() }, { merge: true });
}
