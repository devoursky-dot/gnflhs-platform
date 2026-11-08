import React, { useState, useEffect } from 'react';
import { SuperAdminGuard } from './components/SuperAdminGuard';
import { GoogleSheetPasteModal } from './components/GoogleSheetPasteModal';
import { fetchAllUsers, deleteUser } from './services/accountService';
import { UserAccount } from '@gnflhs/shared-types';
import { Users, ClipboardPaste, Search, Trash2, Home, Filter, ShieldCheck, GraduationCap, School } from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 고유 그룹 목록 추출
  const groupList = Array.from(new Set(users.map(u => u.groupName).filter(Boolean)));

  // 필터링된 유저 목록
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = selectedGroup === 'all' || u.groupName === selectedGroup;
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    return matchesSearch && matchesGroup && matchesRole;
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`'${name}' (${id}) 계정을 정말 삭제하시겠습니까?`)) {
      await deleteUser(id);
      loadData();
    }
  };

  return (
    <SuperAdminGuard>
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#1e293b' }}>
        {/* 상단 네비게이션 */}
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
              <Users size={24} color="#2563eb" />
              <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>학교 통합 계정관리 센터</h1>
              <span style={{ fontSize: '12px', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                최고관리자 모드
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsPasteModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#059669',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)'
            }}
          >
            <ClipboardPaste size={18} />
            구글 시트에서 복사/붙여넣기
          </button>
        </header>

        {/* 본문 영역 */}
        <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* 상단 통계 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '10px' }}><Users size={24} color="#2563eb" /></div>
              <div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>전체 등록 계정</p>
                <h3 style={{ fontSize: '22px', fontWeight: 'bold' }}>{users.length}명</h3>
              </div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '10px' }}><School size={24} color="#d97706" /></div>
              <div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>교직원 계정</p>
                <h3 style={{ fontSize: '22px', fontWeight: 'bold' }}>{users.filter(u => u.role === 'teacher' || u.role === 'admin').length}명</h3>
              </div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '10px' }}><GraduationCap size={24} color="#059669" /></div>
              <div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>재학생 계정</p>
                <h3 style={{ fontSize: '22px', fontWeight: 'bold' }}>{users.filter(u => u.role === 'student').length}명</h3>
              </div>
            </div>
          </div>

          {/* 검색 및 필터 바 */}
          <div style={{
            backgroundColor: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="이름, 학번, 이메일로 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {/* 그룹별 필터 */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="all">모든 소속 그룹</option>
                {groupList.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* 역할별 필터 */}
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="all">모든 역할</option>
                <option value="teacher">교사</option>
                <option value="student">학생</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>

          {/* 계정 테이블 */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>계정 목록을 불러오는 중...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                등록된 계정이 없습니다. 상단의 [구글 시트에서 복사/붙여넣기] 버튼을 눌러 계정을 등록하세요!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>구분</th>
                    <th style={{ padding: '12px 16px' }}>학번 / 교번</th>
                    <th style={{ padding: '12px 16px' }}>이름</th>
                    <th style={{ padding: '12px 16px' }}>이메일</th>
                    <th style={{ padding: '12px 16px' }}>소속 그룹(반)</th>
                    <th style={{ padding: '12px 16px' }}>기숙사 호실</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          backgroundColor: u.role === 'teacher' ? '#fef3c7' : u.role === 'admin' ? '#fee2e2' : '#ecfdf5',
                          color: u.role === 'teacher' ? '#b45309' : u.role === 'admin' ? '#b91c1c' : '#047857'
                        }}>
                          {u.role === 'teacher' ? '교사' : u.role === 'admin' ? '관리자' : '학생'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{u.id}</td>
                      <td style={{ padding: '12px 16px' }}>{u.name}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>{u.groupName}</td>
                      <td style={{ padding: '12px 16px' }}>{u.dormitoryRoom || '-'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* 구글 시트 복사붙여넣기 모달 */}
        <GoogleSheetPasteModal
          isOpen={isPasteModalOpen}
          onClose={() => setIsPasteModalOpen(false)}
          onImportComplete={loadData}
        />
      </div>
    </SuperAdminGuard>
  );
}
