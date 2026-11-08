import React, { useState } from 'react';
import { Home, ShieldAlert, Award, Plus, Calendar, User, Search, CheckCircle2 } from 'lucide-react';
import { DormitoryPenaltyRecord } from '@gnflhs/shared-types';

const SAMPLE_RECORDS: DormitoryPenaltyRecord[] = [
  { id: '1', studentId: '10101', studentName: '홍길동', room: '301호', points: 2, reason: '점호 시간 지각 (10분)', supervisorName: '사감교사', date: '2026-11-07', createdAt: Date.now() },
  { id: '2', studentId: '10204', studentName: '이몽룡', room: '305호', points: -1, reason: '기숙사 분리수거 우수 호실 표창', supervisorName: '사감교사', date: '2026-11-06', createdAt: Date.now() },
  { id: '3', studentId: '20110', studentName: '성춘향', room: '402호', points: 3, reason: '취침 후 전자기기 무단 사용', supervisorName: '야간사감', date: '2026-11-05', createdAt: Date.now() }
];

export default function App() {
  const [records, setRecords] = useState<DormitoryPenaltyRecord[]>(SAMPLE_RECORDS);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // 신규 등록 폼 상태
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [room, setRoom] = useState('');
  const [points, setPoints] = useState<number>(1);
  const [reason, setReason] = useState('');

  const filtered = records.filter(r =>
    r.studentName.includes(search) ||
    r.studentId.includes(search) ||
    r.room.includes(search) ||
    r.reason.includes(search)
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !studentName) return;

    const newRec: DormitoryPenaltyRecord = {
      id: Date.now().toString(),
      studentId,
      studentName,
      room,
      points,
      reason,
      supervisorName: '사감교사',
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    };

    setRecords([newRec, ...records]);
    setIsAddOpen(false);
    setStudentId('');
    setStudentName('');
    setRoom('');
    setReason('');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <header style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/" title="메인 포털로 가기" style={{ color: '#475569', display: 'flex', alignItems: 'center' }}>
            <Home size={22} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={24} color="#dc2626" />
            <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>기숙사 상·벌점 관리 시스템</h1>
          </div>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#dc2626',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          <Plus size={18} />
          상·벌점 부여하기
        </button>
      </header>

      <main style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* 검색창 */}
        <div style={{
          backgroundColor: '#fff',
          padding: '14px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="학생 이름, 학번, 호실 또는 사유로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
          />
        </div>

        {/* 상벌점 기록 테이블 */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>일자</th>
                <th style={{ padding: '12px 16px' }}>호실</th>
                <th style={{ padding: '12px 16px' }}>학번</th>
                <th style={{ padding: '12px 16px' }}>이름</th>
                <th style={{ padding: '12px 16px' }}>구분 / 점수</th>
                <th style={{ padding: '12px 16px' }}>사유</th>
                <th style={{ padding: '12px 16px' }}>담당자</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{r.room}</td>
                  <td style={{ padding: '12px 16px' }}>{r.studentId}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{r.studentName}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: r.points > 0 ? '#fee2e2' : '#ecfdf5',
                      color: r.points > 0 ? '#b91c1c' : '#047857'
                    }}>
                      {r.points > 0 ? `벌점 +${r.points}` : `상점 ${r.points}`}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{r.reason}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{r.supervisorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* 등록 모달 */}
      {isAddOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleAdd} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', width: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>신규 상·벌점 부여</h3>
            <input placeholder="학번 (예: 10101)" value={studentId} onChange={e => setStudentId(e.target.value)} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <input placeholder="학생 이름" value={studentName} onChange={e => setStudentName(e.target.value)} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <input placeholder="호실 (예: 301호)" value={room} onChange={e => setRoom(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <div>
              <label style={{ fontSize: '13px', color: '#64748b' }}>점수 선택:</label>
              <select value={points} onChange={e => setPoints(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                <option value={1}>벌점 1점</option>
                <option value={2}>벌점 2점</option>
                <option value={3}>벌점 3점</option>
                <option value={5}>벌점 5점 (중대 위반)</option>
                <option value={-1}>상점 1점</option>
                <option value={-2}>상점 2점</option>
              </select>
            </div>
            <textarea placeholder="사유를 입력하세요" rows={3} value={reason} onChange={e => setReason(e.target.value)} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" onClick={() => setIsAddOpen(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#f1f5f9', cursor: 'pointer' }}>취소</button>
              <button type="submit" style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
