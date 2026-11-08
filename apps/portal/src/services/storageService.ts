import { ref, listAll, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { storage, db } from '@gnflhs/shared-auth';
import { FIRESTORE_COLLECTIONS } from '@gnflhs/shared-types';

export interface StorageFileItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  size?: number;
  updatedAt?: string;
  downloadUrl?: string;
}

const FIRESTORE_STORAGE_COLLECTION = FIRESTORE_COLLECTIONS.STORAGE_META;

/**
 * 특정 스토리지 폴더 경로의 파일 및 폴더 목록 조회 (Storage 우선, 미지원 시 Firestore Fallback)
 */
export async function listStoragePath(targetPath: string = ''): Promise<{ folders: string[]; files: StorageFileItem[] }> {
  try {
    const listRef = ref(storage, targetPath);
    const res = await listAll(listRef);

    const folders = res.prefixes.map(p => p.name);
    const files: StorageFileItem[] = [];

    for (const itemRef of res.items) {
      try {
        const meta = await getMetadata(itemRef);
        const url = await getDownloadURL(itemRef);
        files.push({
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          isFolder: false,
          size: meta.size,
          updatedAt: meta.updated,
          downloadUrl: url
        });
      } catch (e) {
        files.push({
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          isFolder: false
        });
      }
    }

    return { folders, files };
  } catch (error) {
    // Cloud Storage 미활성화(Spark 플랜 등) 시 Firestore 컬렉션 기반 Fallback
    try {
      const q = query(
        collection(db, FIRESTORE_STORAGE_COLLECTION),
        where('folder', '==', targetPath)
      );
      const snap = await getDocs(q);
      const files: StorageFileItem[] = [];
      const folders: string[] = [];

      snap.forEach((d) => {
        const data = d.data();
        files.push({
          name: data.name,
          fullPath: data.fullPath,
          isFolder: false,
          size: data.size,
          updatedAt: data.updatedAt,
          downloadUrl: data.dataUrl
        });
      });

      return { folders, files };
    } catch (fErr) {
      console.warn('Fallback list failed:', fErr);
      return { folders: [], files: [] };
    }
  }
}

/**
 * 파일 업로드 (Cloud Storage 실패 시 Base64 Firestore 자동 저장)
 */
export async function uploadFileToStorage(path: string, file: File): Promise<string> {
  try {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  } catch (error) {
    // Spark 플랜을 위한 안전한 Firestore Base64 저장 Fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const folder = path.substring(0, path.lastIndexOf('/'));
          const name = file.name;
          const docId = path.replace(/\//g, '_');

          await setDoc(doc(db, FIRESTORE_STORAGE_COLLECTION, docId), {
            name,
            folder,
            fullPath: path,
            size: file.size,
            updatedAt: new Date().toISOString(),
            dataUrl: dataUrl
          });

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

/**
 * 파일 삭제
 */
export async function deleteFileFromStorage(path: string): Promise<void> {
  try {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  } catch (error) {
    // Firestore Fallback 삭제
    try {
      const docId = path.replace(/\//g, '_');
      await deleteDoc(doc(db, FIRESTORE_STORAGE_COLLECTION, docId));
    } catch (fErr) {
      console.error('Delete failed:', fErr);
    }
  }
}
