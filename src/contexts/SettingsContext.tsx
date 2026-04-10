import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from 'firebase/auth';

export interface SavedItem {
  id: string;
  name: string;
  value: string;
  isDefault?: boolean;
}

export interface SavedInstruction {
  id: string;
  title: string;
  content: string;
}

export interface CustomMode {
  id: string;
  name: string;
  rules: string;
  isPremade?: boolean;
}

export const IDE_PROFILES = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    canDo: ['Autonomously create, read, and edit files', 'Execute terminal commands natively', 'Deploy to cloud directly'],
    cannotDo: ['Cannot physically test UI on a real mobile device']
  },
  {
    id: 'cursor',
    name: 'Cursor',
    canDo: ['Edit files autonomously via Composer', 'Run terminal commands if approved by user'],
    cannotDo: ['Cannot autonomously browse the live web without specific tools']
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    canDo: ['Deep workspace context awareness', 'Autonomous agentic coding and file creation'],
    cannotDo: ['Cannot bypass human approval for destructive actions']
  },
  {
    id: 'vscode',
    name: 'VS Code (Standard)',
    canDo: ['Highlight syntax', 'Accept standard markdown code blocks'],
    cannotDo: ['CANNOT autonomously edit files', 'CANNOT run terminal commands automatically. User MUST copy/paste the payload manually.']
  }
];

export interface GlobalDefaults {
  userLang: string;
  ideLang: string;
  targetIde: string;
  customInstructions: string;
  complexityMode: string;
  spokenLanguage: string;
  hasCompletedOnboarding?: boolean;
  fontFamily: string;
  fontSize: string;
  globalTechStack?: string[];
  autoCopyVoice?: boolean;
  enableDualMode?: boolean;
}

