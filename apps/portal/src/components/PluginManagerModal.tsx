import React, { useState } from 'react';
import { AppPlugin, PluginStatus } from '@gnflhs/shared-types';
import { updatePlugin, seedDefaultPlugins } from '../services/pluginService';
import { Puzzle, X, Plus, ToggleLeft, ToggleRight, Sparkles, RefreshCw } from 'lucide-react';

interface PluginManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: AppPlugin[];
}

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({
  isOpen,
  onClose,
  plugins
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newVersion, setNewVersion] = useState('1.0.0');

  if (!isOpen) return null;

  const handleToggleStatus = async (plugin: AppPlugin) => {
    let nextStatus: PluginStatus = 'production';
    if (plugin.status === 'production') nextStatus = 'development';
    else if (plugin.status === 'development') nextStatus = 'disabled';
    else nextStatus = 'production';

    await updatePlugin({
      ...plugin,
      status: nextStatus
    });
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName || !newUrl) return;

    const plugin: AppPlugin = {
      id: newId.toLowerCase().trim(),
      name: newName.trim(),
      description: newDesc.trim(),
      icon: 'Puzzle',
      category: 'utility',
      version: newVersion.trim(),
      status: 'development', // 신규 플러그인은 안전을 위해 기본 개발테스트 상태로 등록
      entryUrl: newUrl.trim(),
      allowedRoles: ['super_admin'],
      updatedAt: Date.now()
    };

    await updatePlugin(plugin);
    setIsAddingNew(false);
    setNewId('');
    setNewName('');
    setNewDesc('');
    setNewUrl('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Puzzle size={20} color="#7c3aed" />
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>플러그인 모듈 관리</h2>
          </div>
          <button onClick={onClose} title="닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        {/* 플러그인 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {plugins.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: p.status === 'disabled' ? '#f8fafc' : '#fff'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: p.status === 'disabled' ? '#94a3b8' : '#1e293b' }}>
                    {p.name}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    v{p.version}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor:
                      p.status === 'production' ? '#dcfce7' :
                      p.status === 'development' ? '#fef3c7' : '#f1f5f9',
                    color:
                      p.status === 'production' ? '#15803d' :
                      p.status === 'development' ? '#b45309' : '#64748b'
                  }}>
                    {p.status === 'production' ? '🟢 정식 운영중' :
                     p.status === 'development' ? '🟡 개발테스트중 (관리자 전용)' : '⚪ 비활성화됨'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0' }}>{p.description}</p>
                <code style={{ fontSize: '11px', color: '#3b82f6' }}>경로: {p.entryUrl}</code>
              </div>

              {/* 상태 토글 버튼 */}
              <button
                onClick={() => handleToggleStatus(p)}
                title="상태 전환 (정식 운영 ➔ 개발 테스트 ➔ 비활성화)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={12} color="#64748b" />
                <span>상태 전환</span>
              </button>
            </div>
          ))}
        </div>

        {/* 신규 플러그인 등록 영역 */}
        {isAddingNew ? (
          <form onSubmit={handleAddNew} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>새로운 모듈 플러그인 등록</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="모듈 ID (예: exam-timer)" value={newId} onChange={e => setNewId(e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              <input placeholder="표시 이름 (예: 모의고사 타이머)" value={newName} onChange={e => setNewName(e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
            </div>
            <input placeholder="설명" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="실행 경로 (예: /apps/timer/)" value={newUrl} onChange={e => setNewUrl(e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              <input placeholder="버전 (예: 1.0.0)" value={newVersion} onChange={e => setNewVersion(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setIsAddingNew(false)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#e2e8f0', fontSize: '12px', cursor: 'pointer' }}>취소</button>
              <button type="submit" style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#7c3aed', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>등록하기</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setIsAddingNew(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#7c3aed',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> 신규 플러그인 등록
            </button>

            <button
              onClick={() => seedDefaultPlugins()}
              title="초기 3대 모듈(전자칠판, 계정관리, 기숙사)을 DB에 복원"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> 기본 모듈 시딩(복원)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
