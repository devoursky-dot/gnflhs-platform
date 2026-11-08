import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { PLATFORM_ENV } from '@gnflhs/shared-types';

// 루트 .env -> PLATFORM_ENV 중앙 관리 모듈에서 Firebase 설정 주입 (중복 하드코딩 제거)
const firebaseConfig = {
  apiKey: PLATFORM_ENV.FIREBASE.apiKey,
  authDomain: PLATFORM_ENV.FIREBASE.authDomain,
  projectId: PLATFORM_ENV.FIREBASE.projectId,
  storageBucket: PLATFORM_ENV.FIREBASE.storageBucket,
  messagingSenderId: PLATFORM_ENV.FIREBASE.messagingSenderId,
  appId: PLATFORM_ENV.FIREBASE.appId
};

// 싱글톤 초기화
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { onAuthStateChanged };
export type { User };

// 최고관리자 이메일 검증 (중앙 환경변수 참조)
export const SUPER_ADMIN_EMAIL = PLATFORM_ENV.SUPER_ADMIN_EMAIL;

export function isSuperAdmin(user: User | null): boolean {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase().trim();
}

// 원클릭 구글 로그인 (팝업 차단 시 리디렉션 자동 전환)
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('Google popup login fallback:', error);
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.code === 'auth/popup-closed-by-user'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

// 리디렉션 로그인 결과 확인
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Redirect login result error:', error);
    return null;
  }
}

// 로그아웃
export async function logout() {
  await signOut(auth);
}
