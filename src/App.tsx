import { useEffect, useState, lazy, Suspense } from 'react';
import type { User } from 'firebase/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Globe, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "@/components/ui/dropdown-menu";

import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { DualModeIntroModal } from '@/features/chat/components/DualModeIntroModal';
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal';
import { TooltipProvider } from '@/components/ui/tooltip';

// Firebase vendor code, onboarding, sparks, and the entire NexusChat feature tree
// all load via dynamic imports — Rollup isolates them into separate async chunks.
const NexusChat = lazy(() =>
  import('@/features/chat/components/NexusChat').then(m => ({ default: m.NexusChat }))
);
const OnboardingWizard = lazy(() =>
  import('@/features/onboarding/components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard }))
);
const SparksIntroModal = lazy(() =>
  import('@/features/sparks/components/SparksIntroModal').then(m => ({ default: m.SparksIntroModal }))
);

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      // Dynamically load Firebase on first mount — keeps vendor SDK out of initial bundle.
      const [
        { auth, db, handleFirestoreError, OperationType },
        { onAuthStateChanged },
        { doc, getDoc, setDoc, Timestamp }
      ] = await Promise.all([
        import('./lib/firebase'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);

      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                role: 'user',
                createdAt: Timestamp.now()
              });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}`);
          }
        }
        setLoading(false);
      });
    })();
    return () => unsubscribe?.();
  }, []);

  const login = async () => {
    // Dynamic import on click — module is likely already cached from the useEffect preload.
    const [{ auth }, { signInWithPopup, GoogleAuthProvider }] = await Promise.all([
      import('./lib/firebase'),
      import('firebase/auth'),
    ]);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background text-foreground">{t('loading')}</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md bg-card border-border text-card-foreground">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center mb-6">
              <img src="/logo.png" alt="Nexus Logo" className="w-32 object-contain rounded-md" />
            </div>
            <CardTitle className="text-3xl font-light tracking-[0.2em] uppercase">NEXUS</CardTitle>
            <CardDescription className="text-xs font-light tracking-[0.3em] uppercase mt-2 text-muted-foreground">{t('slogan')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={login} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {t('sign_in_google')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SettingsProvider user={user}>
      <NexusWorkspace user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} t={t} i18n={i18n} />
    </SettingsProvider>
  );
}

function NexusWorkspace({ user, isSidebarOpen, setIsSidebarOpen, signOut, auth, t, i18n }: any) {
  const { globalDefaults } = useSettings();
  const [showSparks, setShowSparks] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('nexus_sparks_intro_seen');
    if (!hasSeen) {
      const timer = setTimeout(() => setShowSparks(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSparksClose = () => {
    localStorage.setItem('nexus_sparks_intro_seen', 'true');
    setShowSparks(false);
  };

  const sizeClass = globalDefaults?.fontSize === 'small' ? 'text-sm' : globalDefaults?.fontSize === 'large' ? 'text-lg' : 'text-base';
  const fontStyle = globalDefaults?.fontFamily === 'cairo' ? { fontFamily: "'Cairo', sans-serif" } : globalDefaults?.fontFamily === 'tajawal' ? { fontFamily: "'Tajawal', sans-serif" } : {};

  return (
    <div className={`w-full h-screen ${sizeClass}`} style={fontStyle}>
      {globalDefaults && globalDefaults.hasCompletedOnboarding === false && (
        <Suspense fallback={null}>
          <OnboardingWizard />
        </Suspense>
      )}
      <div className="flex h-full bg-background text-foreground overflow-hidden">
        <div className="flex flex-col w-full h-full max-w-7xl mx-auto">
          <main className="flex-1 overflow-hidden flex flex-col relative">
            <ReleaseNotesModal />
            {showSparks && (
              <Suspense fallback={null}>
                <SparksIntroModal onClose={handleSparksClose} />
              </Suspense>
            )}
            <DualModeIntroModal />
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading workspace...</div>}>
                <NexusChat user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
