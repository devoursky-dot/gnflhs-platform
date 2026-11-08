// 기숙사 상·벌점 초기 시드 데이터 모듈 (ES Module 분리 예제)
export const INITIAL_SAMPLE_RECORDS = [
  {
    id: 'rec-1',
    studentId: '10101',
    studentName: '홍길동',
    room: '301호',
    points: 2,
    reason: '점호 시간 지각 (10분)',
    supervisorName: '사감교사',
    date: '2026-11-07',
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'rec-2',
    studentId: '10204',
    studentName: '이몽룡',
    room: '305호',
    points: -2,
    reason: '기숙사 분리수거 및 호실 정리정돈 우수 표창',
    supervisorName: '사감교사',
    date: '2026-11-06',
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'rec-3',
    studentId: '20110',
    studentName: '성춘향',
    room: '402호',
    points: 3,
    reason: '취침 소등 이후 전자기기 무단 사용',
    supervisorName: '야간사감',
    date: '2026-11-05',
    createdAt: Date.now() - 86400000 * 4
  },
  {
    id: 'rec-4',
    studentId: '10312',
    studentName: '박지훈',
    room: '204호',
    points: -1,
    reason: '자습실 환경 미화 봉사활동 참여',
    supervisorName: '사감교사',
    date: '2026-11-08',
    createdAt: Date.now() - 3600000
  }
];
