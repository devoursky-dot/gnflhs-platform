import React from 'react';
import { AppPlugin } from '@gnflhs/shared-types';
import { ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';

interface DynamicRunnerModalProps {
  plugin: AppPlugin | null;
  onClose: () => void;
}

export const DynamicRunnerModal: React.FC<DynamicRunnerModalProps> = ({ plugin, onClose }) => {
  if (!plugin || plugin.codeType !== 'inline_html' || !plugin.customCode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0f172a',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 상단 핫스왑 앱 제어 바 */}
      <div style={{
        backgroundColor: '#1e293b',
        color: '#fff',
        padding: '10px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
          >
            <ArrowLeft size={16} /> 메인 포털로 나가기
          </button>
          <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{plugin.name}</span>
          <span style={{
            fontSize: '11px',
            backgroundColor: '#f59e0b',
            color: '#78350f',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Sparkles size={12} /> 실시간 핫스왑 구동중
          </span>
        </div>

        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          플랫폼 내부 런타임 인젝터에 의해 빌드 없이 즉시 실행 중입니다.
        </div>
      </div>

      {/* 전체화면 앱 구동 영역 */}
      <iframe
        srcDoc={plugin.customCode}
        title={plugin.name}
        sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          backgroundColor: '#fff'
        }}
      />
    </div>
  );
};
