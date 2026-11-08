import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@gnflhs/shared-auth';
import { AppPlugin, PluginDeployment, VirtualFile } from '@gnflhs/shared-types';

const PLUGINS_COLLECTION = 'plugins';

// 초기 기본 플러그인 카탈로그 (DB가 비어있을 때 시딩용)
export const DEFAULT_PLUGINS: AppPlugin[] = [
  {
    id: 'whiteboard',
    name: '전자칠판 필기 노트',
    description: '2023년식 구형 전자칠판 최적화 & 삼성노트 REA 필압/손떨림 보정 벡터 판서앱',
    icon: 'PenTool',
    category: 'classroom',
    version: '1.0.0',
    status: 'production',
    entryUrl: '/whiteboard/',
    allowedRoles: ['super_admin', 'admin', 'teacher', 'student'],
    updatedAt: Date.now()
  },
  {
    id: 'account-manager',
    name: '통합 계정관리 센터',
    description: '최고관리자 전용 구글 시트 대량 복사/붙여넣기 및 그룹별 교사·학생 계정 관리',
    icon: 'Users',
    category: 'management',
    version: '1.0.0',
    status: 'production',
    entryUrl: '/account/',
    allowedRoles: ['super_admin'],
    updatedAt: Date.now()
  },
  {
    id: 'dormitory-penalty',
    name: '기숙사 상·벌점 관리',
    description: '학생 기숙사 호실별 상점 및 벌점 부여, 통계 조회 독립 모듈',
    icon: 'ShieldAlert',
    category: 'management',
    version: '1.0.0-beta',
    status: 'production',
    entryUrl: '/dormitory/',
    allowedRoles: ['super_admin', 'admin', 'teacher'],
    updatedAt: Date.now()
  }
];

/**
 * 실시간 플러그인 목록 구독 (Firestore onSnapshot)
 */
export function subscribePlugins(callback: (plugins: AppPlugin[]) => void): () => void {
  try {
    const colRef = collection(db, PLUGINS_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        // DB가 비어있으면 기본 플러그인 목록 반환
        callback(DEFAULT_PLUGINS);
      } else {
        const list: AppPlugin[] = [];
        snapshot.forEach((d) => list.push(d.data() as AppPlugin));
        callback(list);
      }
    }, (error) => {
      console.warn('Firestore offline fallback to default plugins:', error);
      callback(DEFAULT_PLUGINS);
    });
  } catch (err) {
    console.warn('Failed to listen to plugins, using default:', err);
    callback(DEFAULT_PLUGINS);
    return () => {};
  }
}

/**
 * 플러그인 복제 (Fork for safe testing)
 */
export async function forkPlugin(source: AppPlugin, newId: string, newName: string): Promise<AppPlugin> {
  const forked: AppPlugin = {
    ...source,
    id: newId,
    name: newName,
    description: `[테스트 복제본] ${source.name}`,
    status: 'development',
    version: `${source.version}-draft`,
    updatedAt: Date.now()
  };
  const docRef = doc(db, PLUGINS_COLLECTION, newId);
  await setDoc(docRef, forked);
  return forked;
}

/**
 * 복제본을 운영 앱으로 승격 및 교체 (Promote & Hot-Swap with Auto-Snapshot)
 */
export async function promoteForkToProduction(
  forkPluginData: AppPlugin,
  targetPluginId: string,
  note: string = '운영 승격'
): Promise<void> {
  const targetRef = doc(db, PLUGINS_COLLECTION, targetPluginId);
  const targetSnap = await getDoc(targetRef);
  let prevDeployments: PluginDeployment[] = [];

  if (targetSnap.exists()) {
    const prev = targetSnap.data() as AppPlugin;
    prevDeployments = prev.deployments || [];
    // 이전 운영본을 스냅샷으로 보관
    prevDeployments.unshift({
      version: prev.version,
      deployedAt: Date.now(),
      note: `교체 전 자동 백업 (${prev.version})`,
      files: prev.files || [{ name: 'index.html', content: prev.customCode || '' }]
    });
  }

  // 타깃 앱을 복제본의 최신 코드로 교체
  await setDoc(targetRef, {
    ...forkPluginData,
    id: targetPluginId,
    status: 'production',
    deployments: prevDeployments.slice(0, 10), // 최근 10개 버전 스냅샷 유지
    updatedAt: Date.now()
  }, { merge: true });
}

/**
 * 이전 버전 스냅샷으로 롤백 (Rollback)
 */
export async function rollbackDeployment(pluginId: string, deployment: PluginDeployment): Promise<void> {
  const targetRef = doc(db, PLUGINS_COLLECTION, pluginId);
  const mainFile = deployment.files.find(f => f.name.endsWith('.html')) || deployment.files[0];
  await setDoc(targetRef, {
    version: deployment.version,
    customCode: mainFile ? mainFile.content : '',
    files: deployment.files,
    codeType: 'inline_html',
    updatedAt: Date.now()
  }, { merge: true });
}

/**
 * 플러그인 영구 삭제
 */
export async function deletePlugin(pluginId: string): Promise<void> {
  const docRef = doc(db, PLUGINS_COLLECTION, pluginId);
  await deleteDoc(docRef);
}

/**
 * 플러그인 멀티 파일 저장
 */
export async function savePluginFiles(pluginId: string, files: VirtualFile[], combinedCode: string): Promise<void> {
  const docRef = doc(db, PLUGINS_COLLECTION, pluginId);
  await setDoc(docRef, {
    files,
    customCode: combinedCode,
    codeType: 'inline_html',
    updatedAt: Date.now()
  }, { merge: true });
}
export async function updatePlugin(plugin: AppPlugin): Promise<void> {
  const docRef = doc(db, PLUGINS_COLLECTION, plugin.id);
  await setDoc(docRef, {
    ...plugin,
    updatedAt: Date.now()
  }, { merge: true });
}

/**
 * 실시간 핫스왑 코드 주입 (배포 없이 브라우저에서 바로 코드로 기존 앱 교체)
 */
export async function hotSwapPluginCode(pluginId: string, customCode: string): Promise<void> {
  const docRef = doc(db, PLUGINS_COLLECTION, pluginId);
  await setDoc(docRef, {
    codeType: 'inline_html',
    customCode: customCode,
    updatedAt: Date.now()
  }, { merge: true });
}

/**
 * 핫스왑 코드를 정적 기본 빌드 버전으로 롤백
 */
export async function resetPluginToBuildVersion(pluginId: string): Promise<void> {
  const docRef = doc(db, PLUGINS_COLLECTION, pluginId);
  await setDoc(docRef, {
    codeType: 'url',
    customCode: '',
    updatedAt: Date.now()
  }, { merge: true });
}

/**
 * 기본 플러그인 초기 시딩
 */
export async function seedDefaultPlugins(): Promise<void> {
  for (const p of DEFAULT_PLUGINS) {
    const docRef = doc(db, PLUGINS_COLLECTION, p.id);
    await setDoc(docRef, p, { merge: true });
  }
}
