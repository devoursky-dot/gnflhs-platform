import React, { useState, useEffect, useRef } from 'react';
import { AppPlugin } from '@gnflhs/shared-types';
import { hotSwapPluginCode, resetPluginToBuildVersion, updatePlugin } from '../services/pluginService';
import { Code2, Play, Zap, RotateCcw, X, Sparkles, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';

interface PluginDevStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: AppPlugin[];
}

// 1. 전자칠판 고속 판서 템플릿
const TEMPLATE_WHITEBOARD = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>전자칠판 초경량 고속 판서</title>
  <style>
    body { margin: 0; background: #1e293b; color: #fff; font-family: sans-serif; overflow: hidden; }
    #toolbar { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.9); padding: 8px 16px; border-radius: 24px; display: flex; gap: 8px; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid #334155; }
    button { background: #334155; color: #fff; border: none; padding: 6px 14px; border-radius: 12px; font-weight: bold; cursor: pointer; }
    button.active { background: #2563eb; }
    canvas { display: block; touch-action: none; cursor: crosshair; }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="btnPen" class="active">✏️ 흰색 펜</button>
    <button id="btnRed">🔴 빨강</button>
    <button id="btnYellow">🟡 노랑</button>
    <button id="btnEraser">🧹 지우개</button>
    <button id="btnClear">🗑️ 모두 지우기</button>
  </div>
  <canvas id="canvas"></canvas>

  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let color = '#ffffff';
    let size = 6;
    let isEraser = false;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function start(e) {
      drawing = true;
      ctx.beginPath();
      const pt = getPt(e);
      ctx.moveTo(pt.x, pt.y);
    }
    function draw(e) {
      if (!drawing) return;
      const pt = getPt(e);
      ctx.strokeStyle = isEraser ? '#1e293b' : color;
      ctx.lineWidth = isEraser ? 30 : (size * (pt.pressure || 1));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
    function end() { drawing = false; }
    function getPt(e) {
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX, y: p.clientY, pressure: e.pressure || 1 };
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', end);

    document.getElementById('btnPen').onclick = () => { isEraser = false; color = '#ffffff'; };
    document.getElementById('btnRed').onclick = () => { isEraser = false; color = '#ef4444'; };
    document.getElementById('btnYellow').onclick = () => { isEraser = false; color = '#facc15'; };
    document.getElementById('btnEraser').onclick = () => { isEraser = true; };
    document.getElementById('btnClear').onclick = () => { ctx.clearRect(0,0,canvas.width,canvas.height); };
  </script>
</body>
</html>`;

// 2. 기숙사 벌점 신속 입력 템플릿
const TEMPLATE_DORMITORY = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>기숙사 신속 벌점 등록</title>
  <style>
    body { font-family: sans-serif; background: #f8fafc; padding: 24px; color: #1e293b; margin: 0; }
    .card { max-width: 500px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    h2 { margin-top: 0; color: #0f172a; }
    .field { margin-bottom: 14px; }
    label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: #64748b; }
    input, select, textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    #log { margin-top: 20px; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    .log-item { background: #fee2e2; color: #991b1b; padding: 8px; border-radius: 6px; margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🏠 기숙사 벌점 신속 배부 (핫스왑 버전)</h2>
    <div class="field">
      <label>호실 및 학번</label>
      <input id="student" placeholder="예: 301호 홍길동 (10101)">
    </div>
    <div class="field">
      <label>위반 사유</label>
      <select id="reason">
        <option>점호 시간 지각 (1점)</option>
        <option>취침 후 전자기기 사용 (2점)</option>
        <option>기숙사 내 음식물 반입 (3점)</option>
      </select>
    </div>
    <button onclick="addLog()">벌점 즉시 등록</button>
    <div id="log"><strong>최근 등록 내역:</strong></div>
  </div>
  <script>
    function addLog() {
      const s = document.getElementById('student').value;
      const r = document.getElementById('reason').value;
      if (!s) return alert('학생 정보를 입력하세요');
      const div = document.createElement('div');
      div.className = 'log-item';
      div.textContent = '⚡ ' + s + ' - ' + r + ' (' + new Date().toLocaleTimeString() + ')';
      document.getElementById('log').appendChild(div);
      document.getElementById('student').value = '';
    }
  </script>
</body>
</html>`;

export const PluginDevStudioModal: React.FC<PluginDevStudioModalProps> = ({
  isOpen,
  onClose,
  plugins
}) => {
  const [selectedPluginId, setSelectedPluginId] = useState<string>('whiteboard');
  const [code, setCode] = useState<string>(TEMPLATE_WHITEBOARD);
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 선택된 플러그인이 변경될 때 기존 핫스왑 코드 불러오기
  useEffect(() => {
    const target = plugins.find(p => p.id === selectedPluginId);
    if (target && target.customCode) {
      setCode(target.customCode);
    } else if (selectedPluginId === 'whiteboard') {
      setCode(TEMPLATE_WHITEBOARD);
    } else if (selectedPluginId === 'dormitory-penalty') {
      setCode(TEMPLATE_DORMITORY);
    }
  }, [selectedPluginId, plugins]);

  if (!isOpen) return null;

  const currentTarget = plugins.find(p => p.id === selectedPluginId);

  // 1. 우측 프리뷰 실행 (런타임 테스트)
  const handleRunTest = () => {
    setPreviewKey(prev => prev + 1);
  };

  // 2. [기존 앱으로 즉시 교체 (Hot-Swap)]
  const handleApplyHotSwap = async () => {
    if (!confirm(`'${currentTarget?.name || selectedPluginId}' 앱을 현재 입력한 코드로 즉시 교체하시겠습니까?\n\n빌드나 배포 없이 실시간으로 모든 사용자에게 적용됩니다.`)) {
      return;
    }
    setIsProcessing(true);
    setSaveSuccessMsg(null);
    try {
      await hotSwapPluginCode(selectedPluginId, code);
      setSaveSuccessMsg(`'${currentTarget?.name || selectedPluginId}' 앱이 성공적으로 핫스왑 교체되었습니다!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('저장 실패: ' + err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. [정적 빌드 버전으로 복원]
  const handleResetToDefault = async () => {
    if (!confirm(`'${currentTarget?.name}'의 핫스왑 코드를 삭제하고, 기본 정식 빌드 버전으로 원복하시겠습니까?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await resetPluginToBuildVersion(selectedPluginId);
      setCode(selectedPluginId === 'whiteboard' ? TEMPLATE_WHITEBOARD : TEMPLATE_DORMITORY);
      alert('정식 빌드 버전으로 원복되었습니다.');
    } catch (err: any) {
      alert('원복 실패: ' + err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        backgroundColor: '#fff',
        width: '96vw',
        height: '92vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* 상단 헤더 */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: '#3b82f6', borderRadius: '8px', display: 'flex' }}>
              <Code2 size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                플러그인 실시간 코드 스튜디오 (Live Code & Hot-Swap Studio)
                <span style={{ fontSize: '11px', backgroundColor: '#f59e0b', color: '#78350f', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  무배포 실시간 핫스왑
                </span>
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>
                배포 없이 여기서 직접 코드를 작성하고 우측에서 실시간 테스트한 후, 클릭 한 번으로 기존 앱을 즉각 교체하세요.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* 제어 툴바 */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* 타깃 플러그인 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>교체/업그레이드 대상 앱:</span>
            <select
              value={selectedPluginId}
              onChange={(e) => setSelectedPluginId(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#1e293b' }}
            >
              {plugins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id}) {p.codeType === 'inline_html' ? '⚡ 핫스왑 운용중' : '📦 정적 빌드본'}
                </option>
              ))}
            </select>

            {/* 템플릿 로드 버튼 */}
            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '12px' }}>템플릿 불러오기:</span>
            <button
              onClick={() => setCode(TEMPLATE_WHITEBOARD)}
              style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              칠판 필기 템플릿
            </button>
            <button
              onClick={() => setCode(TEMPLATE_DORMITORY)}
              style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              기숙사 벌점 템플릿
            </button>
          </div>

          {/* 성공 메시지 */}
          {saveSuccessMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontSize: '13px', fontWeight: 'bold' }}>
              <CheckCircle2 size={16} />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* 주요 동작 버튼 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleRunTest}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Play size={16} /> 실시간 테스트 실행
            </button>

            <button
              onClick={handleApplyHotSwap}
              disabled={isProcessing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                backgroundColor: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)'
              }}
            >
              <Zap size={16} /> {isProcessing ? '교체 중...' : '기존 앱에 즉시 핫스왑 교체'}
            </button>

            {currentTarget?.codeType === 'inline_html' && (
              <button
                onClick={handleResetToDefault}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: '#fff',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                title="입력한 코드를 지우고 원래 정식 빌드된 버전으로 복원"
              >
                <RotateCcw size={14} /> 빌드본 복원
              </button>
            )}
          </div>
        </div>

        {/* 메인 2분할 뷰: 좌측 에디터 + 우측 샌드박스 프리뷰 */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* 1. 좌측: 실시간 코드 에디터 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>✏️ 소스 코드 에디터 (HTML / CSS / JS 통합 지원)</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Ctrl+A 후 새 코드를 붙여넣으셔도 됩니다</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="여기에 직접 HTML, CSS, JavaScript 코드를 입력하거나 붙여넣으세요..."
              style={{
                flex: 1,
                width: '100%',
                padding: '16px',
                border: 'none',
                outline: 'none',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                resize: 'none',
                boxSizing: 'border-box',
                whiteSpace: 'pre',
                overflow: 'auto'
              }}
              spellCheck={false}
            />
          </div>

          {/* 2. 우측: 실시간 샌드박스 테스트기 (Iframe Sandbox) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9' }}>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#e2e8f0',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={14} color="#0284c7" />
                실시간 독립 샌드박스 실행기 (실제 마우스/펜 필기 테스트)
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>격리 환경(Sandbox)에서 안전하게 구동</span>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
              <iframe
                key={previewKey}
                ref={iframeRef}
                srcDoc={code}
                title="Live Plugin Preview"
                sandbox="allow-scripts allow-modals allow-same-origin"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff'
                }}
              />
            </div>
          </div>
        </div>

        {/* 하단 상태 가이드 */}
        <div style={{
          padding: '8px 24px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          fontSize: '12px',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            💡 <strong>사용 방법:</strong> 코드를 수정하고 <strong>[실시간 테스트 실행]</strong>을 누르면 우측에서 바로 작동합니다. 정상 동작이 확인되면 <strong>[기존 앱에 즉시 핫스왑 교체]</strong>를 누르세요.
          </div>
          <div>
            현재 대상: <strong>{currentTarget?.name}</strong> | 실행 규격: <strong>{currentTarget?.codeType === 'inline_html' ? '⚡ 핫스왑 코드' : '📦 정적 빌드 파일'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
