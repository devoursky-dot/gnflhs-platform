import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 환경변수 기반 Firebase 설정 (하드코딩 방지)
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSy_gnflhs_default_placeholder",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "gnflhs.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "gnflhs",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "gnflhs.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "738264910794",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:738264910794:web:default"
};

// 싱글톤 초기화
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 최고관리자 이메일 검증
export const SUPER_ADMIN_EMAIL = import.meta.env?.VITE_SUPER_ADMIN_EMAIL || "devoursky@gmail.com";

export function isSuperAdmin(user: User | null): boolean {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase().trim();
}

// 원클릭 구글 로그인
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google login failed:", error);
    throw error;
  }
}

// 로그아웃
export async function logout() {
  await signOut(auth);
}
