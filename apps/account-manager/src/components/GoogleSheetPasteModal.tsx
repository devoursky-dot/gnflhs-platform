import React, { useState } from 'react';
import { parseGoogleSheetText, batchImportUsers } from '../services/accountService';
import { UserAccount } from '../../../../packages/shared-types/src/index';
import { ClipboardPaste, CheckCircle2, AlertTriangle, X, Upload } from 'lucide-react';

interface GoogleSheetPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const GoogleSheetPasteModal: React.FC<GoogleSheetPasteModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState<UserAccount[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setParsedRows([]);
      setParseErrors([]);
      return;
    }
    const { parsed, parseErrors } = parseGoogleSheetText(text);
    setParsedRows(parsed);
    setParseErrors(parseErrors);
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    try {
      const res = await batchImportUsers(parsedRows);
      alert(`총 ${res.successCount}명의 계정이 성공적으로 등록되었습니다!`);
      setPastedText('');
      setParsedRows([]);
      onImportComplete();
      onClose();
    } catch (err) {
      console.error(err);
      alert('일괄 저장 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
        maxWidth: '750px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardPaste size={24} color="#2563eb" />
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>구글 시트에서 복사하여 대량 붙여넣기</h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        {/* 사용 안내 가이드 */}
        <div style={{ backgroundColor: '#f0f9ff', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#0369a1' }}>
          💡 <strong>구글 시트 열 순서 가이드</strong>: <br />
          <code>[구분(교사/학생)] | [학번/교번] | [이름] | [이메일] | [소속그룹(반)] | [기숙사호실(선택)]</code><br />
          구글 스프레드시트에서 영역을 복사(Ctrl+C)한 뒤 아래 상자에 바로 붙여넣기(Ctrl+V)하세요.
        </div>

        {/* 붙여넣기 텍스트 상자 */}
        <textarea
          rows={6}
          value={pastedText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`예시 (구글 시트에서 복사한 그대로 붙여넣기):\n교사\tT202601\t김선생\tkim@gnflhs.hs.kr\t교무실\n학생\t10101\t홍길동\thong@gnflhs.hs.kr\t1학년 1반\t301호\n학생\t10102\t이몽룡\tlee@gnflhs.hs.kr\t1학년 1반\t302호`}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '13px',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />

        {/* 에러 메시지 표시 */}
        {parseErrors.length > 0 && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
              <AlertTriangle size={16} /> 파싱 주의사항 ({parseErrors.length}건)
            </div>
            {parseErrors.slice(0, 3).map((err, idx) => (
              <p key={idx} style={{ fontSize: '12px', color: '#92400e', margin: '2px 0' }}>• {err}</p>
            ))}
          </div>
        )}

        {/* 파싱 미리보기 표 */}
        {parsedRows.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>
              <CheckCircle2 size={16} /> 인식된 계정 목록: 총 {parsedRows.length}명
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '8px' }}>구분</th>
                    <th style={{ padding: '8px' }}>학번/교번</th>
                    <th style={{ padding: '8px' }}>이름</th>
                    <th style={{ padding: '8px' }}>소속그룹</th>
                    <th style={{ padding: '8px' }}>기숙사</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}>{u.role === 'teacher' ? '교사' : '학생'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{u.id}</td>
                      <td style={{ padding: '6px 8px' }}>{u.name}</td>
                      <td style={{ padding: '6px 8px' }}>{u.groupName}</td>
                      <td style={{ padding: '6px 8px' }}>{u.dormitoryRoom || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 20 && (
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>외 {parsedRows.length - 20}명의 데이터가 더 있습니다.</p>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            취소
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedRows.length === 0 || isUploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: parsedRows.length === 0 || isUploading ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: parsedRows.length === 0 || isUploading ? 'not-allowed' : 'pointer'
            }}
          >
            <Upload size={16} />
            {isUploading ? '저장 중...' : `Firestore에 ${parsedRows.length}명 일괄 등록`}
          </button>
        </div>
      </div>
    </div>
  );
};
