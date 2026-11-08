import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { isSuperAdmin } from '@gnflhs/shared-auth';
import { DeviceViewportType, StudioProject } from '@gnflhs/shared-types';
import { ENV } from '../config/env';
import {
  attachRuntimeRpcBridge,
  clearProjectCache,
  subscribeGlobalProperties,
  subscribeSingleStudioProject
} from '../services/studioService';
import { compileStudioBundle } from '../services/studioCompiler';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  Eraser,
  RefreshCw,
  Code2
} from 'lucide-react';

interface TestDeploymentRunnerProps {
  projectId: string;
  initialDevice: DeviceViewportType;
  currentUser: User | null;
}

export const TestDeploymentRunner: React.FC<TestDeploymentRunnerProps> = ({
  projectId,
  initialDevice,
  currentUser
}) => {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [globalProps, setGlobalProps] = useState<Record<string, string>>({});
  const [device, setDevice] = useState<DeviceViewportType>(initialDevice);
  const [landscape, setLandscape] = useState<boolean>(false);
  const [runKey, setRunKey] = useState<number>(0);

  useEffect(() => {
    const detachRpc = attachRuntimeRpcBridge();
    const unsubProj = subscribeSingleStudioProject(projectId, (p) => {
      if (p) setProject(p);
    });
    const unsubGlobal = subscribeGlobalProperties((gp) => setGlobalProps(gp));
    return () => {
      detachRpc();
      unsubProj();
      unsubGlobal();
    };
  }, [projectId]);

  const switchDevice = (next: DeviceViewportType) => {
    setDevice(next);
    setLandscape(false);
    const url = new URL(window.location.href);
    url.searchParams.set('device', next);
    window.history.replaceState({}, '', url.toString());
  };

  const handleFlushAndReload = () => {
    clearProjectCache(projectId);
    setRunKey((k) => k + 1);
  };

  if (!project) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#090d16',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        fontSize: '14px'
      }}>
        테스트 프로젝트를 불러오는 중...
      </div>
    );
  }

  const compiledSrc = compileStudioBundle({
    projectId: project.id,
    projectName: project.name,
    files: project.files,
    scriptProperties: project.scriptProperties,
    globalProperties: globalProps,
    libraries: project.libraries,
    runtimeConfig: project.runtimeConfig,
    forcedDevice: device,
    currentUser: currentUser
      ? {
          email: currentUser.email,
          displayName: currentUser.displayName,
          isSuperAdmin: isSuperAdmin(currentUser)
        }
      : null
  });

  const { tablet: tb, mobile: mb } = ENV.VIEWPORTS;
  const frameDims =
    device === 'pc'
      ? { width: '100%', height: '100%', label: 'PC 100%' }
      : device === 'tablet'
      ? landscape
        ? { width: `${tb.height}px`, height: `${tb.width}px`, label: `${tb.height}×${tb.width}` }
        : { width: `${tb.width}px`, height: `${tb.height}px`, label: `${tb.width}×${tb.height}` }
      : landscape
      ? { width: `${mb.height}px`, height: `${mb.width}px`, label: `${mb.height}×${mb.width}` }
      : { width: `${mb.width}px`, height: `${mb.height}px`, label: `${mb.width}×${mb.height}` };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#020617',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* 상단 미니멀 테스트 실행 바 (아이콘 + 툴팁) */}
      <header style={{
        height: '44px',
        backgroundColor: '#090d16',
        borderBottom: '1px solid #1e293b',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Code2 size={17} color="#38bdf8" />
          <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 700 }}>{project.name}</span>
          <span
            title="스튜디오 미배포 테스트 실행 세션"
            style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '999px',
              backgroundColor: 'rgba(250, 204, 21, 0.15)',
              color: '#facc15',
              border: '1px solid rgba(250, 204, 21, 0.3)'
            }}
          >
            TEST
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            {frameDims.label}
          </span>
        </div>

        {/* 중앙: PC / 태블릿 / 스마트폰 즉시 전환 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          backgroundColor: '#1e293b',
          padding: '2px',
          borderRadius: '8px',
          border: '1px solid #334155'
        }}>
          <button
            onClick={() => switchDevice('pc')}
            title="PC용 실행 (모든 콘텐츠 전체 표시)"
            style={{
              border: 'none',
              background: device === 'pc' ? '#2563eb' : 'transparent',
              color: device === 'pc' ? '#fff' : '#94a3b8',
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
            onClick={() => switchDevice('tablet')}
            title="태블릿용 실행 (768×1024 표준 뷰포트)"
            style={{
              border: 'none',
              background: device === 'tablet' ? '#2563eb' : 'transparent',
              color: device === 'tablet' ? '#fff' : '#94a3b8',
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Tablet size={15} />
          </button>
          <button
            onClick={() => switchDevice('mobile')}
            title="스마트폰용 실행 (390×844 모바일 뷰포트)"
            style={{
              border: 'none',
              background: device === 'mobile' ? '#2563eb' : 'transparent',
              color: device === 'mobile' ? '#fff' : '#94a3b8',
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Smartphone size={15} />
          </button>
          {device !== 'pc' && (
            <button
              onClick={() => setLandscape((v) => !v)}
              title="가로 / 세로 화면 회전"
              style={{
                border: 'none',
                background: landscape ? '#334155' : 'transparent',
                color: landscape ? '#38bdf8' : '#94a3b8',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <RotateCw size={14} />
            </button>
          )}
        </div>

        {/* 우측: 캐시 초기화 & 새로고침 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleFlushAndReload}
            title="캐시 초기화 후 다시 실행"
            style={{
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              padding: '6px 9px',
              borderRadius: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Eraser size={14} />
          </button>
          <button
            onClick={() => setRunKey((k) => k + 1)}
            title="새로고침"
            style={{
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              padding: '6px 9px',
              borderRadius: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* 디바이스 시뮬레이션 뷰포트 영역 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: device === 'pc' ? 0 : '16px',
        overflow: 'auto'
      }}>
        <div style={{
          width: frameDims.width,
          height: frameDims.height,
          maxWidth: '100%',
          maxHeight: '100%',
          borderRadius: device === 'pc' ? 0 : device === 'tablet' ? '18px' : '28px',
          border: device === 'pc' ? 'none' : '6px solid #1e293b',
          boxShadow: device === 'pc' ? 'none' : '0 25px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          backgroundColor: '#fff',
          transition: 'width 0.2s ease, height 0.2s ease'
        }}>
          <iframe
            key={`${runKey}-${device}-${landscape}-${project.updatedAt || 0}`}
            srcDoc={compiledSrc}
            title={project.name}
            sandbox={ENV.IFRAME_SANDBOX_FLAGS}
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
  );
};
