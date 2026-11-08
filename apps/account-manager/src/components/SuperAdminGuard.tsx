import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isSuperAdmin, loginWithGoogle, SUPER_ADMIN_EMAIL } from '@gnflhs/shared-auth';
import { ShieldAlert, LogIn, Lock } from 'lucide-react';

interface SuperAdminGuardProps {
  children: React.ReactNode;
}

export const SuperAdminGuard: React.FC<SuperAdminGuardProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login action error:', err);
      setLoginError(err?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>인증 상태를 확인하고 있습니다...</p>
      </div>
    );
  }

  // 로그인하지 않은 경우
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
        <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: '420px' }}>
          <Lock size={48} color="#dc2626" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>최고 관리자 인증 필요</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: 1.5 }}>
            이 계정관리 시스템은 보안을 위해 최고 관리자(<strong>{SUPER_ADMIN_EMAIL}</strong>) 전용으로 엄격히 제한되어 있습니다.
          </p>
          {loginError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {loginError}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '12px',
              backgroundColor: isLoggingIn ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: isLoggingIn ? 'not-allowed' : 'pointer'
            }}
          >
            <LogIn size={18} />
            {isLoggingIn ? '로그인 창 여는 중...' : 'Google 관리자 계정으로 로그인'}
          </button>
        </div>
      </div>
    );
  }

  // 로그인했으나 최고관리자가 아닌 경우
  if (!isSuperAdmin(currentUser)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
        <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: '420px' }}>
          <ShieldAlert size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>접근 권한 없음</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
            현재 로그인된 계정: <strong>{currentUser.email}</strong><br />
            이 페이지는 지정된 최고 관리자(<strong>{SUPER_ADMIN_EMAIL}</strong>)만 접근할 수 있습니다.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#64748b',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            메인 포털로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
