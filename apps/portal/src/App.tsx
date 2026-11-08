import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  logout,
  isSuperAdmin,
  SUPER_ADMIN_EMAIL,
  checkRedirectResult
} from '@gnflhs/shared-auth';
import { AppPlugin, DeviceViewportType, StudioProject } from '@gnflhs/shared-types';
import { ENV } from './config/env';
import { subscribePlugins, RESERVED_SYSTEM_IDS } from './services/pluginService';
import {
  openOrEnsureAppWorkspace,
  subscribeGlobalProperties,
  subscribeStudioProjects
} from './services/studioService';
import { PluginManagerModal } from './components/PluginManagerModal';
import { PluginDevStudioModal } from './components/PluginDevStudioModal';
import { DynamicRunnerModal } from './components/DynamicRunnerModal';
import { StorageExplorerModal } from './components/StorageExplorerModal';
import { TestDeploymentRunner } from './components/TestDeploymentRunner';
import {
  LayoutGrid,
  LogIn,
  LogOut,
  PenTool,
  Users,
  ShieldAlert,
  Puzzle,
  ExternalLink,
  Code2,
  HardDrive,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [plugins, setPlugins] = useState<AppPlugin[]>([]);
  const [studioProjects, setStudioProjects] = useState<StudioProject[]>([]);
  const [globalProperties, setGlobalProperties] = useState<Record<string, string>>({});
  const [studioInitialProjectId, setStudioInitialProjectId] = useState<string | null>(null);
  const [devModeActive, setDevModeActive] = useState<boolean>(true);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [activeDynamicPlugin, setActiveDynamicPlugin] = useState<AppPlugin | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const testRunnerProjectId = urlParams.get('testRunner');
  const rawDevice = urlParams.get('device');
  const testRunnerDevice: DeviceViewportType =
    rawDevice === 'tablet' || rawDevice === 'mobile' ? rawDevice : 'pc';

  useEffect(() => {
    checkRedirectResult().catch(console.error);
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    const unsubPlugins = subscribePlugins((list) => {
      setPlugins(list);
    });
    const unsubGlobal = subscribeGlobalProperties((gp) => {
      setGlobalProperties(gp);
    });
    return () => {
      unsubAuth();
      unsubPlugins();
      unsubGlobal();
    };
  }, []);

  const isAdmin = isSuperAdmin(currentUser);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubStudio = subscribeStudioProjects((list) => {
      setStudioProjects(list);
    });
    return () => unsubStudio();
  }, [isAdmin]);

  // 1:1 연결된 스튜디오 작업본(HEAD) 열기 (불필요한 사본 중복 생성 방지)
  const handleOpenPluginInStudio = async (plugin: AppPlugin) => {
    try {
      const workspace = await openOrEnsureAppWorkspace(plugin, studioProjects);
      setStudioInitialProjectId(workspace.id);
      setIsStudioOpen(true);
    } catch (e: any) {
      alert('스튜디오 작업본 열기 오류: ' + (e?.message || e));
    }
  };

  if (testRunnerProjectId) {
    return (
      <TestDeploymentRunner
        projectId={testRunnerProjectId}
        initialDevice={testRunnerDevice}
        currentUser={currentUser}
      />
    );
  }

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error('Google login error:', error);
      alert(`로그인 오류 (${error.code || 'unknown'}): ${error.message || error}`);
    }
  };

  const visiblePlugins = plugins.filter((p) => {
    if (RESERVED_SYSTEM_IDS.includes(p.id)) return false;
    if (p.status === 'disabled') return false;
    if (p.status === 'production') return true;
    if (p.status === 'development') {
      return isAdmin && devModeActive;
    }
    return false;
  });

  const getPluginIcon = (name: string) => {
    switch (name) {
      case 'PenTool':
        return <PenTool size={28} color="#2563eb" />;
      case 'LayoutGrid':
        return <LayoutGrid size={28} color="#0284c7" />;
      case 'Users':
        return <Users size={28} color="#059669" />;
      case 'ShieldAlert':
        return <ShieldAlert size={28} color="#dc2626" />;
      default:
        return <Puzzle size={28} color="#7c3aed" />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#1e293b' }}>
      {/* 1. 상단 GNB */}
      <header
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
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
            }}
          >
            G
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{ENV.PORTAL_TITLE}</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              {ENV.PORTAL_SUBTITLE}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  {isAdmin && (
                    <span
                      style={{
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      최고관리자
                    </span>
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{currentUser.email}</span>
              </div>
              <button
                onClick={() => logout()}
                title="로그아웃"
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <LogOut size={16} color="#64748b" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
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

      {/* 2. 최고관리자 전용 시스템 제어 콘솔 바 (계정관리 · 스튜디오 · 저장소 · 배포관리 격리) */}
      {isAdmin && (
        <div
          style={{
            backgroundColor: '#090d16',
            color: '#e2e8f0',
            padding: '8px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                backgroundColor: '#2563eb',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}
            >
              SUPER ADMIN CONSOLE
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', fontFamily: 'monospace' }}>
              {SUPER_ADMIN_EMAIL}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setDevModeActive(!devModeActive)}
              title={devModeActive ? 'BETA 검증 앱 포털 표시 중' : 'BETA 검증 앱 숨김 상태'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: devModeActive ? '#1e293b' : 'transparent',
                color: devModeActive ? '#facc15' : '#64748b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {devModeActive ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>BETA 미리보기</span>
            </button>

            <button
              onClick={() => setIsStudioOpen(true)}
              title="앱 개발 · 환경변수(env.json) · 정식 배포 통합 스튜디오"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Code2 size={15} />
              <span>개발 스튜디오</span>
            </button>

            <button
              onClick={() => setIsManagerOpen(true)}
              title="배포된 앱 채널(LIVE/BETA) 및 사용자 권한 관리"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <SlidersHorizontal size={15} />
              <span>배포 앱 관리</span>
            </button>

            <button
              onClick={() => setIsStorageOpen(true)}
              title="클라우드 저장소 매니저"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <HardDrive size={15} />
              <span>저장소</span>
            </button>

            <div style={{ width: '1px', height: '18px', backgroundColor: '#334155', margin: '0 2px' }} />

            <button
              onClick={() => {
                window.location.href = ENV.ACCOUNT_CONSOLE_PATH;
              }}
              title="최고관리자 전용 통합 계정관리 시스템 (일반 배포 카탈로그와 분리 보호됨)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: 'rgba(5, 150, 105, 0.15)',
                color: '#34d399',
                border: '1px solid #059669',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Lock size={13} />
              <span>통합 계정관리 (시스템 전용)</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. 메인 콘텐츠: 정식 배포 앱 런처 그리드 */}
      <main style={{ maxWidth: '1100px', margin: '32px auto', padding: '0 24px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
            앱 및 서비스 런처
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            운영 앱 {visiblePlugins.length}개 구동 중
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px'
          }}
        >
          {visiblePlugins.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                if (p.codeType === 'inline_html' && (p.customCode || p.files?.length)) {
                  setActiveDynamicPlugin(p);
                } else {
                  window.location.href = p.entryUrl;
                }
              }}
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px'
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '14px',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    {getPluginIcon(p.icon)}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {p.status === 'development' ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        🟡 BETA 검증중
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#15803d',
                          backgroundColor: '#dcfce7',
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        🟢 정식 v{p.version}
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPluginInStudio(p);
                        }}
                        title="스튜디오 작업본(HEAD)에서 편집"
                        style={{
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          color: '#2563eb',
                          padding: '5px 8px',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        <Code2 size={13} />
                        <span>편집</span>
                      </button>
                    )}
                  </div>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
                  {p.description}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#2563eb'
                }}
              >
                <span>앱 실행하기</span>
                <ExternalLink size={16} />
              </div>
            </div>
          ))}
        </div>
      </main>

      <PluginManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        plugins={plugins}
        onOpenInStudio={handleOpenPluginInStudio}
        onOpenNewStudioProject={() => setIsStudioOpen(true)}
      />

      <PluginDevStudioModal
        isOpen={isStudioOpen}
        onClose={() => {
          setIsStudioOpen(false);
          setStudioInitialProjectId(null);
        }}
        plugins={plugins}
        studioProjects={studioProjects}
        globalProperties={globalProperties}
        currentUser={currentUser}
        initialProjectId={studioInitialProjectId}
      />

      <StorageExplorerModal isOpen={isStorageOpen} onClose={() => setIsStorageOpen(false)} />

      <DynamicRunnerModal
        plugin={activeDynamicPlugin}
        onClose={() => setActiveDynamicPlugin(null)}
        currentUser={currentUser}
        globalProperties={globalProperties}
      />
    </div>
  );
}
