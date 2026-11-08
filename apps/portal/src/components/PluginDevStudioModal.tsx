import React, { useState, useEffect } from 'react';
import { AppPlugin, VirtualFile, PluginDeployment } from '@gnflhs/shared-types';
import {
  hotSwapPluginCode,
  resetPluginToBuildVersion,
  forkPlugin,
  promoteForkToProduction,
  rollbackDeployment,
  deletePlugin,
  savePluginFiles
} from '../services/pluginService';
import {
  Play,
  Zap,
  Copy,
  History,
  RotateCcw,
  Trash2,
  X,
  FileCode,
  Palette,
  Code2,
  Plus,
  Monitor,
  Tablet,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface PluginDevStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: AppPlugin[];
}

const DEFAULT_FILES: VirtualFile[] = [
  {
    name: 'index.html',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="toolbar">
    <button id="btnPen" class="active" title="펜">✏️</button>
    <button id="btnRed" title="빨강">🔴</button>
    <button id="btnYellow" title="노랑">🟡</button>
    <button id="btnEraser" title="지우개">🧹</button>
    <button id="btnClear" title="전체 지우기">🗑️</button>
  </div>
  <canvas id="canvas"></canvas>
  <script src="script.js"></script>
</body>
</html>`
  },
  {
    name: 'script.js',
    content: `const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let color = '#ffffff';
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
  const p = getPt(e);
  ctx.moveTo(p.x, p.y);
}
function draw(e) {
  if (!drawing) return;
  const p = getPt(e);
  ctx.strokeStyle = isEraser ? '#0f172a' : color;
  ctx.lineWidth = isEraser ? 36 : (6 * (p.pressure || 1));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineTo(p.x, p.y);
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
document.getElementById('btnClear').onclick = () => { ctx.clearRect(0,0,canvas.width,canvas.height); };`
  },
  {
    name: 'style.css',
    content: `body {
  margin: 0;
  background: #0f172a;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}
#toolbar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 41, 59, 0.85);
  backdrop-filter: blur(8px);
  padding: 6px 14px;
  border-radius: 20px;
  display: flex;
  gap: 8px;
  border: 1px solid #334155;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 10;
}
button {
  background: #334155;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}
button:hover, button.active {
  background: #2563eb;
  transform: scale(1.05);
}
canvas {
  display: block;
  touch-action: none;
  cursor: crosshair;
}`
  }
];

export const PluginDevStudioModal: React.FC<PluginDevStudioModalProps> = ({
  isOpen,
  onClose,
  plugins
}) => {
  const [selectedPluginId, setSelectedPluginId] = useState<string>('whiteboard');
  const [files, setFiles] = useState<VirtualFile[]>(DEFAULT_FILES);
  const [activeFileName, setActiveFileName] = useState<string>('index.html');
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'whiteboard'>('desktop');
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const currentPlugin = plugins.find(p => p.id === selectedPluginId) || plugins[0];

  useEffect(() => {
    if (currentPlugin) {
      if (currentPlugin.files && currentPlugin.files.length > 0) {
        setFiles(currentPlugin.files);
        setActiveFileName(currentPlugin.files[0].name);
      } else if (currentPlugin.customCode) {
        setFiles([
          { name: 'index.html', content: currentPlugin.customCode },
          { name: 'script.js', content: '// script' },
          { name: 'style.css', content: '/* css */' }
        ]);
        setActiveFileName('index.html');
      } else {
        setFiles(DEFAULT_FILES);
        setActiveFileName('index.html');
      }
    }
  }, [selectedPluginId]);

  if (!isOpen) return null;

  const activeFile = files.find(f => f.name === activeFileName) || files[0];

  const handleContentChange = (newContent: string) => {
    setFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, content: newContent } : f));
  };

  // HTML + CSS + JS 인메모리 결합
  const buildCombinedCode = (): string => {
    const htmlFile = files.find(f => f.name.endsWith('.html')) || files[0];
    const cssFile = files.find(f => f.name.endsWith('.css'));
    const jsFile = files.find(f => f.name.endsWith('.js'));

    let html = htmlFile ? htmlFile.content : '';
    if (cssFile && !html.includes(cssFile.content)) {
      html = html.replace('</head>', `<style>${cssFile.content}</style></head>`);
      html = html.replace('<link rel="stylesheet" href="style.css">', '');
    }
    if (jsFile && !html.includes(jsFile.content)) {
      html = html.replace('</body>', `<script>${jsFile.content}</script></body>`);
      html = html.replace('<script src="script.js"></script>', '');
    }
    return html;
  };

  // 1. 실시간 실행 테스트
  const handleRun = () => {
    setPreviewKey(prev => prev + 1);
  };

  // 2. [Fork] 안전한 복제본 생성
  const handleFork = async () => {
    const newId = `${currentPlugin.id}-dev-${Date.now().toString().slice(-4)}`;
    const newName = `${currentPlugin.name} (테스트)`;
    try {
      await forkPlugin(currentPlugin, newId, newName);
      setSelectedPluginId(newId);
      showToast('새로운 테스트 플러그인으로 복제되었습니다.');
    } catch (e: any) {
      alert('복제 실패: ' + e?.message);
    }
  };

  // 3. [Promote] 기존 운영 플러그인으로 핫스왑 승격
  const handlePromote = async () => {
    const targetId = currentPlugin.id.includes('-dev-')
      ? currentPlugin.id.split('-dev-')[0]
      : currentPlugin.id;

    if (!confirm(`'${targetId}' 정식 운영 앱으로 즉시 교체하시겠습니까?`)) return;

    try {
      const combined = buildCombinedCode();
      const payload: AppPlugin = {
        ...currentPlugin,
        files,
        customCode: combined,
        codeType: 'inline_html',
        version: `1.${Date.now().toString().slice(-3)}`
      };
      await promoteForkToProduction(payload, targetId, '코드 스튜디오 승격');
      await savePluginFiles(currentPlugin.id, files, combined);
      showToast('운영 앱으로 즉시 승격 교체 완료!');
    } catch (e: any) {
      alert('승격 실패: ' + e?.message);
    }
  };

  // 4. [Rollback]
  const handleRollback = async (dep: PluginDeployment) => {
    if (!confirm(`'${dep.version}' 시점으로 롤백하시겠습니까?`)) return;
    try {
      await rollbackDeployment(currentPlugin.id, dep);
      setFiles(dep.files);
      setIsHistoryOpen(false);
      handleRun();
      showToast(`버전 ${dep.version}으로 복원되었습니다.`);
    } catch (e: any) {
      alert('롤백 실패: ' + e?.message);
    }
  };

  // 5. [Delete] 복제본 삭제
  const handleDeleteCurrent = async () => {
    if (!confirm(`'${currentPlugin.name}' 플러그인을 삭제하시겠습니까?`)) return;
    try {
      await deletePlugin(currentPlugin.id);
      setSelectedPluginId('whiteboard');
      showToast('플러그인이 삭제되었습니다.');
    } catch (e: any) {
      alert('삭제 실패: ' + e?.message);
    }
  };

  // 6. [Restore to static build]
  const handleRestoreStatic = async () => {
    if (!confirm('정식 빌드본으로 원복하시겠습니까?')) return;
    try {
      await resetPluginToBuildVersion(currentPlugin.id);
      showToast('기본 정적 빌드본으로 복원되었습니다.');
    } catch (e: any) {
      alert('복원 실패: ' + e?.message);
    }
  };

  const getTabIcon = (name: string) => {
    if (name.endsWith('.html')) return <Code2 size={14} color="#f97316" />;
    if (name.endsWith('.css')) return <Palette size={14} color="#38bdf8" />;
    return <FileCode size={14} color="#facc15" />;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        width: '98vw',
        height: '96vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* 상단 미니멀 툴바 */}
        <div style={{
          height: '48px',
          padding: '0 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#090d16'
        }}>
          {/* 좌측: 플러그인 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={20} color="#38bdf8" />
            <select
              value={selectedPluginId}
              onChange={(e) => setSelectedPluginId(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {plugins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id}) {p.codeType === 'inline_html' ? '⚡' : '📦'}
                </option>
              ))}
            </select>

            {statusToast && (
              <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> {statusToast}
              </span>
            )}
          </div>

          {/* 중앙: 뷰포트 토글 */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: '8px', padding: '2px', border: '1px solid #334155' }}>
            <button
              onClick={() => setDeviceMode('desktop')}
              title="데스크톱 뷰 (PC / 모니터)"
              style={{
                border: 'none',
                background: deviceMode === 'desktop' ? '#334155' : 'transparent',
                color: deviceMode === 'desktop' ? '#38bdf8' : '#94a3b8',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Monitor size={15} />
            </button>
            <button
              onClick={() => setDeviceMode('whiteboard')}
              title="전자칠판 와이드 뷰 (16:9 규격)"
              style={{
                border: 'none',
                background: deviceMode === 'whiteboard' ? '#334155' : 'transparent',
                color: deviceMode === 'whiteboard' ? '#38bdf8' : '#94a3b8',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Tablet size={15} />
            </button>
          </div>

          {/* 우측: 직관적 벡터 액션 아이콘 모음 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleRun}
              title="실시간 테스트 실행 (우측 샌드박스 새로고침)"
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
              <Play size={14} fill="#fff" />
              <span>실행</span>
            </button>

            <button
              onClick={handleFork}
              title="안전한 테스트 플러그인으로 복제 (Fork)"
              style={{
                padding: '7px 10px',
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Copy size={16} />
            </button>

            <button
              onClick={handlePromote}
              title="기존 운영 앱으로 승격 및 교체 (Hot-Swap Promote)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                backgroundColor: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.4)'
              }}
            >
              <Zap size={14} fill="#fff" />
              <span>교체 승격</span>
            </button>

            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              title="버전 배포 히스토리 및 롤백"
              style={{
                padding: '7px 10px',
                backgroundColor: isHistoryOpen ? '#334155' : '#1e293b',
                color: isHistoryOpen ? '#38bdf8' : '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <History size={16} />
            </button>

            {currentPlugin.codeType === 'inline_html' && (
              <button
                onClick={handleRestoreStatic}
                title="기본 정식 빌드본으로 복원"
                style={{
                  padding: '7px 10px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <RotateCcw size={16} />
              </button>
            )}

            {currentPlugin.id.includes('-dev-') && (
              <button
                onClick={handleDeleteCurrent}
                title="복제본 플러그인 영구 삭제"
                style={{
                  padding: '7px 10px',
                  backgroundColor: '#1e293b',
                  color: '#ef4444',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Trash2 size={16} />
              </button>
            )}

            <div style={{ width: '1px', height: '20px', backgroundColor: '#334155', margin: '0 4px' }} />

            <button
              onClick={onClose}
              title="닫기"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 메인 작업 영역: 좌측 파일 에디터 + 우측 샌드박스 프리뷰 */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* 1. 좌측: 파일 탭 + 코드 에디터 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b' }}>
            {/* 파일 탭 바 */}
            <div style={{
              height: '36px',
              backgroundColor: '#0b0f19',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              gap: '2px',
              overflowX: 'auto'
            }}>
              {files.map((f) => {
                const active = f.name === activeFileName;
                return (
                  <button
                    key={f.name}
                    onClick={() => setActiveFileName(f.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px 6px 0 0',
                      border: 'none',
                      backgroundColor: active ? '#1e293b' : 'transparent',
                      color: active ? '#f8fafc' : '#94a3b8',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: active ? 'bold' : 'normal',
                      cursor: 'pointer'
                    }}
                  >
                    {getTabIcon(f.name)}
                    <span>{f.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 코드 작성 에디터 */}
            <textarea
              value={activeFile?.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              style={{
                flex: 1,
                width: '100%',
                padding: '16px',
                border: 'none',
                outline: 'none',
                backgroundColor: '#0f172a',
                color: '#f1f5f9',
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

          {/* 2. 우측: 실시간 독립 샌드박스 프리뷰 */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#020617',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <div style={{
              width: deviceMode === 'whiteboard' ? '92%' : '100%',
              height: deviceMode === 'whiteboard' ? '88%' : '100%',
              borderRadius: deviceMode === 'whiteboard' ? '12px' : 0,
              overflow: 'hidden',
              boxShadow: deviceMode === 'whiteboard' ? '0 10px 30px rgba(0,0,0,0.6)' : 'none',
              border: deviceMode === 'whiteboard' ? '1px solid #334155' : 'none'
            }}>
              <iframe
                key={previewKey}
                srcDoc={buildCombinedCode()}
                title="Sandbox Preview"
                sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff'
                }}
              />
            </div>
          </div>

          {/* 3. 버전 히스토리 오버레이 드로어 */}
          {isHistoryOpen && (
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '320px',
              height: '100%',
              backgroundColor: '#090d16',
              borderLeft: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 20
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>배포 스냅샷 버전</span>
                <button onClick={() => setIsHistoryOpen(false)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!currentPlugin.deployments || currentPlugin.deployments.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '20px' }}>보관된 이전 버전이 없습니다</span>
                ) : (
                  currentPlugin.deployments.map((dep, idx) => (
                    <div
                      key={dep.version + idx}
                      style={{
                        padding: '10px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8' }}>v{dep.version}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{new Date(dep.deployedAt).toLocaleString()}</div>
                      </div>

                      <button
                        onClick={() => handleRollback(dep)}
                        title="이 버전으로 롤백 복원"
                        style={{
                          border: 'none',
                          background: '#0284c7',
                          color: '#fff',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex'
                        }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
