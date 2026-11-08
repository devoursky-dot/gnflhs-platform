import React from 'react';
import { AppPlugin, PluginStatus, UserRole } from '@gnflhs/shared-types';
import { updatePlugin, deletePlugin } from '../services/pluginService';
import { Puzzle, X, Code2, Trash2, Rocket, Shield } from 'lucide-react';

interface PluginManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: AppPlugin[];
  onOpenInStudio?: (plugin: AppPlugin) => void;
  onOpenNewStudioProject?: () => void;
}

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({
  isOpen,
  onClose,
  plugins,
  onOpenInStudio,
  onOpenNewStudioProject
}) => {
  if (!isOpen) return null;

  const handleChannelChange = async (plugin: AppPlugin, nextStatus: PluginStatus) => {
    await updatePlugin({
      ...plugin,
      status: nextStatus
    });
  };

  const handleToggleRole = async (plugin: AppPlugin, role: UserRole) => {
    const current = new Set<UserRole>(
      plugin.allowedRoles || ['super_admin', 'admin', 'teacher', 'student']
    );
    if (current.has(role)) {
      current.delete(role);
    } else {
      current.add(role);
    }
    current.add('super_admin');
    await updatePlugin({
      ...plugin,
      allowedRoles: Array.from(current)
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", sans-serif'
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: '92%',
          maxWidth: '780px',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.22)'
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '14px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Puzzle size={20} color="#2563eb" />
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                배포 앱 운영 채널 · 접근 권한 관리
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
              배포된 앱의 노출 채널(LIVE/BETA/중지)과 교사·학생 권한을 제어합니다. (최고관리자 전용 계정관리는 시스템 콘솔로 분리 보호됨)
            </p>
          </div>
          <button
            onClick={onClose}
            title="닫기"
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} color="#64748b" />
          </button>
        </div>

        {/* 플러그인 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {plugins.length === 0 ? (
            <div
              style={{
                padding: '36px',
                textAlign: 'center',
                color: '#64748b',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                fontSize: '13px'
              }}
            >
              현재 배포된 운영 앱이 없습니다. 개발 스튜디오에서 앱을 작성하고 정식 배포해 보세요.
            </div>
          ) : (
            plugins.map((p) => {
              const roles = p.allowedRoles || ['super_admin', 'admin', 'teacher', 'student'];
              const depCount = (p.deployments || []).length;
              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    backgroundColor: p.status === 'disabled' ? '#f8fafc' : '#fff'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h4
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            margin: 0,
                            color: p.status === 'disabled' ? '#94a3b8' : '#0f172a'
                          }}
                        >
                          {p.name}
                        </h4>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            backgroundColor: '#eff6ff',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontFamily: 'monospace'
                          }}
                        >
                          v{p.version}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          스냅샷 {depCount}개 · ID: <code>{p.id}</code>
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{p.description}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {onOpenInStudio && (
                        <button
                          onClick={() => {
                            onOpenInStudio(p);
                            onClose();
                          }}
                          title="스튜디오 작업본(HEAD)에서 안전하게 코드 및 환경변수 편집"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #bfdbfe',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Code2 size={14} />
                          <span>스튜디오 편집</span>
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          if (
                            confirm(
                              `'${p.name}' 배포 앱을 포털 런처에서 영구 삭제하시겠습니까?\n(스튜디오 작업본 코드는 그대로 안전하게 유지됩니다.)`
                            )
                          ) {
                            await deletePlugin(p.id);
                          }
                        }}
                        title="포털 배포 목록에서 삭제"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '7px',
                          borderRadius: '8px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 하단: 배포 채널 선택 + 접근 역할 체크 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>운영 채널:</span>
                      {(
                        [
                          { id: 'production', label: '🟢 정식 운영 (LIVE)', activeBg: '#dcfce7', activeColor: '#15803d' },
                          { id: 'development', label: '🟡 베타 검증 (BETA)', activeBg: '#fef3c7', activeColor: '#b45309' },
                          { id: 'disabled', label: '⚪ 숨김 (중지)', activeBg: '#e2e8f0', activeColor: '#475569' }
                        ] as Array<{ id: PluginStatus; label: string; activeBg: string; activeColor: string }>
                      ).map((ch) => {
                        const active = p.status === ch.id;
                        return (
                          <button
                            key={ch.id}
                            onClick={() => handleChannelChange(p, ch.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              border: active ? `1px solid ${ch.activeColor}` : '1px solid #e2e8f0',
                              backgroundColor: active ? ch.activeBg : '#fff',
                              color: active ? ch.activeColor : '#64748b',
                              fontSize: '11px',
                              fontWeight: active ? 700 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {ch.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Shield size={12} /> 실행 대상:
                      </span>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#334155' }}>
                        <input
                          type="checkbox"
                          checked={roles.includes('teacher')}
                          onChange={() => handleToggleRole(p, 'teacher')}
                        />
                        교사
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#334155' }}>
                        <input
                          type="checkbox"
                          checked={roles.includes('student')}
                          onChange={() => handleToggleRole(p, 'student')}
                        />
                        학생
                      </label>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 푸터: 스튜디오에서 신규 앱 제작 안내 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}
        >
          <span style={{ fontSize: '12px', color: '#475569' }}>
            신규 앱 제작 및 버전 업그레이드는 <strong>개발 스튜디오</strong> 파이프라인에서 일원화 관리됩니다.
          </span>
          {onOpenNewStudioProject && (
            <button
              onClick={() => {
                onClose();
                onOpenNewStudioProject();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Rocket size={14} /> 스튜디오 열기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
