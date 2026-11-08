import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit as firestoreLimit,
  where as firestoreWhere,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from '@gnflhs/shared-auth';
import { FIRESTORE_COLLECTIONS } from '@gnflhs/shared-types';

export interface DatabaseRowItem {
  _id: string;
  [key: string]: any;
}

export interface CollectionMeta {
  name: string;
  count?: number;
  isSystem?: boolean;
}

const KNOWN_COLLECTIONS: readonly CollectionMeta[] = FIRESTORE_COLLECTIONS.KNOWN_COLLECTIONS;
const COLLECTIONS_REGISTRY_COL = FIRESTORE_COLLECTIONS.PLATFORM_SETTINGS;
const COLLECTIONS_REGISTRY_DOC = FIRESTORE_COLLECTIONS.CUSTOM_COLLECTIONS_DOC;

/**
 * 활성 데이터베이스 컬렉션 목록 조회 (시스템 기본 + 사용자 정의)
 */
export async function listActiveCollections(): Promise<CollectionMeta[]> {
  const result: Map<string, CollectionMeta> = new Map();
  KNOWN_COLLECTIONS.forEach((c) => result.set(c.name, { ...c }));

  try {
    const regDoc = await getDoc(doc(db, COLLECTIONS_REGISTRY_COL, COLLECTIONS_REGISTRY_DOC));
    if (regDoc.exists()) {
      const customs = (regDoc.data()?.list || []) as string[];
      customs.forEach((name) => {
        if (!result.has(name)) {
          result.set(name, { name, isSystem: false });
        }
      });
    }
  } catch (e) {
    console.warn('Failed to fetch custom collections registry:', e);
  }

  return Array.from(result.values());
}

/**
 * 새 커스텀 컬렉션 등록
 */
export async function registerCustomCollection(name: string): Promise<void> {
  const cleanName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleanName) return;

  try {
    const regRef = doc(db, COLLECTIONS_REGISTRY_COL, COLLECTIONS_REGISTRY_DOC);
    const snap = await getDoc(regRef);
    const list: string[] = snap.exists() ? (snap.data()?.list || []) : [];
    if (!list.includes(cleanName)) {
      list.push(cleanName);
      await setDoc(regRef, { list, updatedAt: Date.now() }, { merge: true });
    }
  } catch (e) {
    console.warn('Failed to register collection:', e);
  }
}

/**
 * 실시간 특정 컬렉션 문서 목록 구독 (onSnapshot)
 */
export function subscribeCollection(
  collectionName: string,
  callback: (rows: DatabaseRowItem[]) => void,
  maxLimit: number = 100
): () => void {
  try {
    const colRef = collection(db, collectionName);
    const q = query(colRef, firestoreLimit(maxLimit));
    return onSnapshot(
      q,
      (snap) => {
        const rows: DatabaseRowItem[] = [];
        snap.forEach((d) => {
          rows.push({
            _id: d.id,
            ...d.data()
          });
        });
        callback(rows);
      },
      (err) => {
        console.warn(`Error subscribing to ${collectionName}:`, err);
        callback([]);
      }
    );
  } catch (e) {
    console.warn(`Failed to listen to ${collectionName}:`, e);
    callback([]);
    return () => {};
  }
}

/**
 * 행(문서) 직접 추가/수정
 */
export async function upsertRow(
  collectionName: string,
  docId: string | null,
  data: Record<string, any>
): Promise<string> {
  const id = docId ? docId.trim() : `doc_${Date.now().toString(36)}`;
  const cleanData = { ...data };
  delete cleanData._id;

  await setDoc(doc(db, collectionName, id), cleanData, { merge: true });
  await registerCustomCollection(collectionName);
  return id;
}

/**
 * 행(문서) 삭제
 */
export async function deleteRow(collectionName: string, docId: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, docId));
}

export interface QueryExecutionResult {
  success: boolean;
  message: string;
  affectedRows?: number;
  data?: DatabaseRowItem[];
  executionTimeMs: number;
}

/**
 * 초고속 SQL-like & JSON 쿼리 파서 및 실행기
 * 지원 문법:
 * - SELECT * FROM <col> [WHERE <field> = <val>] [LIMIT <n>]
 * - INSERT INTO <col> { ...json... }
 * - UPDATE <col> SET <field> = <val> WHERE id = <docId>
 * - DELETE FROM <col> WHERE id = <docId>
 * - CREATE COLLECTION <col>
 * - DROP COLLECTION <col>
 */
