import { useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { OnboardingWizard } from '@/features/onboarding/components/OnboardingWizard';
import { GlobalSettings } from '@/features/settings/components/GlobalSettings';
import { SparksIntroModal } from '@/features/sparks/components/SparksIntroModal';
import { DualModeIntroModal } from '@/features/chat/components/DualModeIntroModal';
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
              createdAt: serverTimestamp()
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
        <div className="flex flex-col w-full max-w-7xl mx-auto">
          <header className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-card/50">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-muted-foreground hidden md:flex shrink-0">
                {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </Button>
              <img src="/logo.png" alt="Nexus Logo" className="w-10 h-10 object-contain" />
              <div className="flex flex-col">
                <h1 className="text-xl font-light tracking-[0.2em] uppercase leading-none">NEXUS</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md w-9 h-9 shrink-0 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
                  <Globe className="w-5 h-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => i18n.changeLanguage('ar')}>
                    العربية
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <GlobalSettings />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src={user.photoURL || ''} alt={t('avatar')} className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
                <span className="hidden sm:inline">{user.displayName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col p-6 md:p-8 relative">
            <SparksIntroModal />
            <DualModeIntroModal />
            <div className="flex-1 overflow-hidden flex flex-col">
              <NexusChat user={user} isSidebarOpen={isSidebarOpen} />
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
