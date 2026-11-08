// 환경변수 중앙 관리 (하드코딩 방지)

export const ENV = {
  SUPER_ADMIN_EMAIL: import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'devoursky@gmail.com',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gnflhs',
  IS_DEV: import.meta.env.DEV
};
