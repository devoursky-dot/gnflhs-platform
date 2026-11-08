import { collection, doc, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../packages/shared-auth/src/index';
import { AppPlugin } from '../../../../packages/shared-types/src/index';

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
 * 플러그인 상태 변경 (장착 ON / 해제 OFF / 개발테스트 전환)
 */
export async function updatePlugin(plugin: AppPlugin): Promise<void> {
  const docRef = doc(db, PLUGINS_COLLECTION, plugin.id);
  await setDoc(docRef, {
    ...plugin,
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