export async function executeDatabaseQuery(queryText: string): Promise<QueryExecutionResult> {
  const start = performance.now();
  const trimmed = queryText.trim();

  if (!trimmed) {
    return {
      success: false,
      message: '쿼리를 입력해주세요.',
      executionTimeMs: 0
    };
  }

  try {
    // 1. SELECT 문 파싱
    const selectMatch = trimmed.match(/^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_-]+)(?:\s+WHERE\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (selectMatch) {
      const [, fieldsPart, colName, wherePart, limitPart] = selectMatch;
      const colRef = collection(db, colName);
      const limitVal = limitPart ? parseInt(limitPart, 10) : 100;

      let q = query(colRef, firestoreLimit(limitVal));

      if (wherePart) {
        const condMatch = wherePart.match(/([a-zA-Z0-9_]+)\s*(=|==|!=|>|<|>=|<=)\s*(.+)/);
        if (condMatch) {
          const [, field, op, rawVal] = condMatch;
          let cleanVal: any = rawVal.trim().replace(/^['"]|['"]$/g, '');
          if (!isNaN(Number(cleanVal))) cleanVal = Number(cleanVal);
          else if (cleanVal === 'true') cleanVal = true;
          else if (cleanVal === 'false') cleanVal = false;

          let fireOp: WhereFilterOp = '==';
          if (op === '!=') fireOp = '!=';
          else if (op === '>') fireOp = '>';
          else if (op === '<') fireOp = '<';
          else if (op === '>=') fireOp = '>=';
          else if (op === '<=') fireOp = '<=';

          q = query(colRef, firestoreWhere(field, fireOp, cleanVal), firestoreLimit(limitVal));
        }
      }

      const snap = await getDocs(q);
      const rows: DatabaseRowItem[] = [];
      snap.forEach((d) => {
        rows.push({ _id: d.id, ...d.data() });
      });

      const elapsed = Math.round(performance.now() - start);
      return {
        success: true,
        message: `조회 성공: ${rows.length}개 행 (${elapsed}ms)`,
        data: rows,
        affectedRows: rows.length,
        executionTimeMs: elapsed
      };
    }

    // 2. INSERT INTO <col> { ... }
    const insertJsonMatch = trimmed.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_-]+)\s+(\{[\s\S]*\})$/i);
    if (insertJsonMatch) {
      const [, colName, jsonStr] = insertJsonMatch;
      let parsedData: any;
      try {
        // Relaxed JSON parsing
        parsedData = Function(`"use strict"; return (${jsonStr})`)();
      } catch (err: any) {
        throw new Error(`JSON 구문 오류: ${err.message}`);
      }

      const docId = parsedData._id || parsedData.id || `doc_${Date.now().toString(36)}`;
      await upsertRow(colName, docId, parsedData);

      const elapsed = Math.round(performance.now() - start);
      return {
        success: true,
        message: `삽입 완료: '${colName}/${docId}' (${elapsed}ms)`,
        affectedRows: 1,
        executionTimeMs: elapsed
      };
    }

    // 3. UPDATE <col> SET <field> = <val> WHERE id = <docId>
    const updateMatch = trimmed.match(/^UPDATE\s+([a-zA-Z0-9_-]+)\s+SET\s+(.+?)\s+WHERE\s+(?:id|_id)\s*=\s*['"]?([a-zA-Z0-9_-]+)['"]?$/i);
    if (updateMatch) {
      const [, colName, setPart, docId] = updateMatch;
      const updates: Record<string, any> = {};

      const pairs = setPart.split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split('=').map((s) => s.trim());
        if (k && v !== undefined) {
          let cleanVal: any = v.replace(/^['"]|['"]$/g, '');
          if (!isNaN(Number(cleanVal))) cleanVal = Number(cleanVal);
          else if (cleanVal === 'true') cleanVal = true;
          else if (cleanVal === 'false') cleanVal = false;
          updates[k] = cleanVal;
        }
      }

      await setDoc(doc(db, colName, docId), updates, { merge: true });
      const elapsed = Math.round(performance.now() - start);
      return {
        success: true,
        message: `수정 완료: '${colName}/${docId}' (${elapsed}ms)`,
        affectedRows: 1,
        executionTimeMs: elapsed
      };
    }

    // 4. DELETE FROM <col> WHERE id = <docId>
    const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_-]+)\s+WHERE\s+(?:id|_id)\s*=\s*['"]?([a-zA-Z0-9_-]+)['"]?$/i);
    if (deleteMatch) {
      const [, colName, docId] = deleteMatch;
      await deleteDoc(doc(db, colName, docId));
      const elapsed = Math.round(performance.now() - start);
      return {
        success: true,
        message: `삭제 완료: '${colName}/${docId}' (${elapsed}ms)`,
        affectedRows: 1,
        executionTimeMs: elapsed
      };
    }

    // 5. CREATE COLLECTION <col>
    const createMatch = trimmed.match(/^CREATE\s+(?:COLLECTION|TABLE)\s+([a-zA-Z0-9_-]+)$/i);
    if (createMatch) {
      const colName = createMatch[1];
      await registerCustomCollection(colName);
      // 샘플 초기 문서 생성
      await setDoc(doc(db, colName, '_init'), { created: true, createdAt: Date.now() });

      const elapsed = Math.round(performance.now() - start);
      return {
        success: true,
        message: `컬렉션 생성 완료: '${colName}' (${elapsed}ms)`,
        affectedRows: 1,
        executionTimeMs: elapsed
      };
    }

    // 6. Native JS fallback (예: db.collection(...).set(...))
    if (trimmed.startsWith('db.')) {
      const evalFn = new Function('db', 'firestore', `"use strict"; return (${trimmed});`);
      const res = await evalFn(db, { collection, doc, setDoc, getDoc, getDocs, deleteDoc });
      const elapsed = Math.round(performance.now() - start);
      return {
        success: true,
        message: `JS 구문 실행 완료 (${elapsed}ms)`,
        data: res ? [res] : undefined,
        executionTimeMs: elapsed
      };
    }

    throw new Error('지원되지 않는 쿼리 형식입니다. (SELECT, INSERT, UPDATE, DELETE, CREATE COLLECTION)');
  } catch (error: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      success: false,
      message: error?.message || '쿼리 실행 중 오류 발생',
      executionTimeMs: elapsed
    };
  }
}
