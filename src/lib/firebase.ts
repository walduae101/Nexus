import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '@/../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Phase 9 — IndexedDB-backed persistent cache.
//
//  • persistentLocalCache() replaces the default volatile memory cache with a
//    durable on-disk mirror of every document and query this client subscribes to.
//    Subsequent workspace mounts hydrate synchronously from IndexedDB, giving
//    zero-latency UI rendering before the network handshake even begins.
//
//  • persistentMultipleTabManager() safely shares the cache across tabs — without
//    it, only one tab per origin can claim the persistent cache and the rest
//    silently fall back to memory-only mode.
//
//  • onSnapshot listeners automatically emit cached data first, then delta-sync
//    from the server on reconnect. Offline mutations are queued in IndexedDB and
//    replay on reconnection. Conflict resolution relies on server validation via
//    Firestore rules — the live production DB remains the source of truth.
//
// initializeFirestore must be called ONCE, before any Firestore read/write. This
// module is dynamically imported via loadFirebase() (Phase 4) and memoised, so
// the singleton guarantee holds.
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
export const storage = getStorage(app, "gs://coolwtf.firebasestorage.app");

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
