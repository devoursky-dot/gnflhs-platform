import { collection, doc, getDocs, writeBatch, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@gnflhs/shared-auth';
import { FIRESTORE_COLLECTIONS, PLATFORM_ENV, UserAccount, UserRole } from '@gnflhs/shared-types';

const USERS_COLLECTION = FIRESTORE_COLLECTIONS.USERS;

export async function fetchAllUsers(): Promise<UserAccount[]> {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('groupName'), orderBy('name'));
    const snapshot = await getDocs(q);
    const users: UserAccount[] = [];
    snapshot.forEach((d) => {
      users.push(d.data() as UserAccount);
    });
    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
}

export async function saveUser(user: UserAccount): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, user.id);
  await setDoc(userRef, {
    ...user,
    updatedAt: Date.now()
  }, { merge: true });
}

export async function deleteUser(userId: string): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await deleteDoc(userRef);
}

/**
 * 구글 시트에서 복사한 대량 데이터를 Firestore에 일괄 배치(Batch) 커밋
 */
export async function batchImportUsers(users: UserAccount[]): Promise<{ successCount: number; errors: string[] }> {
  const batch = writeBatch(db);
  const errors: string[] = [];
  let count = 0;

  for (const user of users) {
    if (!user.id || !user.name) {
      errors.push(`필수 정보 누락: ${JSON.stringify(user)}`);
      continue;
    }
    const userRef = doc(db, USERS_COLLECTION, user.id);
    batch.set(userRef, {
      ...user,
      createdAt: user.createdAt || Date.now(),
      updatedAt: Date.now()
    }, { merge: true });
    count++;
  }

  await batch.commit();
  return { successCount: count, errors };
}

/**
 * 구글 스프레드시트에서 복사(Ctrl+C)한 텍스트(TSV)를 파싱하는 함수
 * 컬럼 규격: [구분, 학번/교번, 이름, 이메일, 소속그룹, 기숙사호실(선택)]
 */
export function parseGoogleSheetText(rawText: string): { parsed: UserAccount[]; parseErrors: string[] } {
  const lines = rawText.trim().split(/\r?\n/);
  const parsed: UserAccount[] = [];
  const parseErrors: string[] = [];

  lines.forEach((line, index) => {
    if (!line.trim()) return;

    // 탭(\t) 또는 쉼표(,) 구분자 지원
    const cols = line.includes('\t') ? line.split('\t') : line.split(',');
    const cleanCols = cols.map(c => c.trim().replace(/^["']|["']$/g, ''));

    // 헤더 행 건너뛰기 (예: "구분", "이름", "학번" 등이 포함된 경우)
    if (index === 0 && (cleanCols.includes('구분') || cleanCols.includes('이름') || cleanCols.includes('학번'))) {
      return;
    }

    if (cleanCols.length < 3) {
      parseErrors.push(`${index + 1}번째 줄: 컬럼 수가 부족합니다 (${line})`);
      return;
    }

    const rawRole = cleanCols[0].toLowerCase();
    const id = cleanCols[1];
    const name = cleanCols[2];
    const email = cleanCols[3] || `${id}@${PLATFORM_ENV.SCHOOL_EMAIL_DOMAIN}`;
    const groupName = cleanCols[4] || (rawRole.includes('교사') ? '교직원' : '학생');
    const dormitoryRoom = cleanCols[5] || '';

    let role: UserRole = 'student';
    if (rawRole.includes('관리자') || rawRole.includes('admin')) {
      role = 'admin';
    } else if (rawRole.includes('교사') || rawRole.includes('선생') || rawRole.includes('teacher')) {
      role = 'teacher';
    }

    parsed.push({
      id,
      name,
      email,
      role,
      groupName,
      dormitoryRoom,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });

  return { parsed, parseErrors };
}
