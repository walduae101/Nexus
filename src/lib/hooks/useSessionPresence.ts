import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useSessionPresence(sessionId: string | null) {
  const [isDistilling, setIsDistilling] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setIsDistilling(false);
      return;
    }

    const presenceRef = doc(db, `chatSessions/${sessionId}/presence/state`);
    const unsubscribe = onSnapshot(presenceRef, (doc) => {
      if (doc.exists()) {
        setIsDistilling(doc.data()?.is_distilling || false);
      } else {
        setIsDistilling(false);
      }
    }, (error) => {
      console.error('Error fetching presence state:', error);
      setIsDistilling(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  return { isDistilling };
}
