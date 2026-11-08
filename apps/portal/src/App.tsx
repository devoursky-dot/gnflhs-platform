import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout, isSuperAdmin, SUPER_ADMIN_EMAIL } from '@gnflhs/shared-auth';
import { AppPlugin } from '@gnflhs/shared-types';
import { subscribePlugins } from './services/pluginService';
import { PluginManagerModal } from './components/PluginManagerModal';
import { LayoutGrid, LogIn, LogOut, ShieldCheck, PenTool, Users, ShieldAlert, Puzzle, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [plugins, setPlugins] = useState<AppPlugin[]>([]);
  const [devModeActive, setDevModeActive] = useState<boolean>(true); // 개발자 모드 기본 ON
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    const unsubPlugins = subscribePlugins((list) => {
      setPlugins(list);
    });
    return () => {
      unsubAuth();
      unsubPlugins();
    };
  }, []);

  const isAdmin = isSuperAdmin(currentUser);

  // 일반 유저는 'production'만 보이고, 관리자는 devModeActive 시 'development'도 함께 노출
  const visiblePlugins = plugins.filter((p) => {
    if (p.status === 'disabled') return false;
    if (p.status === 'production') return true;
    if (p.status === 'development') {
      return isAdmin && devModeActive;
    }
    return false;
  });

  const getPluginIcon = (name: string) => {
    switch (name) {
      case 'PenTool': return <PenTool size={28} color="#2563eb" />;
      case 'Users': return <Users size={28} color="#059669" />;
      case 'ShieldAlert': return <ShieldAlert size={28} color="#dc2626" />;
      default: return <Puzzle size={28} color="#7c3aed" />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#1e293b' }}>
      {/* 1. 상단 GNB */}
      <header style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>
            G
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>GNFLHS 스마트 스쿨 플랫폼</h1>
            <p style={{ fontSize: '12px', color: '#64748b' }}>플러그인 기반 모듈형 통합 포털</p>
          </div>
        </div>

        {/* 사용자 상태 및 로그인/로그아웃 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  {isAdmin && (
                    <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                      최고관리자
                    </span>
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{currentUser.displayName || currentUser.email}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{currentUser.email}</span>
              </div>
              <button
                onClick={() => logout()}
                title="로그아웃"
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', display: 'flex' }}
              >
                <LogOut size={16} color="#64748b" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => loginWithGoogle()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <LogIn size={16} /> 구글 계정 로그인
            </button>
          )}
        </div>
      </header>

      {/* 2. 최고관리자 전용 개발자 제어 바 */}
      {isAdmin && (
        <div style={{
          backgroundColor: '#312e81',
          color: '#e0e7ff',
          padding: '10px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={16} color="#fbbf24" />
            <span><strong>개발자 제어 센터</strong>: 현재 최고관리자({SUPER_ADMIN_EMAIL})로 접속 중입니다.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={devModeActive}
                onChange={(e) => setDevModeActive(e.target.checked)}
              />
              <span>개발/베타 모듈 노출</span>
            </label>

            <button
              onClick={() => setIsManagerOpen(true)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#4338ca',
                color: '#fff',
                border: '1px solid #6366f1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              플러그인 관리자 열기
            </button>
          </div>
        </div>
      )}

      {/* 3. 메인 콘텐츠: 플러그인 모듈 카드 그리드 */}
      <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>앱 및 서비스 런처</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
            원하시는 교육 및 학교 관리 모듈을 클릭하여 바로 시작하세요.
          </p>
        </div>

        {/* 플러그인 카드 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {visiblePlugins.map((p) => (
            <div
              key={p.id}
              onClick={() => window.location.href = p.entryUrl}
              style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div>
                {/* 상단 아이콘 및 상태 뱃지 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #f1f5f9'
                  }}>
                    {getPluginIcon(p.icon)}
                  </div>

                  {p.status === 'development' ? (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      padding: '3px 8px',
                      borderRadius: '12px'
                    }}>
                      🟡 BETA TEST
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '11px',
                      color: '#64748b',
                      backgroundColor: '#f1f5f9',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      v{p.version}
                    </span>
                  )}
                </div>

                {/* 제목 및 설명 */}
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
                  {p.description}
                </p>
              </div>

              {/* 하단 진입 화살표 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#2563eb'
              }}>
                <span>앱 실행하기</span>
                <ExternalLink size={16} />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 플러그인 관리자 모달 */}
      <PluginManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        plugins={plugins}
      />
    </div>
  );
}
