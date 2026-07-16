import { doc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { encodeForFirestore } from '@/shared/lib/firestore-codec';
import { permissionRequestSchema, type PermissionRequest } from '@/domain/permissionRequest/schema';

const COLL = 'permissionRequests';
let memory: PermissionRequest[] = [];

export const permissionRequestRepo = {
  async create(request: Omit<PermissionRequest, 'id' | 'createdAt' | 'status'>): Promise<PermissionRequest> {
    const id = `PR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const fullRequest = permissionRequestSchema.parse({
      ...request,
      id,
      createdAt,
      status: '대기',
    });

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, id), encodeForFirestore(fullRequest));
    } else {
      memory = [fullRequest, ...memory];
    }

    return fullRequest;
  }
};