interface SettingsContextType {
  savedLanguages: SavedItem[];
  savedIdes: SavedItem[];
  savedInstructions: SavedInstruction[];
  customModes: CustomMode[];
  globalDefaults: GlobalDefaults;
  addLanguage: (name: string, value: string) => Promise<void>;
  deleteLanguage: (id: string) => Promise<void>;
  addIde: (name: string, value: string) => Promise<void>;
  deleteIde: (id: string) => Promise<void>;
  addInstruction: (title: string, content: string) => Promise<void>;
  deleteInstruction: (id: string) => Promise<void>;
  addCustomMode: (name: string, rules: string) => Promise<void>;
  deleteCustomMode: (id: string) => Promise<void>;
  updateGlobalDefaults: (defaults: Partial<GlobalDefaults>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const PREMADE_MODES: CustomMode[] = [
  { id: 'premade-simple', name: 'SIMPLE', rules: 'Zero technical jargon. Explain the prompt strategy conceptually and generate the IDE command using basic, layman logic.', isPremade: true },
  { id: 'premade-specific', name: 'SPECIFIC', rules: 'Use exact technical architecture terms, framework names, and precise logic flow, but strictly adhere to ZERO code snippets.', isPremade: true },
  { id: 'premade-advanced', name: 'ADVANCED', rules: 'Senior expert level. You are explicitly authorized to override the "No Code" constraint. Provide structural code scaffolding, interfaces, and exact syntax examples within the generated IDE command to guide execution.', isPremade: true }
];

export const DEFAULT_IDES = ["Antigravity", "Claude", "Cursor", "VS Code", "Windsurf", "JetBrains", "Neovim"];

export const DEFAULT_LANGUAGES = [
  { name: "English (US)", value: "en-US" },
  { name: "Arabic (UAE)", value: "ar-AE" },
  { name: "Spanish (Global)", value: "es-ES" },
  { name: "Chinese (Simplified)", value: "zh-CN" },
  { name: "French (Global)", value: "fr-FR" }
];

export const SettingsProvider: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  const [savedLanguages, setSavedLanguages] = useState<SavedItem[]>([]);
  const [savedIdes, setSavedIdes] = useState<SavedItem[]>([]);
  const [savedInstructions, setSavedInstructions] = useState<SavedInstruction[]>([]);
  const [customModes, setCustomModes] = useState<CustomMode[]>(PREMADE_MODES);
  const [globalDefaults, setGlobalDefaults] = useState<GlobalDefaults>(() => {
    const baseDefaults: GlobalDefaults = {
      userLang: 'en-US',
      ideLang: 'en-US',
      targetIde: 'VS Code',
      customInstructions: '',
      complexityMode: 'premade-specific',
      spokenLanguage: 'en-US',
      hasCompletedOnboarding: false,
      fontFamily: 'system',
      fontSize: 'medium',
      globalTechStack: [],
      autoCopyVoice: false,
      enableDualMode: true
    };
    try {
      const stored = localStorage.getItem('nexus_user_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...baseDefaults, ...parsed, enableDualMode: parsed.enableDualMode ?? true };
      }
    } catch {}
    return baseDefaults;
  });

  useEffect(() => {
    import('../lib/i18n').then(({ default: i18n }) => {
      const lang = globalDefaults.userLang.startsWith('ar') ? 'ar' : 'en';
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang);
      }
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    });
  }, [globalDefaults.userLang]);

  useEffect(() => {
    if (!user) return;

    const langsRef = collection(db, `users/${user.uid}/saved_languages`);
    const unsubLangs = onSnapshot(langsRef, (snapshot) => {
      const fetchedLangs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedItem));
      const defaultLangs: SavedItem[] = DEFAULT_LANGUAGES.map(lang => ({ id: `default-${lang.value}`, name: lang.name, value: lang.value, isDefault: true }));
      setSavedLanguages([...defaultLangs, ...fetchedLangs]);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/saved_languages`));

    const idesRef = collection(db, `users/${user.uid}/saved_ides`);
    const unsubIdes = onSnapshot(idesRef, (snapshot) => {
      const fetchedIdes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedItem));
      const defaultIdes: SavedItem[] = DEFAULT_IDES.map(ide => ({ id: `default-${ide.toLowerCase().replace(/\s+/g, '-')}`, name: ide, value: ide, isDefault: true }));
      setSavedIdes([...defaultIdes, ...fetchedIdes]);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/saved_ides`));

    const instRef = collection(db, `users/${user.uid}/saved_instructions`);
    const unsubInst = onSnapshot(instRef, (snapshot) => {
      setSavedInstructions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedInstruction)));
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/saved_instructions`));

    const modesRef = collection(db, `users/${user.uid}/custom_modes`);
    const unsubModes = onSnapshot(modesRef, (snapshot) => {
      const fetchedModes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomMode));
      setCustomModes([...PREMADE_MODES, ...fetchedModes]);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/custom_modes`));

    const defaultsRef = doc(db, `users/${user.uid}/global_defaults/default`);
    const unsubDefaults = onSnapshot(defaultsRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedData = docSnap.data() as GlobalDefaults;
        setGlobalDefaults(prev => {
          const merged = { ...prev, ...fetchedData };
          localStorage.setItem('nexus_user_settings', JSON.stringify(merged));
          return merged;
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/global_defaults/default`));

    return () => {
      unsubLangs();
      unsubIdes();
      unsubInst();
      unsubModes();
      unsubDefaults();
    };
  }, [user]);

  const addLanguage = async (name: string, value: string) => {
    if (!user) return;
    await addDoc(collection(db, `users/${user.uid}/saved_languages`), { name, value });
  };

  const deleteLanguage = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/saved_languages/${id}`));
  };

  const addIde = async (name: string, value: string) => {
    if (!user) return;
    await addDoc(collection(db, `users/${user.uid}/saved_ides`), { name, value });
  };

  const deleteIde = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/saved_ides/${id}`));
  };

  const addInstruction = async (title: string, content: string) => {
    if (!user) return;
    await addDoc(collection(db, `users/${user.uid}/saved_instructions`), { title, content });
  };

  const deleteInstruction = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/saved_instructions/${id}`));
  };

  const addCustomMode = async (name: string, rules: string) => {
    if (!user) return;
    await addDoc(collection(db, `users/${user.uid}/custom_modes`), { name, rules });
  };

  const deleteCustomMode = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/custom_modes/${id}`));
  };

  const updateGlobalDefaults = async (defaults: Partial<GlobalDefaults>) => {
    setGlobalDefaults(prev => {
      const updated = { ...prev, ...defaults };
      localStorage.setItem('nexus_user_settings', JSON.stringify(updated));
      return updated;
    });
    
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/global_defaults/default`), defaults, { merge: true });
    } catch (e) {
      console.error("Failed to sync defaults to Cloud:", e);
    }
  };

  return (
    <SettingsContext.Provider value={{
      savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults,
      addLanguage, deleteLanguage, addIde, deleteIde, addInstruction, deleteInstruction,
      addCustomMode, deleteCustomMode, updateGlobalDefaults
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
