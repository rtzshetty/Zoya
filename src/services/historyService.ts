import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface ChatMessage {
  id?: string;
  userId: string;
  sender: 'user' | 'zoya';
  text: string;
  timestamp: Timestamp | any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const historyService = {
  async saveMessage(text: string, sender: 'user' | 'zoya') {
    const user = auth.currentUser;
    if (!user) return;

    const path = 'chats';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        sender,
        text,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async getRecentHistory(limitCount: number = 10): Promise<ChatMessage[]> {
    const user = auth.currentUser;
    if (!user) return [];

    const path = 'chats';
    try {
      const q = query(
        collection(db, path),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage))
        .reverse(); // Chronological order
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }
};
