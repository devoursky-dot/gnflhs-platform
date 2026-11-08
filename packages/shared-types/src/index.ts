// GNFLHS 공통 타입 정의 (모듈 간 데이터 규격 통일)

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student';

export interface UserAccount {
  id: string; // 고유 ID (학번 또는 교번)
  name: string; // 이름
  email: string; // 구글 이메일 또는 학교 계정
  role: UserRole; // 역할
  groupName: string; // 소속 그룹 (예: 1학년 2반, 3학년 기숙사, 교무기획부)
  dormitoryRoom?: string; // 기숙사 호실 (예: 302호)
  createdAt: number;
  updatedAt: number;
}

export type PluginStatus = 'production' | 'development' | 'disabled';

export interface VirtualFile {
  name: string; // 예: index.html, script.js, style.css
  content: string;
}

export interface PluginDeployment {
  version: string;
  deployedAt: number;
  note?: string;
  files: VirtualFile[];
}

export interface AppPlugin {
  id: string; // 고유 식별자 (whiteboard, account-manager, dormitory)
  name: string; // 표시 이름
  description: string; // 앱 설명
  icon: string; // Lucide 아이콘 명칭
  category: 'classroom' | 'management' | 'utility';
  version: string;
  status: PluginStatus; // 🟢 운영중 / 🟡 개발테스트중 / ⚪ 비활성화
  entryUrl: string; // 실행 URL
  allowedRoles: UserRole[]; // 실행 권한
  codeType?: 'url' | 'inline_html'; // 'url': 정적 빌드 배포본, 'inline_html': 플랫폼 내 직접 입력한 핫스왑 코드
  customCode?: string; // 실시간 핫스왑 소스코드 (HTML/JS/CSS 통합)
  files?: VirtualFile[]; // 멀티 파일 시스템
  deployments?: PluginDeployment[]; // 버전 스냅샷 히스토리
  updatedAt: number;
}

export interface WhiteboardPoint {
  x: number;
  y: number;
  pressure?: number; // 0.0 ~ 1.0 (삼성노트 필압)
  timestamp: number;
}

export interface VectorStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  baseWidth: number;
  points: WhiteboardPoint[];
  svgPath: string; // 사후 계산된 부드러운 SVG 벡터 패스
  createdAt: number;
}

export interface DormitoryPenaltyRecord {
  id: string;
  studentId: string;
  studentName: string;
  room: string;
  points: number; // 벌점 (양수) 또는 상점 (음수)
  reason: string;
  supervisorName: string;
  date: string;
  createdAt: number;
}
