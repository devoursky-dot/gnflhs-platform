import React, { useState, useEffect } from 'react';
import { listStoragePath, uploadFileToStorage, deleteFileFromStorage, StorageFileItem } from '../services/storageService';
import { STORAGE_ROOT_FOLDERS } from '../config/env';
import { HardDrive, Folder, File, Image, FileText, Upload, Trash2, Download, RefreshCw, X, ChevronRight, FolderPlus } from 'lucide-react';

interface StorageExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOT_FOLDERS = STORAGE_ROOT_FOLDERS;

export const StorageExplorerModal: React.FC<StorageExplorerModalProps> = ({ isOpen, onClose }) => {
  const [currentPath, setCurrentPath] = useState<string>('shared');
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadFiles = async (targetPath: string) => {
    setLoading(true);
    const res = await listStoragePath(targetPath);
    setFolders(res.folders);
    setFiles(res.files);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles(currentPath);
    }
  }, [isOpen, currentPath]);

  if (!isOpen) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const uploadPath = `${currentPath}/${file.name}`;
    setLoading(true);
    try {
      await uploadFileToStorage(uploadPath, file);
      await loadFiles(currentPath);
    } catch (err: any) {
      alert('업로드 실패: ' + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fullPath: string, name: string) => {
    if (!confirm(`'${name}' 파일을 삭제하시겠습니까?`)) return;
    setLoading(true);
    try {
      await deleteFileFromStorage(fullPath);
      await loadFiles(currentPath);
    } catch (err: any) {
      alert('삭제 실패: ' + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext || '')) {
      return <Image size={20} color="#0284c7" />;
    }
    if (['pdf', 'txt', 'doc', 'docx'].includes(ext || '')) {
      return <FileText size={20} color="#dc2626" />;
    }
    return <File size={20} color="#64748b" />;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        backgroundColor: '#fff',
        width: '880px',
        height: '620px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* 상단 미니멀 헤더 */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={20} color="#38bdf8" />
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>클라우드 스토리지 매니저</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>|</span>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>/{currentPath}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label
              title="파일 업로드"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#2563eb',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Upload size={15} />
              <span>업로드</span>
              <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
            </label>

            <button
              onClick={() => loadFiles(currentPath)}
              title="새로고침"
              style={{
                border: 'none',
                background: '#1e293b',
                color: '#cbd5e1',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <RefreshCw size={16} />
            </button>

            <button
              onClick={onClose}
              title="닫기"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 바디: 좌측 폴더 트리 + 우측 파일 뷰어 */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* 1. 좌측 폴더 사이드바 */}
          <div style={{
            width: '210px',
            borderRight: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {ROOT_FOLDERS.map((f) => {
              const active = currentPath.startsWith(f.path);
              return (
                <button
                  key={f.id}
                  onClick={() => setCurrentPath(f.path)}
                  title={`폴더: /${f.path}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: active ? '#e0f2fe' : 'transparent',
                    color: active ? '#0369a1' : '#475569',
                    fontWeight: active ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Folder size={17} color={active ? '#0284c7' : '#94a3b8'} />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* 2. 우측 파일 목록 테이블 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '8px' }}>
                <RefreshCw size={18} className="animate-spin" />
              </div>
            ) : files.length === 0 && folders.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '10px' }}>
                <Folder size={44} strokeWidth={1.5} color="#cbd5e1" />
                <span style={{ fontSize: '13px' }}>보관된 파일이 없습니다</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* 하위 폴더 */}
                {folders.map((folderName) => (
                  <div
                    key={folderName}
                    onClick={() => setCurrentPath(`${currentPath}/${folderName}`)}
                    title={`하위 폴더 열기: ${folderName}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '1px solid #f1f5f9',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <Folder size={18} color="#eab308" />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', flex: 1 }}>{folderName}</span>
                    <ChevronRight size={16} color="#94a3b8" />
                  </div>
                ))}

                {/* 파일 행 */}
                {files.map((file) => (
                  <div
                    key={file.fullPath}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      {getFileIcon(file.name)}
                      <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                        {file.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {formatSize(file.size)}
                      </span>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {file.downloadUrl && (
                          <a
                            href={file.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={file.name}
                            title="다운로드"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              color: '#0284c7',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Download size={16} />
                          </a>
                        )}

                        <button
                          onClick={() => handleDelete(file.fullPath, file.name)}
                          title="삭제"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
