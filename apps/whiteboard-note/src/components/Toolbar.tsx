import React from 'react';
import { Pen, Highlighter, Eraser, RotateCcw, RotateCw, Trash2, Home, Download } from 'lucide-react';

interface ToolbarProps {
  currentTool: 'pen' | 'highlighter' | 'eraser';
  setCurrentTool: (tool: 'pen' | 'highlighter' | 'eraser') => void;
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const COLORS = [
  '#000000', // 검정
  '#E02424', // 빨강
  '#2563EB', // 파랑
  '#059669', // 초록
  '#D97706', // 주황
  '#7C3AED', // 보라
  '#FFFFFF'  // 흰색 (칠판용)
];

const WIDTHS = [3, 6, 10, 16];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setCurrentTool,
  color,
  setColor,
  width,
  setWidth,
  onUndo,
  onRedo,
  onClear,
  onSave,
  canUndo,
  canRedo
}) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(8px)',
      padding: '8px 16px',
      borderRadius: '24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 100,
      userSelect: 'none'
    }}>
      {/* 홈(포털)으로 돌아가기 버튼 */}
      <a 
        href="/"
        title="메인 포털로 돌아가기"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#f3f4f6',
          color: '#374151',
          textDecoration: 'none'
        }}
      >
        <Home size={18} />
      </a>

      <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />

      {/* 도구 선택 (펜, 형광펜, 지우개) */}
      <button
        onClick={() => setCurrentTool('pen')}
        title="필기펜"
        style={{
          padding: '8px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: currentTool === 'pen' ? '#eff6ff' : 'transparent',
          color: currentTool === 'pen' ? '#2563eb' : '#4b5563',
          cursor: 'pointer'
        }}
      >
        <Pen size={20} />
      </button>

      <button
        onClick={() => setCurrentTool('highlighter')}
        title="형광펜"
        style={{
          padding: '8px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: currentTool === 'highlighter' ? '#fef3c7' : 'transparent',
          color: currentTool === 'highlighter' ? '#d97706' : '#4b5563',
          cursor: 'pointer'
        }}
      >
        <Highlighter size={20} />
      </button>

      <button
        onClick={() => setCurrentTool('eraser')}
        title="지우개"
        style={{
          padding: '8px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: currentTool === 'eraser' ? '#fee2e2' : 'transparent',
          color: currentTool === 'eraser' ? '#dc2626' : '#4b5563',
          cursor: 'pointer'
        }}
      >
        <Eraser size={20} />
      </button>

      <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />

      {/* 색상 팔레트 */}
      {currentTool !== 'eraser' && (
        <div style={{ display: 'flex', gap: '6px' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: c,
                border: color === c ? '3px solid #2563eb' : '1px solid #d1d5db',
                cursor: 'pointer',
                transform: color === c ? 'scale(1.15)' : 'scale(1)'
              }}
            />
          ))}
        </div>
      )}

      {/* 선 굵기 조절 */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: width === w ? '1px solid #2563eb' : '1px solid transparent',
              backgroundColor: width === w ? '#eff6ff' : 'transparent',
              fontSize: '12px',
              fontWeight: width === w ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            {w}px
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />

      {/* 실행취소 / 다시실행 / 전체삭제 / 저장 */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        style={{ border: 'none', background: 'none', opacity: canUndo ? 1 : 0.3, cursor: canUndo ? 'pointer' : 'default' }}
      >
        <RotateCcw size={18} />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        style={{ border: 'none', background: 'none', opacity: canRedo ? 1 : 0.3, cursor: canRedo ? 'pointer' : 'default' }}
      >
        <RotateCw size={18} />
      </button>

      <button
        onClick={onClear}
        title="칠판 지우기"
        style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}
      >
        <Trash2 size={18} />
      </button>

      <button
        onClick={onSave}
        title="이미지로 저장"
        style={{ border: 'none', background: 'none', color: '#059669', cursor: 'pointer' }}
      >
        <Download size={18} />
      </button>
    </div>
  );
};
