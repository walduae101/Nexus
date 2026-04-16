import { useState, useEffect } from 'react';

export function useSessionPresence(sessionId: string | null) {
  const [isDistilling, setIsDistilling] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setIsDistilling(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      // Dynamic imports keep firebase/firestore + firebase.ts out of the main chunk.
      const [{ doc, onSnapshot }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('../firebase'),
      ]);
      if (cancelled) return;

      const presenceRef = doc(db, `chatSessions/${sessionId}/presence/state`);
      const unsub = onSnapshot(presenceRef, (snap) => {
        if (snap.exists()) {
          setIsDistilling(snap.data()?.is_distilling || false);
        } else {
          setIsDistilling(false);
        }
      }, (error) => {
        console.error('Error fetching presence state:', error);
        setIsDistilling(false);
      });

      if (cancelled) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [sessionId]);

  return { isDistilling };
}
