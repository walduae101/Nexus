import { useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { NexusChat } from './components/NexusChat';
import { Sparkles, LogOut } from 'lucide-react';

import { SettingsProvider } from './contexts/SettingsContext';

import { GlobalSettings } from './components/GlobalSettings';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <div className="flex h-screen items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md bg-card border-border text-card-foreground">
          <CardHeader className="text-center">
            <div className="mx-auto bg-muted p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Nexus</CardTitle>
            <CardDescription className="text-muted-foreground">Sign in to access the elite AI System Architect.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={login} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SettingsProvider user={user}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <div className="flex flex-col w-full max-w-7xl mx-auto">
          <header className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-card/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Nexus</h1>
            </div>
            <div className="flex items-center gap-4">
              <GlobalSettings />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src={user.photoURL || ''} alt="Avatar" className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
                <span className="hidden sm:inline">{user.displayName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col p-6 md:p-8">
            <div className="flex-1 overflow-hidden flex flex-col">
              <NexusChat user={user} />
            </div>
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}

import { TooltipProvider } from './components/ui/tooltip';

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
