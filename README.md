# GNFLHS 스마트 스쿨 모듈러 플랫폼 (Firebase Multi-App Hub)

구형 전자칠판 최적화 필기 노트, 구글 시트 연동 통합 계정관리, 기숙사 벌점 관리를 플러그인 형태로 장착/해제 및 무중단 업그레이드할 수 있는 풀스택 플랫폼입니다.

---

## 🏗️ 시스템 아키텍처

```text
gnflhs-platform/
├── firebase.json                   # 파이어베이스 멀티 패스 및 배포 설정
├── firestore.rules                 # 최고관리자(devoursky@gmail.com) 전용 보안 규칙
├── .env                            # 환경변수 중앙 관리 (하드코딩 방지)
│
├── apps/
│   ├── portal/                     # [메인 허브] 플러그인 레지스트리 & 앱 런처
│   ├── whiteboard-note/            # [전자칠판] 삼성노트 REA 필압/손떨림 보정 초경량 판서
│   ├── account-manager/            # [계정관리] 최고관리자 전용 구글 시트 대량 복붙 관리
│   └── dormitory-penalty/          # [기숙사] 학생 상·벌점 부여 및 기록 관리
│
└── packages/
    ├── shared-types/               # 공통 데이터 규격 (User, Plugin, Stroke 등)
    └── shared-auth/                # 공통 Firebase Auth & 권한 제어
```

---

## 🚀 빠른 시작 (로컬 개발)

### 1. 패키지 설치
```bash
npm install
```

### 2. 개별 모듈 실행
* **메인 포털**: `npm run dev:portal` (http://localhost:3000)
* **전자칠판 필기앱**: `npm run dev:whiteboard` (http://localhost:3001)
* **계정관리 센터**: `npm run dev:account` (http://localhost:3002)
* **기숙사 벌점 관리**: `npm run dev:dormitory` (http://localhost:3003)

---

## 🔒 보안 정책 및 권한 체계
* **최고 관리자(Super Admin)**: `devoursky@gmail.com`
  * 플러그인 등록, 활성화/비활성화, 개발/운영 상태 전환 권한
  * 계정관리 센터 전체 접근 및 일괄 등록 권한
* **보안 규칙(Firestore Rules)**:
  * 비인가 사용자의 계정 및 플러그인 수정 원천 차단.

---

## 📱 2023년식 구형 전자칠판 최적화 기술 (Whiteboard Note)
1. **Double Buffering Canvas**:
   * 이전에 작성된 선들은 비트맵 캐시 레이어에 고정되고, 현재 그리고 있는 1개의 선만 렌더링하여 구형 안드로이드 CPU 부하 제로.
2. **삼성노트 역추적 필기 알고리즘**:
   * **Stabilizer**: Exponential Moving Average로 저가형 터치패널의 지그재그 떨림 보정.
   * **Pressure Engine**: 하드웨어 필압 + 속도 역산 가변 선두께 모델.
   * **Vector Path**: 2차 베지에 곡선(Quadratic Bézier Spline)으로 부드러운 고해상도 벡터화.
