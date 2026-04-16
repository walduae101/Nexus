import { useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NexusChat } from '@/features/chat/components/NexusChat';
import { LogOut, Globe, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "@/components/ui/dropdown-menu";

import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { OnboardingWizard } from '@/features/onboarding/components/OnboardingWizard';
import { GlobalSettings } from '@/features/settings/components/GlobalSettings';
import { SparksIntroModal } from '@/features/sparks/components/SparksIntroModal';
import { DualModeIntroModal } from '@/features/chat/components/DualModeIntroModal';
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal';
import { TooltipProvider } from '@/components/ui/tooltip';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { t, i18n } = useTranslation();



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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
    return () => unsubscribe();
  }, []);

  const login = async () => {
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
      <NexusWorkspace user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} signOut={signOut} auth={auth} t={t} i18n={i18n} />
    </SettingsProvider>
  );
}

function NexusWorkspace({ user, isSidebarOpen, setIsSidebarOpen, signOut, auth, t, i18n }: any) {
  const { globalDefaults } = useSettings();

  const sizeClass = globalDefaults?.fontSize === 'small' ? 'text-sm' : globalDefaults?.fontSize === 'large' ? 'text-lg' : 'text-base';
  const fontStyle = globalDefaults?.fontFamily === 'cairo' ? { fontFamily: "'Cairo', sans-serif" } : globalDefaults?.fontFamily === 'tajawal' ? { fontFamily: "'Tajawal', sans-serif" } : {};

  return (
    <div className={`w-full h-screen ${sizeClass}`} style={fontStyle}>
      {globalDefaults && globalDefaults.hasCompletedOnboarding === false && <OnboardingWizard />}
      <div className="flex h-full bg-background text-foreground overflow-hidden">
        <div className="flex flex-col w-full h-full max-w-7xl mx-auto">
          <main className="flex-1 overflow-hidden flex flex-col relative">
            <ReleaseNotesModal />
            <SparksIntroModal />
            <DualModeIntroModal />
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
              <NexusChat user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
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
