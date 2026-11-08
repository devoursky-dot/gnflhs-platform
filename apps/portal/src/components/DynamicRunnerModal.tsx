import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { isSuperAdmin } from '@gnflhs/shared-auth';
import { AppPlugin, DeviceViewportType } from '@gnflhs/shared-types';
import { ENV } from '../config/env';
import { attachRuntimeRpcBridge } from '../services/studioService';
import { compileStudioBundle } from '../services/studioCompiler';
import { ArrowLeft, Monitor, Tablet, Smartphone, RefreshCw } from 'lucide-react';

interface DynamicRunnerModalProps {
  plugin: AppPlugin | null;
  onClose: () => void;
  currentUser?: User | null;
  globalProperties?: Record<string, string>;
}

export const DynamicRunnerModal: React.FC<DynamicRunnerModalProps> = ({
  plugin,
  onClose,
  currentUser = null,
  globalProperties = {}
}) => {
  const [deviceOverride, setDeviceOverride] = useState<'auto' | DeviceViewportType>('auto');
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    if (!plugin) return;
    const detach = attachRuntimeRpcBridge();
    return () => detach();
  }, [plugin?.id]);

  const runtimeSrcDoc = useMemo(() => {
    if (!plugin) return '';
    if (plugin.files && plugin.files.length > 0) {
      return compileStudioBundle({
        projectId: plugin.id,
        projectName: plugin.name,
        files: plugin.files,
        scriptProperties: plugin.scriptProperties || {},
        globalProperties,
        libraries: plugin.libraries,
        runtimeConfig: plugin.runtimeConfig,
        forcedDevice: deviceOverride,
        currentUser: currentUser
          ? {
              email: currentUser.email,
              displayName: currentUser.displayName,
              isSuperAdmin: isSuperAdmin(currentUser)
            }
          : null
      });
    }
    return plugin.customCode || '';
  }, [plugin, deviceOverride, currentUser, globalProperties, reloadKey]);

  if (!plugin || plugin.codeType !== 'inline_html' || (!plugin.customCode && !plugin.files?.length)) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#020617',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        height: '44px',
        backgroundColor: '#090d16',
        color: '#fff',
        padding: '0 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onClose}
            title="포털 홈으로 돌아가기"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '7px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <ArrowLeft size={14} /> 포털
          </button>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{plugin.name}</span>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>v{plugin.version}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', backgroundColor: '#1e293b', padding: '2px', borderRadius: '7px', border: '1px solid #334155' }}>
            <button
              onClick={() => setDeviceOverride('auto')}
              title="자동 반응형"
              style={{ border: 'none', background: deviceOverride === 'auto' ? '#2563eb' : 'transparent', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '5px', cursor: 'pointer' }}
            >
              AUTO
            </button>
            <button
              onClick={() => setDeviceOverride('pc')}
              title="PC 뷰"
              style={{ border: 'none', background: deviceOverride === 'pc' ? '#2563eb' : 'transparent', color: '#cbd5e1', padding: '4px 7px', borderRadius: '5px', cursor: 'pointer', display: 'flex' }}
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => setDeviceOverride('tablet')}
              title="태블릿 뷰"
              style={{ border: 'none', background: deviceOverride === 'tablet' ? '#2563eb' : 'transparent', color: '#cbd5e1', padding: '4px 7px', borderRadius: '5px', cursor: 'pointer', display: 'flex' }}
            >
              <Tablet size={14} />
            </button>
            <button
              onClick={() => setDeviceOverride('mobile')}
              title="스마트폰 뷰"
              style={{ border: 'none', background: deviceOverride === 'mobile' ? '#2563eb' : 'transparent', color: '#cbd5e1', padding: '4px 7px', borderRadius: '5px', cursor: 'pointer', display: 'flex' }}
            >
              <Smartphone size={14} />
            </button>
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            title="다시 로드"
            style={{ border: '1px solid #334155', backgroundColor: '#1e293b', color: '#cbd5e1', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', display: 'flex' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: deviceOverride === 'auto' || deviceOverride === 'pc' ? 0 : '14px',
        overflow: 'auto'
      }}>
        <div style={{
          width:
            deviceOverride === 'tablet'
              ? `${ENV.VIEWPORTS.tablet.width}px`
              : deviceOverride === 'mobile'
              ? `${ENV.VIEWPORTS.mobile.width}px`
              : '100%',
          height:
            deviceOverride === 'tablet' || deviceOverride === 'mobile'
              ? '94%'
              : '100%',
          maxWidth: '100%',
          borderRadius: deviceOverride === 'auto' || deviceOverride === 'pc' ? 0 : '16px',
          border: deviceOverride === 'auto' || deviceOverride === 'pc' ? 'none' : '4px solid #1e293b',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}>
          <iframe
            key={`${reloadKey}-${deviceOverride}`}
            srcDoc={runtimeSrcDoc}
            title={plugin.name}
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
