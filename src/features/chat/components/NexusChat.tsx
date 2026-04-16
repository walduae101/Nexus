import { useState, useEffect, useRef, useMemo, lazy, Suspense, startTransition } from 'react';
import { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc,  doc, setDoc, where, updateDoc, deleteDoc, getDocs, limit , Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { chatWithNexus, generateImage, searchGrounding, textToSpeech, analyzeMedia, transcribeAudio, fastTask } from '@/lib/gemini';
import { compressChatHistory, getHistoricalContext, getDistilledMemories, updateLongTermMemory } from '@/lib/memory';
import { useSessionPresence } from '@/lib/hooks/useSessionPresence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Bot, User as UserIcon, Loader2, Paperclip, X, Image as ImageIcon, Mic, Search, Video, Plus, MessageSquare, Pencil, Check, Trash2, Download, UploadCloud, Play, Settings, Info, FolderSync, Copy, Wand2, Globe, Volume2, MoreVertical, Pin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lightbulb, Sparkles, Terminal, Square, ArrowDown, PanelLeftClose, PanelLeftOpen, LogOut, BookText } from 'lucide-react';
import Markdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';
import { TechStackSelector, TECH_STACKS } from '@/features/core/components/TechStackSelector';
import { GlobalSettings } from '@/features/settings/components/GlobalSettings';
import { Github } from 'lucide-react';

export interface Spark {
  id: string;
  text: string;
  attachments: string[];
  status: 'draft' | 'enhanced' | 'deployed';
  createdAt: number;
}

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { MessageCopyButton, ActionableCodeBlock, RelativeTime, LoadingBubble } from '@/features/chat/components/ChatUIPrimitives';
import { IssuesPanel } from '@/features/chat/components/IssuesPanel';
import { InputTelemetry, CompressPayloadButton, MAX_INPUT_CHARS } from './InputTelemetry';
import { InputGhostOverlay } from './InputGhostOverlay';
import { NextActionPill } from './NextActionPill';

// Regex used to extract the <<<NEXT_ACTION>>>...<<<END_NEXT_ACTION>>> tag appended
// by the model under the Phase 15 NEXT ACTION TAG directive. Stripped from both
// the streamed display text and the persisted message content.
const NEXT_ACTION_REGEX = /<<<NEXT_ACTION>>>([\s\S]*?)<<<END_NEXT_ACTION>>>/;

// Phase-19 Sliding Window — the outbound Gemini history payload is capped to
// this many recent turns. The UI and Firestore retain the full thread; only the
// network transmission is trimmed. Context that falls outside this window is
// covered by the Executive Summary (Phase 14) injected as "Archived
// Conversation State" in the system prompt (Phase 15 injection path).
const SLIDING_WINDOW_SIZE = 20;

// Distilled Memory Mirror — lazy-loaded. Rollup emits it as its own chunk that is
// only fetched when the current session actually has a non-empty projectSummary.
const DistilledMemoryMirror = lazy(() =>
  import('./DistilledMemoryMirror').then(m => ({ default: m.DistilledMemoryMirror }))
);

// Executive Summary Sidebar — lazy-loaded, only fetched the first time the user
// opens the sidebar for the current session.
const ExecutiveSummarySidebar = lazy(() =>
  import('./ExecutiveSummarySidebar').then(m => ({ default: m.ExecutiveSummarySidebar }))
);

export const generateSyncPrompt = (userPreferences?: string) => {
  const baseInstruction = `I am coordinating our workflow with Nexus. To ensure we stay synchronized, please generate a comprehensive current-state summary of the workspace. Include the latest updates on our modular architecture, the current status of the game logic and UI/UX polish, and any active system-level configurations.`;
  
  const ongoingRule = `Moving forward, please provide a brief exportable summary after major changes so I can easily keep Nexus in the loop.`;

  if (userPreferences && userPreferences.trim().length > 0) {
    return `${baseInstruction}\n\nUSER SPECIFIC PREFERENCES & FOCUS AREAS:\n"""\n${userPreferences.trim()}\n"""\n\n${ongoingRule}`;
  }

  return `${baseInstruction}\n\n${ongoingRule}`;
};

export function NexusChat({ user, isSidebarOpen = true, setIsSidebarOpen }: { user: User; isSidebarOpen?: boolean; setIsSidebarOpen?: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const { savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults } = useSettings();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { isDistilling } = useSessionPresence(sessionId);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageLimit, setMessageLimit] = useState(50);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [showLocalSearch, setShowLocalSearch] = useState(false);
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const observer = useRef<IntersectionObserver | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isFetchingMoreRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [ideText, setIdeText] = useState('');
  const [activeTab, setActiveTab] = useState<'user' | 'ide'>('user');
  const [processingAction, setProcessingAction] = useState<'text' | 'image' | 'tts' | 'search' | null>(null);
  const [model, setModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3-flash-preview' | 'gemini-3.1-flash-lite-preview'>('gemini-3.1-pro-preview');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [ghostSuggestion, setGhostSuggestion] = useState('');
  const [isSummarySidebarOpen, setIsSummarySidebarOpen] = useState(false);
  const [nextActionSuggestion, setNextActionSuggestion] = useState<string | null>(null);

  // Phase-17 Snapshot Guard — holds the sessionId whose AI response is actively
  // streaming. While non-null and equal to the messages-listener's sessionId,
  // the onSnapshot reconciler defers state overrides so multi-tab IndexedDB
  // fires don't clobber the in-flight assistant message. Cleared on stream
  // completion / error / abort.
  const streamingSessionIdRef = useRef<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isForeshadowing, setIsForeshadowing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const [pendingSettings, setPendingSettings] = useState<any>({});
  const [activeTool, setActiveTool] = useState<'image' | 'search' | 'tts' | null>(null);

  const [isSparksOpen, setIsSparksOpen] = useState(false);
  const [newSparkText, setNewSparkText] = useState('');
  const [isEnhancingSparkId, setIsEnhancingSparkId] = useState<string | null>(null);
  const [isGeneratingSparks, setIsGeneratingSparks] = useState(false);
  const [isSparkFileUploading, setIsSparkFileUploading] = useState(false);
  const sparkFileInputRef = useRef<HTMLInputElement>(null);

  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<string>(input);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If the user is more than 100px away from the bottom, they have scrolled up.
    const isUp = scrollHeight - scrollTop - clientHeight > 100;
    setIsScrolledUp(isUp);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const lowerQuery = debouncedSearchQuery.toLowerCase();
        const results: any[] = [];
        
        // Take up to top 20 sessions to prevent massive database strain.
        const recentSessionIds = sessions.slice(0, 20).map((s: any) => s.id);
        
        for (const sId of recentSessionIds) {
          const messagesQuery = query(collection(db, `chatSessions/${sId}/messages`), limit(100));
          const messagesSnapshot = await getDocs(messagesQuery);
          
          for (const docSnap of messagesSnapshot.docs) {
            const data = docSnap.data();
            const content = typeof data.content === 'string' ? data.content : '';
            const idePayload = typeof data.idePayload === 'string' ? data.idePayload : '';
            
            const fullText = (content + ' ' + idePayload).toLowerCase();
            
            if (fullText.includes(lowerQuery)) {
              const originalFullText = (content + ' ' + idePayload);
              const matchIndex = fullText.indexOf(lowerQuery);
              const start = Math.max(0, matchIndex - 30);
              const end = Math.min(originalFullText.length, matchIndex + lowerQuery.length + 30);
              const snippet = (start > 0 ? '...' : '') + originalFullText.substring(start, end).replace(/\n/g, ' ') + (end < originalFullText.length ? '...' : '');
              
              results.push({
                sessionId: sId,
                title: sessions.find((s: any) => s.id === sId)?.title || 'Unknown',
                matchedSnippet: snippet});
              break; // Found in this session, move to next
            }
          }
        }
        setSearchResults(results);
      } catch (error) {
        console.error('Deep Search Error:', error);
      } finally {
        setIsSearching(false);
      }
    };
    
    performSearch();
  }, [debouncedSearchQuery, sessions]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalTranscript = '';

      recognition.onstart = () => {
        finalTranscript = inputRef.current;
      };

      recognition.onresult = (event: any) => {
        if (!isListeningRef.current) return;
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setInput(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      isListeningRef.current = false;
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = globalDefaults.spokenLanguage || 'en-US';
        }
        recognitionRef.current?.start();
        setIsListening(true);
        isListeningRef.current = true;
        
        // Force focus directly into the text input immediately upon dictation start
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      } catch (e) {
        console.error('Failed to start speech recognition', e);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      setSelectedFiles(prev => {
        const combined = [...prev, ...droppedFiles];
        if (combined.length > 10) {
          alert('You can only attach up to 10 images.');
          return combined.slice(0, 10);
        }
        return combined;
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => {
        const combined = [...prev, ...newFiles];
        if (combined.length > 10) {
          alert('You can only attach up to 10 images.'); 
          return combined.slice(0, 10);
        }
        return combined;
      });
    }
    e.target.value = '';
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === 0) {
        e.preventDefault(); // Prevent default text pasting behavior for images
        const pastedFile = items[i].getAsFile();
        if (pastedFile) {
          setSelectedFiles(prev => {
            const combined = [...prev, pastedFile];
            if (combined.length > 10) {
              alert('You can only attach up to 10 images.');
              return combined.slice(0, 10);
            }
            return combined;
          });
        }
      }
    }
  };

  // Ghost-text autocomplete — debounced predictive completion for the user-note
  // input. Runs via Gemini Flash-Lite (fastTask, already deferred-lazy). Hides
  // on IDE tab, short input, or when the cursor is not at the end. A double race
  // guard (cancelled flag + value-change check) prevents stale suggestions from
  // landing after the user has moved on.
  useEffect(() => {
    // Always clear the current suggestion when the input changes. A fresh fetch
    // below will set a new one after the debounce window elapses.
    setGhostSuggestion('');

    if (activeTab !== 'user') return;
    if (!input || input.trim().length < 6) return;
    if (input.length > MAX_INPUT_CHARS * 0.5) return; // Save budget on large pastes — compress instead.
    const ta = textareaRef.current;
    if (!ta) return;
    if (ta.selectionStart !== ta.value.length) return; // Only when cursor is at end.
    if (isLoading || isCompressing || isForeshadowing) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const recent = messages
          .slice(-5)
          .map((m: any) => `[${m.role}]: ${(m.content || '').slice(0, 500)}`)
          .join('\n');
        const prompt = `You are a silent realtime autocomplete engine predicting the user's next characters.

STRICT RULES:
1. Output ONLY the continuation text — no repetition of the partial input, no quotes, no preamble, no explanation.
2. Maximum 40 characters.
3. Match the user's writing style and language.
4. If no confident prediction exists, output exactly the literal word NONE.

RECENT CONVERSATION (last 5 turns):
${recent || '(no prior turns)'}

USER IS CURRENTLY TYPING:
${input}

CONTINUATION:`;
        const raw = await fastTask(prompt);
        if (cancelled) return;
        // Race-check: value must still match what we fetched against.
        if (textareaRef.current?.value !== input) return;

        // Sanitize: strip quotes, common preambles, leading overlap with input,
        // cap length, reject NONE/empty.
        let clean = (raw || '').trim();
        if (!clean || /^NONE\.?$/i.test(clean)) return;
        clean = clean.replace(/^["'`]+|["'`]+$/g, '').trim();
        clean = clean.replace(/^(completion|continuation|next|output)\s*[:=\-]\s*/i, '');
        // Strip overlap where the model re-emitted the tail of the input.
        for (let n = Math.min(25, input.length); n > 0; n--) {
          const tail = input.slice(-n);
          if (clean.toLowerCase().startsWith(tail.toLowerCase())) {
            clean = clean.slice(n);
            break;
          }
        }
        if (clean.length > 60) clean = clean.slice(0, 60);
        clean = clean.trim();
        if (!clean) return;
        setGhostSuggestion(clean);
      } catch {
        // Silent — no ghost suggestion shown, user sees no change.
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, activeTab, messages, isLoading, isCompressing, isForeshadowing]);

  // Payload compression — routes the currently active input (user note OR IDE
  // payload) through `fastTask` (Gemini Flash-Lite) for lossless semantic
  // distillation. Overwrites the matching input state with the compressed result.
  // Fires only on explicit user click from CompressPayloadButton (>80% threshold).
  const handleCompressPayload = async () => {
    const source = activeTab === 'user' ? input : ideText;
    if (!source || source.length < 2000 || isCompressing) return;

    const originalLength = source.length;
    setIsCompressing(true);
    try {
      const compressionPrompt = `You are a lossless semantic compressor for developer prompts.

OBJECTIVE: Rewrite the input text to minimize character count while preserving EVERY piece of meaning, intent, and technical detail.

STRICT RULES:
1. Preserve ALL file paths, function names, variable names, error messages, stack traces, line numbers, and API endpoints verbatim.
2. Preserve ALL code snippets inside backticks or code fences verbatim — do not rewrite, shorten, or reformat code.
3. Preserve the original request/question — never drop a user instruction or directive.
4. Remove redundant phrasing, filler words, and repeated explanations.
5. Use dense technical language; assume an expert reader.
6. Do NOT add commentary, headers, preambles, explanations, or sign-offs.
7. Output ONLY the compressed text — nothing before or after.

INPUT:
"""
${source}
"""

COMPRESSED OUTPUT:`;

      const compressed = (await fastTask(compressionPrompt))?.trim() || '';
      // Only accept the result if it's actually shorter — otherwise keep original.
      if (compressed && compressed.length < originalLength) {
        if (activeTab === 'user') {
          setInput(compressed);
        } else {
          setIdeText(compressed);
        }
      } else {
        console.warn('[compress] Result was not shorter than original — keeping original.');
      }
    } catch (err) {
      console.error('[compress] Payload compression failed:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'chatSessions'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side: pinned sessions rise to the top (primary key), then by
      // updatedAt descending (secondary). Client-side ordering avoids the need
      // for a Firestore composite index and handles pending server timestamps.
      fetchedSessions.sort((a: any, b: any) => {
        const aPinned = !!a.isPinned;
        const bPinned = !!b.isPinned;
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        const timeA = a.updatedAt?.toMillis?.() || Date.now();
        const timeB = b.updatedAt?.toMillis?.() || Date.now();
        return timeB - timeA;
      });

      setSessions(fetchedSessions);

      if (!hasInitialized && fetchedSessions.length > 0) {
        setSessionId(fetchedSessions[0].id);
        setHasInitialized(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chatSessions');
    });
    return () => unsubscribe();
  }, [user.uid, hasInitialized]);

  const createNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setMessageLimit(50);
    setPendingSettings({});
  };

  const updateChatSettings = async (settingsToUpdate: any) => {
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      setPendingSettings((prev: any) => ({ ...prev, ...settingsToUpdate }));
    } else {
      await updateDoc(doc(db, 'chatSessions', targetSessionId), {
        ...settingsToUpdate,
        updatedAt: Timestamp.now()
      });
    }
  };

  const handleAddSpark = async () => {
    if (!newSparkText.trim()) return;
    const currentSparks = sessions.find((s: any) => s.id === sessionId)?.sparks || [];
    const newSpark: Spark = {
      id: `spark-${Date.now()}`,
      text: newSparkText.trim(),
      attachments: [],
      status: 'draft',
      createdAt: Date.now()
    };
    await updateChatSettings({ sparks: [...currentSparks, newSpark] });
    setNewSparkText('');
  };

  const handleDeleteSpark = async (sparkId: string) => {
    const currentSparks = sessions.find((s: any) => s.id === sessionId)?.sparks || [];
    await updateChatSettings({ sparks: currentSparks.filter((s: Spark) => s.id !== sparkId) });
  };

  const handleDeploySpark = async (sparkText: string, sparkId: string) => {
    setInput(sparkText);
    const currentSparks = sessions.find((s: any) => s.id === sessionId)?.sparks || [];
    await updateChatSettings({ 
      sparks: currentSparks.map((s: Spark) => s.id === sparkId ? { ...s, status: 'deployed' } : s) 
    });
    // Let the standard sendMessage engine absorb the input text naturally!
    setIsSparksOpen(false);
  };

  const handleEnhanceSpark = async (sparkText: string, sparkId: string) => {
    setIsEnhancingSparkId(sparkId);
    try {
      const enhancePrompt = `Take this rough idea: '${sparkText}'. Rewrite it into a clear, structured prompt for an AI assistant, keeping it concise.`;
      const enhancedText = await fastTask(enhancePrompt);
      const currentSparks = sessions.find((s: any) => s.id === sessionId)?.sparks || [];
      await updateChatSettings({ 
        sparks: currentSparks.map((s: Spark) => s.id === sparkId ? { ...s, text: enhancedText, status: 'enhanced' } : s) 
      });
    } catch (e) {
      console.error("Failed to enhance spark", e);
    } finally {
      setIsEnhancingSparkId(null);
    }
  };

  const generateAutoSparks = async () => {
    setIsGeneratingSparks(true);
    try {
      const currentSessionData = sessions.find((s: any) => s.id === sessionId);
      const activeStackIds = currentSessionData?.techStack?.length > 0 ? currentSessionData.techStack : (globalDefaults.globalTechStack || []);
      const activeStackLabels = activeStackIds.map((id: string) => TECH_STACKS.find(t => t.id === id)?.label || id);
      
      const getLanguageName = (code: string) => {
        if (code?.includes('ar')) return 'Arabic';
        return 'English';
      };
      const targetLanguage = getLanguageName(i18n.language);

      const recentContext = messages
        .slice(-4)
        .map((m: any) => `[${(m.role || 'user').toUpperCase()}]: ${m.content}`)
        .join('\n');

      const generatorPrompt = `You are a brilliant, highly creative AI Co-Pilot working alongside the user.
      
      CURRENT CONTEXT:
      Tech Stack: ${activeStackLabels.join(', ') || 'Not specified'}
      Recent Conversation:
      """
      ${recentContext || 'No conversation yet. Assume the user is starting a fresh project with the tech stack above.'}
      """

      YOUR TASK:
      Based heavily on the 'Recent Conversation' above, generate exactly 3 creative, inspiring, and highly relevant "Sparks" (ideas or next steps) for the user. 
      
      CRITICAL RULES:
      1. FOCUS ON THE GOAL: Your ideas must directly relate to what the user is currently trying to achieve in the chat. Do not suggest random architectural patterns.
      2. THE "WOW" FACTOR: Make the ideas sound exciting and innovative. Give them a clear benefit. (e.g., instead of "Implement Redis caching", suggest "Add a 'Smart Pre-Load' feature so the app feels instantly responsive before the user even clicks").
      3. TONE: Be easy to understand, encouraging, and human. Avoid dense technical jargon unless the user's recent messages are heavily technical.
      4. FORMAT: Separate each idea strictly with the delimiter "|||". Do not include introductory or concluding text.
      5. LANGUAGE: YOU MUST RESPOND EXCLUSIVELY IN ${targetLanguage.toUpperCase()}.`;

      const rawResponse = await fastTask(generatorPrompt);
      const newIdeas = rawResponse.split('|||').map(idea => idea.trim()).filter(idea => idea.length > 0);
      
      const currentSparks = currentSessionData?.sparks || [];
      const generatedSparks = newIdeas.map(text => ({
        id: `spark-auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: text.replace(/^[-*]\s*/g, ''), // Strip leading markdown bullets if AI hallucinates them
        attachments: [],
        status: 'draft' as const,
        createdAt: Date.now()
      }));
      
      await updateChatSettings({ sparks: [...currentSparks, ...generatedSparks] });
    } catch (e) {
      console.error("Failed to generate auto sparks", e);
    } finally {
      setIsGeneratingSparks(false);
    }
  };

  const saveSessionTitle = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'chatSessions', id), {
        title: editTitle.trim(),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Failed to update session title', error);
    }
    setEditingSessionId(null);
  };

  // Phase-18: toggle the `isPinned` flag on a session. Writes run optimistically —
  // local sessions state flips immediately so the re-sort paints in the same frame
  // as the user's click. On Firestore rejection we roll back to the previous value.
  // Intentionally does NOT update `updatedAt` (pinning is a metadata change that
  // shouldn't rewrite recency order).
  const togglePinSession = async (id: string) => {
    const target = sessions.find((s: any) => s.id === id);
    if (!target) return;
    const previous = !!target.isPinned;
    const next = !previous;

    // Optimistic update — flips the flag AND re-runs the sort so the item moves.
    setSessions(prev => {
      const updated = prev.map((s: any) => s.id === id ? { ...s, isPinned: next } : s);
      updated.sort((a: any, b: any) => {
        const aP = !!a.isPinned;
        const bP = !!b.isPinned;
        if (aP !== bP) return aP ? -1 : 1;
        const tA = a.updatedAt?.toMillis?.() || Date.now();
        const tB = b.updatedAt?.toMillis?.() || Date.now();
        return tB - tA;
      });
      return updated;
    });

    try {
      await updateDoc(doc(db, 'chatSessions', id), { isPinned: next });
    } catch (error) {
      console.error('Failed to toggle pin on session', error);
      // Rollback to the prior value + re-sort.
      setSessions(prev => {
        const reverted = prev.map((s: any) => s.id === id ? { ...s, isPinned: previous } : s);
        reverted.sort((a: any, b: any) => {
          const aP = !!a.isPinned;
          const bP = !!b.isPinned;
          if (aP !== bP) return aP ? -1 : 1;
          const tA = a.updatedAt?.toMillis?.() || Date.now();
          const tB = b.updatedAt?.toMillis?.() || Date.now();
          return tB - tA;
        });
        return reverted;
      });
    }
  };

  const deleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      // First, delete all messages in the session
      const messagesRef = collection(db, `chatSessions/${sessionToDelete}/messages`);
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(messageDoc => deleteDoc(messageDoc.ref));
      await Promise.all(deletePromises);

      // Then, delete the session itself
      await deleteDoc(doc(db, 'chatSessions', sessionToDelete));
      
      // If the deleted session was the active one, clear it
      if (sessionId === sessionToDelete) {
        setSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session', error);
    } finally {
      setSessionToDelete(null);
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setActiveLeafId(null);
      return;
    }
    const currentSession = sessions.find(s => s.id === sessionId);
    if (currentSession && currentSession.activeLeafId !== undefined) {
      setActiveLeafId(currentSession.activeLeafId);
    }
    
    // Only clear buffer instantly on a pristine session switch to prevent flash loading on infinite scrolls
    if (messageLimit === 50 && messages.every((m: any) => m.sessionId !== sessionId)) {
      setMessages([]); 
    }
    const q = query(collection(db, `chatSessions/${sessionId}/messages`), orderBy('timestamp', 'desc'), limit(messageLimit));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Phase-17 Snapshot Guard: while a stream is actively writing to this
      // session's messages (local only, not yet committed), any incoming
      // snapshot would risk clobbering the partial assistant message — most
      // often from the IndexedDB multi-tab cache sharing enabled in Phase 9.
      // We defer reconciliation until the stream commits its final document,
      // at which point the ref clears and the next snapshot lands normally.
      if (streamingSessionIdRef.current === sessionId) {
        return;
      }
      setMessages(prev => {
        const firestoreMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
        const firestoreIds = new Set(firestoreMessages.map((m: any) => m.id));
        // Preserve both kinds of local-only messages across snapshot replays:
        //   1) `temp-*` placeholders used for in-flight file uploads
        //   2) `_optimistic` messages written with their real Firestore ID, kept
        //      until the server snapshot echoes them back (prevents flicker if
        //      the listener re-subscribes before our write has propagated)
        const optimisticMessages = prev.filter((m: any) =>
          (m.id && m.id.toString().startsWith('temp-')) ||
          (m._optimistic && !firestoreIds.has(m.id))
        );
        return [...firestoreMessages, ...optimisticMessages];
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chatSessions/${sessionId}/messages`);
    });
    return () => unsubscribe();
  }, [sessionId, messageLimit, sessions]);

  // Compute activeThread dynamically
  const activeThread = useMemo(() => {
    const thread = [];
    let currentId = activeLeafId || (messages.length > 0 ? messages[messages.length - 1].id : null);

    while (currentId) {
      const msg = messages.find((m: any) => m.id === currentId);
      if (!msg) break;
      thread.unshift(msg);
      currentId = msg.parentId || null;
    }
    return thread;
  }, [messages, activeLeafId]);

  // Long-Term Executive Memory threshold trigger — fires when the active session's
  // aggregate message content crosses 5,000 characters, with delta-summarization on
  // subsequent triggers (only the un-summarized tail is sent to the LLM).
  //
  // Gates layered to prevent thrashing:
  //   • Total-char threshold (5k)
  //   • Delta must contain ≥4 new messages OR ≥500 new chars (once summary exists)
  //   • Per-session 5-minute cooldown ref
  const longTermMemoryGenRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!sessionId || !user || messages.length === 0) return;
    const currentSession = sessions.find((s: any) => s.id === sessionId);
    if (!currentSession) return;

    const totalChars = messages.reduce(
      (sum: number, m: any) => sum + ((m.content || '').length),
      0
    );
    // Phase-19: trigger on EITHER scale (5k+ chars) OR depth (messages beyond
    // the sliding window). This guarantees the Executive Summary keeps up as
    // turns roll off the outbound Gemini payload, so nothing is ever lost.
    if (totalChars < 5000 && messages.length <= SLIDING_WINDOW_SIZE) return;

    const existingSummary: string = currentSession.longTermMemory || '';
    const existingCheckpointId: string | null = currentSession.longTermMemoryCheckpointId || null;

    // Locate delta boundary.
    let checkpointIdx = -1;
    if (existingCheckpointId) {
      checkpointIdx = messages.findIndex((m: any) => m.id === existingCheckpointId);
    }
    const deltaMessages = messages.slice(checkpointIdx + 1);
    const deltaChars = deltaMessages.reduce(
      (sum: number, m: any) => sum + ((m.content || '').length),
      0
    );

    // Significance gate — avoids re-summarizing after every AI turn.
    if (existingSummary && deltaMessages.length < 4 && deltaChars < 500) return;
    if (deltaMessages.length === 0) return;

    // Cooldown — 5 min per session.
    const nowMs = Date.now();
    if (nowMs - (longTermMemoryGenRef.current[sessionId] ?? 0) < 300_000) return;
    longTermMemoryGenRef.current[sessionId] = nowMs;

    updateLongTermMemory(
      sessionId,
      existingSummary,
      deltaMessages.map((m: any) => ({
        role: String(m.role || 'user'),
        content: String(m.content || ''),
        id: String(m.id || '')
      }))
    ).catch((err) => {
      console.error('Long-term memory dispatch failed:', err);
    });
  }, [sessionId, messages, sessions, user]);

  // Distilled Memory freshness check — evaluates whether the current session's
  // projectSummary is stale relative to the most recent interaction and, if so,
  // dispatches a background compressChatHistory call. Per-session cooldown
  // (2 minutes) prevents repeated dispatches while messages are streaming in.
  const summaryRefreshRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!sessionId || !user || messages.length < 4) return;
    const currentSession = sessions.find((s: any) => s.id === sessionId);
    if (!currentSession) return;

    const lastMsg = messages[messages.length - 1];
    const lastMsgAt = lastMsg?.timestamp?.toMillis?.() ?? 0;
    const summaryUpdatedAt = currentSession.projectSummaryUpdatedAt?.toMillis?.() ?? 0;
    const summary = (currentSession.projectSummary || '').trim();

    // Stale when: no summary yet, OR the latest message is at least 2 minutes
    // newer than the last summary generation. Avoids thrashing during bursts.
    const isStale = !summary || (lastMsgAt - summaryUpdatedAt > 120_000);
    if (!isStale) return;

    // Per-session cooldown — don't re-dispatch within 2 minutes per session.
    const nowMs = Date.now();
    const lastDispatchMs = summaryRefreshRef.current[sessionId] ?? 0;
    if (nowMs - lastDispatchMs < 120_000) return;
    summaryRefreshRef.current[sessionId] = nowMs;

    const recentContext = messages
      .slice(-10)
      .map((m: any) => `[${m.role}]: ${m.content}`)
      .join('\n\n');

    compressChatHistory(
      sessionId,
      currentSession.projectSummary || '',
      currentSession.issuesScratchpad || [],
      recentContext
    ).catch((err) => {
      console.error('Distilled memory refresh failed:', err);
    });
  }, [sessionId, messages, sessions, user]);

  useEffect(() => {
    if (!localSearchQuery.trim()) {
      setSearchMatches([]);
      setActiveMatchIndex(0);
      return;
    }
    const lowerQuery = localSearchQuery.toLowerCase();
    const matches = activeThread.filter(m => 
      (m.content && m.content.toLowerCase().includes(lowerQuery)) || 
      (m.idePayload && m.idePayload.toLowerCase().includes(lowerQuery))
    ).map(m => m.id);
    
    setSearchMatches(matches);
    setActiveMatchIndex(0);
    if (matches.length > 0) {
      setTimeout(() => scrollToMessage(matches[0]), 50);
    }
  }, [localSearchQuery, activeThread]);

  const scrollToMessage = (messageId: string) => {
    document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(nextIdx);
    scrollToMessage(searchMatches[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = activeMatchIndex === 0 ? searchMatches.length - 1 : activeMatchIndex - 1;
    setActiveMatchIndex(prevIdx);
    scrollToMessage(searchMatches[prevIdx]);
  };

  // Component Lifecycle Interception for Contextual Foreshadowing
  useEffect(() => {
    let active = true;

    const checkForeshadowing = async () => {
      // Trigger when we have no active session but the UI has fully initialized
      if (hasInitialized && sessionId === null && !isForeshadowing) {
        setIsForeshadowing(true);
        try {
          const distilled = await getDistilledMemories(user.uid);
          
          let memoryInjection = 'No distilled emotional data exists yet. Assume fresh start.';
          if (distilled) {
            memoryInjection = `
- Vulnerabilities/Fears: ${distilled.vulnerabilities_fears || 'None'}
- Humorous/Shared Jokes: ${distilled.humorous_shared_jokes || 'None'}
- Personal Goals/Promises: ${distilled.personal_goals_promises || 'None'}
`;
          }

          const prompt = `[CONTEXTUAL FORESHADOWING DIRECTIVES]\nYou are Nexus, an elite AI developer and co-pilot.
The user just opened a new terminal/chat session.
Your task is to proactively initiate the conversation.
1. Tone: Natural, empathetic, and highly professional.
2. Continuity: Use the recent interaction history provided below to seamlessly pick up where you left off, reference ongoing tasks, or suggest logical next steps.
3. Constraint: STRICTLY PROHIBIT generic initialization queries (e.g., "How are you?", "How can I help you today?"). Jump straight into relevant context or a smart technical prompt.
4. Output: Generate ONLY the raw initiation string.

[DISTILLED EMOTIONAL MEMORIES]\n${memoryInjection}`;

          const initialString = await fastTask(prompt);
          if (!active) return;

          const newSessionRef = doc(collection(db, 'chatSessions'));
          const targetSessionId = newSessionRef.id;
          
          await setDoc(newSessionRef, {
            userId: user.uid,
            title: t('new_chat') || 'New Chat',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            userLang: pendingSettings?.userLang || null,
            ideLang: pendingSettings?.ideLang || null,
            targetIde: pendingSettings?.targetIde || null,
            customInstructions: pendingSettings?.customInstructions || null,
            complexityMode: pendingSettings?.complexityMode || null
          });
          
          const sysRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
            sessionId: targetSessionId,
            userId: user.uid,
            role: 'model',
            content: initialString,
            timestamp: Timestamp.now()
          });
          
          await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
             activeLeafId: sysRef.id,
             updatedAt: Timestamp.now()
          });
          
          setSessionId(targetSessionId);
          setPendingSettings({});
        } catch (err) {
          console.error("Foreshadowing failed", err);
        } finally {
          if (active) setIsForeshadowing(false);
        }
      }
    };

    checkForeshadowing();
    return () => { active = false; };
  }, [hasInitialized, sessionId]);

  // Progressive Auto-Titling Engine
  useEffect(() => {
    const generateDynamicTitle = async () => {
      const currentSession = sessions.find(s => s.id === sessionId);
      if (!currentSession || !sessionId) return;
      
      const isDefaultTitle = 
        currentSession.title === "New Session" || 
        currentSession.title === "جلسة جديدة" || 
        currentSession.title === "New Chat" || 
        currentSession.title === "محادثة جديدة";
      
      if (isDefaultTitle && messages.length >= 2 && messages.length <= 4) {
        try {
          const contextText = messages.slice(0, 4).map(m => m.content).join(" | ");
          const prompt = `Analyze this conversation context and generate a highly concise, 3-to-4 word title. Respond ONLY with the title string, no quotes, no punctuation. Context: ${contextText}`;
          const newTitle = await fastTask(prompt);
          
          if (newTitle && newTitle.trim()) {
            await updateDoc(doc(db, 'chatSessions', sessionId), {
              title: newTitle.trim(),
              updatedAt: Timestamp.now()
            });
          }
        } catch (error) {
          console.error("Failed to generate progressive title", error);
        }
      }
    };
    
    generateDynamicTitle();
  }, [messages.length, sessionId, sessions]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (isFetchingMoreRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = prevScrollTopRef.current + (newScrollHeight - prevScrollHeightRef.current);
      isFetchingMoreRef.current = false;
    } else {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (!isScrolledUp && (isNearBottom || messages.length <= 50)) { 
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, isLoading, isScrolledUp]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && messages.length >= messageLimit) {
        if (scrollRef.current) {
          prevScrollHeightRef.current = scrollRef.current.scrollHeight;
          prevScrollTopRef.current = scrollRef.current.scrollTop;
          isFetchingMoreRef.current = true;
        }
        setMessageLimit(prev => prev + 50);
      }
    });
    observer.current.observe(loadMoreRef.current);
    
    return () => {
      observer.current?.disconnect();
    };
  }, [messages.length, messageLimit]);

  const deleteMessageBranch = async (messageId: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm("Are you sure you want to delete this message and all its replies?")) return;

    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    const idsToDelete = new Set([messageId]);
    let added = true;
    while (added) {
      added = false;
      for (const m of messages) {
        if (m.parentId && idsToDelete.has(m.parentId) && !idsToDelete.has(m.id)) {
          idsToDelete.add(m.id);
          added = true;
        }
      }
    }

    if (activeLeafId && idsToDelete.has(activeLeafId)) {
      setActiveLeafId(targetMsg.parentId || null);
      if (targetMsg.sessionId) {
         await updateDoc(doc(db, 'chatSessions', targetMsg.sessionId), {
           activeLeafId: targetMsg.parentId || null
         });
      }
    }

    setMessages(prev => prev.filter(m => !idsToDelete.has(m.id)));

    try {
      const deletePromises = Array.from(idsToDelete).map(id => {
         if (!id.startsWith('temp-')) {
            return deleteDoc(doc(db, `chatSessions/${targetMsg.sessionId}/messages`, id));
         }
         return Promise.resolve();
      });
      await Promise.all(deletePromises);
    } catch (e) {
      console.error("Failed to delete branch", e);
    }
  };

  const sendMessage = async (overrideParentId?: string | null, overrideInput?: string, regenerateUserId?: string | null) => {
    const MAX_FIRESTORE_CHARS = MAX_INPUT_CHARS; // shared with InputTelemetry — keeps the limit single-sourced
    const isOverride = overrideInput !== undefined;
    let userMessage = isOverride ? overrideInput : input;
    let targetIdePayload = isOverride ? undefined : ideText;
    
    if (regenerateUserId) {
        const targetUserMsg = messages.find((m: any) => m.id === regenerateUserId);
        if (targetUserMsg) {
            userMessage = targetUserMsg.content || '';
            targetIdePayload = targetUserMsg.idePayload || '';
        }
    }

    if ((!userMessage.trim() && !targetIdePayload?.trim() && selectedFiles.length === 0 && !regenerateUserId) || isLoading) return;
    
    if (activeTool === 'image') userMessage = '/image ' + userMessage;
    else if (activeTool === 'search') userMessage = '/search ' + userMessage;
    else if (activeTool === 'tts') userMessage = '/tts ' + userMessage;

    const currentSelectedFiles = [...selectedFiles];
    
    if (!isOverride) {
      setInput('');
      setIdeText('');
      clearFiles();
      setActiveTool(null);
    }
    // A new turn is about to fire — dismiss any prior proactive suggestion so
    // the pill doesn't linger while the model generates a fresh one.
    setNextActionSuggestion(null);
    setIsLoading(true);

    let targetSessionId = sessionId;

    try {
      if (!targetSessionId) {
        const newSessionRef = doc(collection(db, 'chatSessions'));
        targetSessionId = newSessionRef.id;
        await setDoc(newSessionRef, {
          userId: user.uid,
          title: t('new_chat') || 'New Chat',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
            userLang: pendingSettings?.userLang || null,
            ideLang: pendingSettings?.ideLang || null,
            targetIde: pendingSettings?.targetIde || null,
            customInstructions: pendingSettings?.customInstructions || null,
            complexityMode: pendingSettings?.complexityMode || null
        });
        await new Promise(r => setTimeout(r, 400)); // Delay listener attachment to allow strict firestore rule propagations
        setSessionId(targetSessionId);
        setPendingSettings({});
      } else {
        await updateDoc(doc(db, 'chatSessions', targetSessionId), {
          updatedAt: Timestamp.now()
        });
      }

      let uploadedUrls: string[] = [];
      const tempUserMsgId = `temp-user-${Date.now()}`;
      
      const userParentId = overrideParentId !== undefined 
          ? overrideParentId 
          : (activeLeafId || (activeThread.length > 0 ? activeThread[activeThread.length - 1].id : null));

      if (currentSelectedFiles.length > 0) {
         setMessages(prev => [...prev, {
            id: tempUserMsgId,
            sessionId: targetSessionId,
            userId: user.uid,
            role: 'user',
            content: userMessage || `[Uploaded ${currentSelectedFiles.length} file(s)]`,
            timestamp: new Date(),
            attachments: currentSelectedFiles.map(f => URL.createObjectURL(f)),
            isUploading: true,
            parentId: userParentId
         }]);
         setActiveLeafId(tempUserMsgId);

         const uploadPromises = currentSelectedFiles.map(async uploadFile => {
             const safeName = uploadFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
             const attachmentRef = ref(storage, `users/${user.uid}/attachments/${Date.now()}_${safeName}`);
             await uploadBytes(attachmentRef, uploadFile, { contentType: uploadFile.type });
             return await getDownloadURL(attachmentRef);
         });

         try {
             uploadedUrls = await Promise.all(uploadPromises);
         } catch (error) {
             console.error("Failed to upload images:", error);
         }
      }

      let activeUserMsgId = '';
      if (regenerateUserId) {
          activeUserMsgId = regenerateUserId;
          setActiveLeafId(activeUserMsgId);
          await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
             activeLeafId: activeUserMsgId,
             updatedAt: Timestamp.now()
          });
      } else {
          const userDocRef = doc(collection(db, `chatSessions/${targetSessionId}/messages`));
          activeUserMsgId = userDocRef.id;

          let safeUserContent = userMessage || (currentSelectedFiles.length > 0 ? `[Uploaded ${currentSelectedFiles.length} file(s)]` : '');
          if (safeUserContent.length > MAX_FIRESTORE_CHARS) {
              safeUserContent = safeUserContent.substring(0, MAX_FIRESTORE_CHARS) + '\n\n[SYSTEM WARNING: Input truncated. Exceeded 1MB database limit.]';
          }
          let safeIdePayload = targetIdePayload?.trim() || null;
          if (safeIdePayload && safeIdePayload.length > MAX_FIRESTORE_CHARS) {
              safeIdePayload = safeIdePayload.substring(0, MAX_FIRESTORE_CHARS) + '\n\n[SYSTEM WARNING: IDE Payload truncated. Exceeded 1MB database limit.]';
          }

          const userMessageData: any = {
            sessionId: targetSessionId,
            userId: user.uid,
            role: 'user',
            content: safeUserContent,
            idePayload: safeIdePayload,
            timestamp: Timestamp.now(),
            parentId: userParentId,
            ...(uploadedUrls.length > 0 ? { attachments: uploadedUrls } : {})
          };

          if (currentSelectedFiles.length > 0) {
              // File-upload path: a `temp-*` placeholder is already shown (line ~844) and
              // awaiting the writes lets the temp→real transition happen without a visual gap
              // once the real message arrives via onSnapshot.
              await setDoc(userDocRef, userMessageData);
              setActiveLeafId(activeUserMsgId);
              await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
                 activeLeafId: activeUserMsgId,
                 updatedAt: Timestamp.now()
              });
          } else {
              // Text-only path: optimistic UI. Inject the message into local state with its
              // real Firestore ID so the DOM updates in the same frame as the user's send
              // action (zero perceived latency). Persistence runs fire-and-forget; on failure
              // the optimistic entry is spliced out to restore the last server-confirmed view.
              setMessages(prev => [...prev, { id: activeUserMsgId, _optimistic: true, ...userMessageData }]);
              setActiveLeafId(activeUserMsgId);

              Promise.all([
                setDoc(userDocRef, userMessageData),
                updateDoc(doc(db, 'chatSessions', targetSessionId!), {
                   activeLeafId: activeUserMsgId,
                   updatedAt: Timestamp.now()
                })
              ]).catch((err) => {
                console.error('Failed to persist user message — rolling back optimistic insert:', err);
                setMessages(prev => prev.filter(m => m.id !== activeUserMsgId));
              });
          }
      }
      
      if (currentSelectedFiles.length > 0) {
         setMessages(prev => prev.filter(m => m.id !== tempUserMsgId));
      }

      let fullResponse = '';
      let attachmentUrl = '';
      let attachmentType = '';

      let actionState: 'text' | 'image' | 'tts' | 'search' = 'text';
      if (activeTool === 'image' || userMessage.startsWith('/image ')) actionState = 'image';
      else if (activeTool === 'search' || userMessage.startsWith('/search ')) actionState = 'search';
      else if (activeTool === 'tts' || userMessage.startsWith('/tts ')) actionState = 'tts';

      setProcessingAction(actionState);
      
      // Handle Slash Commands & File Uploads
      if (userMessage.startsWith('/image ')) {
        const prompt = userMessage.replace('/image ', '');
        fullResponse = `Generated image for: "${prompt}"`;
        attachmentUrl = await generateImage(prompt, 'gemini-3.1-flash-image-preview', '1:1', '1K');
        attachmentType = 'image/png';
      } else if (userMessage.startsWith('/search ')) {
        const query = userMessage.replace('/search ', '');
        fullResponse = await searchGrounding(query);
      } else if (userMessage.startsWith('/tts ')) {
        try {
          const text = userMessage.replace('/tts ', '');
          fullResponse = `Generated audio for: "${text}"`;
          
          const base64Audio = await textToSpeech(text);
          const fetchResponse = await fetch(base64Audio);
          const audioBlob = await fetchResponse.blob();
          const mimeType = audioBlob.type || 'audio/wav';
          const extension = mimeType.split('/')[1] || 'wav';
          const metadata = { contentType: mimeType };
          
          const audioRef = ref(storage, `users/${user.uid}/tts/${Date.now()}.${extension}`);
          await uploadBytes(audioRef, audioBlob, metadata);
          
          attachmentUrl = await getDownloadURL(audioRef);
          attachmentType = mimeType;
        } catch (error: any) {
          console.error("TTS Pipeline Complete Error:", error);
          fullResponse = `Failed to generate audio. Diagnostic Code: ${error.message || JSON.stringify(error) || "Unknown backend error"}`;
        }
      } else if (currentSelectedFiles.length > 0) {
        const primaryFile = currentSelectedFiles[0];
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(primaryFile);
        });
        
        if (primaryFile.type.startsWith('audio/')) {
          fullResponse = await transcribeAudio(base64Data, primaryFile.type);
        } else {
          fullResponse = await analyzeMedia(base64Data, primaryFile.type, userMessage || 'Describe this media.');
        }
      } else {
        // Standard Chat
        let currentThread = activeThread;
        if (regenerateUserId) {
            const thread = [];
            const tMsg = messages.find((m: any) => m.id === regenerateUserId);
            let currentId: string | null = tMsg ? tMsg.parentId : null;
            while (currentId) {
              const msg = messages.find((m: any) => m.id === currentId);
              if (!msg) break;
              thread.unshift(msg);
              currentId = msg.parentId || null;
            }
            currentThread = thread;
        }

        const fullHistory = currentThread.map(m => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })) as { role: 'user' | 'model', parts: { text: string }[] }[];

        // Phase-19: apply the sliding window right before the transmit. In-memory
        // only — `currentThread` / `messages` / Firestore are untouched. Anything
        // that falls out of the tail is reconstructed for the LLM from the
        // Executive Summary that ships as "Archived Conversation State" in the
        // dynamically-injected system prompt.
        const history = fullHistory.length > SLIDING_WINDOW_SIZE
          ? fullHistory.slice(-SLIDING_WINDOW_SIZE)
          : fullHistory;

        const currentSession = sessions.find(s => s.id === targetSessionId);
        const activeSettingsData = currentSession || pendingSettings;
        
        // Find the active complexity mode object
        const activeModeId = activeSettingsData.complexityMode || globalDefaults.complexityMode;
        const activeMode = customModes.find(m => m.id === activeModeId) || customModes.find(m => m.id === 'premade-specific');

        const activeTechStack = activeSettingsData.techStack?.length > 0 ? activeSettingsData.techStack : globalDefaults.globalTechStack;
        let techStackContext = '';
        if (activeTechStack && activeTechStack.length > 0) {
           techStackContext = activeTechStack.map((id: string) => TECH_STACKS.find(t => t.id === id)?.label || id).filter(Boolean).join(', ');
        }

        const distilledMemories = await getDistilledMemories(user.uid);

        const activeSettings = {
          userLang: activeSettingsData.userLang || globalDefaults.userLang,
          ideLang: activeSettingsData.ideLang || globalDefaults.ideLang,
          targetIde: activeSettingsData.targetIde || globalDefaults.targetIde,
          customInstructions: activeSettingsData.customInstructions || globalDefaults.customInstructions,
          complexityModeName: activeMode?.name,
          complexityModeRules: activeMode?.rules,
          techStackContext,
          githubRepo: activeSettingsData.githubRepo || '',
          sparksContext: '',
          projectSummary: activeSettingsData.projectSummary || '',
          longTermMemory: activeSettingsData.longTermMemory || '',
          issuesScratchpad: activeSettingsData.issuesScratchpad || [],
          distilledMemories
        };

        const activeSparks = (currentSession?.sparks || []).filter((s: Spark) => s.status !== 'deployed');
        if (activeSparks.length > 0) {
          const sparkTexts = activeSparks.map((s: Spark) => s.text).join(' | ');
          activeSettings.sparksContext = `[PRIVATE USER SPARKS]: The user has the following unsubmitted drafts/ideas: "${sparkTexts}". Use this to understand their deeper intent and align your responses to their overall goals. CRITICAL: DO NOT mention these sparks proactively. Act as if you don't know they exist unless the user directly brings them up.`;
        }

        let finalAiPrompt = "";
        if (targetIdePayload?.trim()) finalAiPrompt += `[SYSTEM: THE FOLLOWING IS THE USER'S IDE CONTEXT/PAYLOAD]:\n${targetIdePayload.trim()}\n\n`;
        if (userMessage.trim()) finalAiPrompt += `[SYSTEM: THE FOLLOWING IS THE USER'S DIRECT QUESTION/NOTE]:\n${userMessage.trim()}`;
        if (!userMessage.trim() && targetIdePayload?.trim()) finalAiPrompt += `[SYSTEM: The user provided code/context without a specific question. Analyze it and provide a brief, insightful summary or suggest improvements.]`;
        



        abortControllerRef.current = new AbortController();
        
        let stream;
        try {
          stream = await chatWithNexus(history, finalAiPrompt, model, activeSettings, abortControllerRef.current.signal);
        } catch(error: any) {
          if (error.name === 'AbortError' || error.message?.includes('abort') || error.message?.toLowerCase().includes('cancelled')) {
             console.log('Chat initialization aborted.');
             abortControllerRef.current = null;
             return;
          } else {
             throw error;
          }
        }

        setProcessingAction(null); // Clear loading spinner instantly
        
        const aiMsgId = `temp-ai-${Date.now()}`;
        setMessages(prev => [...prev, { id: aiMsgId, role: 'model', content: '', timestamp: null, parentId: activeUserMsgId, isGenerating: true }]);
        setActiveLeafId(aiMsgId);

        // Phase-17: engage the snapshot guard for this session — onSnapshot
        // reconciler will now defer until we commit the final doc and clear it.
        streamingSessionIdRef.current = targetSessionId!;

        // Phase-17: unthrottled streaming. Previous typewriter (3 chars / 15 ms
        // setInterval) capped visible velocity at ~200 chars/s regardless of how
        // fast the network delivered. We now flush each network chunk straight
        // into state, wrapped in startTransition so React's concurrent scheduler
        // can prioritize input/frame work above typing-effect repaints.
        if (stream) {
          try {
            for await (const chunk of stream) {
              if (chunk.text) {
                fullResponse += chunk.text;
                const visibleText = fullResponse.split('<<<NEXT_ACTION>>>')[0];
                startTransition(() => {
                  setMessages(prevMessages =>
                    prevMessages.map(msg =>
                      msg.id === aiMsgId ? { ...msg, content: visibleText } : msg
                    )
                  );
                });
              }
            }
          } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('abort') || error.message?.toLowerCase().includes('cancelled')) {
              console.log('Stream stopped by user.');
              setMessages(prev => prev.map(msg =>
                msg.id === aiMsgId ? { ...msg, isGenerating: false } : msg
              ));
            } else {
              console.error("Stream error:", error);
              if (targetSessionId && user) {
                try {
                  const sysRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
                    sessionId: targetSessionId,
                    userId: user.uid,
                    role: 'system',
                    content: 'Network Interruption: The AI stream was unexpectedly disconnected. Partial response preserved.',
                    parentId: activeUserMsgId,
                    timestamp: Timestamp.now()
                  });
                  setActiveLeafId(sysRef.id);
                  await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
                    activeLeafId: sysRef.id,
                    updatedAt: Timestamp.now()
                  });
                } catch(e) {
                  console.error('Failed to log system error to DB', e);
                }
              }
            }
          } finally {
            abortControllerRef.current = null;
            // Release the snapshot guard on any stream-path exit so the listener
            // resumes reconciliation. Success path re-sets `_optimistic` locally
            // a few lines down; the guard release is safe either way.
            streamingSessionIdRef.current = null;
          }
        } else {
          abortControllerRef.current = null;
          streamingSessionIdRef.current = null;
        }

        const needsImmediateSync = fullResponse.includes('[SYNC_SCRATCHPAD]');
        // Extract the Phase-15 Next Action tag before stripping it from the user-
        // visible content. The tag is parsed, its content bound to transient state
        // (displayed as a clickable pill above the input), and fully removed from
        // what gets persisted to Firestore.
        const nextActionMatch = fullResponse.match(NEXT_ACTION_REGEX);
        const extractedNextAction = nextActionMatch ? nextActionMatch[1].trim() : '';
        if (extractedNextAction) {
          setNextActionSuggestion(extractedNextAction);
        }
        let cleanResponse = fullResponse
          .replace(/\[SYNC_SCRATCHPAD\]/g, '')
          .replace(NEXT_ACTION_REGEX, '')
          .trim();
        
        if (cleanResponse.length > MAX_FIRESTORE_CHARS) {
            cleanResponse = cleanResponse.substring(0, MAX_FIRESTORE_CHARS) + '\n\n[SYSTEM WARNING: AI Response truncated. Exceeded 1MB database limit.]';
        }

        const aiDocRefResult = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'model',
          content: cleanResponse || "",
          parentId: activeUserMsgId,
          timestamp: Timestamp.now()
        });

        setActiveLeafId(aiDocRefResult.id);

        // Phase-17: Re-key the temp streaming message to the real Firestore ID in
        // a single setMessages pass. The `_optimistic: true` flag keeps the entry
        // through any snapshot reconciliations that race in before Firestore's
        // listener delivers the canonical version (id-matched, so the optimistic
        // is naturally dropped once firestoreIds contains it).
        setMessages(prev => prev.map(m => m.id === aiMsgId ? {
          id: aiDocRefResult.id,
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'model',
          content: cleanResponse || "",
          parentId: activeUserMsgId,
          timestamp: Timestamp.now(),
          _optimistic: true
        } : m));

        await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
          activeLeafId: aiDocRefResult.id,
          updatedAt: Timestamp.now()
        });
        
        const currentCount = messages.length + 2;

        if (needsImmediateSync || (currentCount > 0 && currentCount % 6 === 0)) {
             const sessionObj = sessions.find((s: any) => s.id === targetSessionId);
             const currentSummary = sessionObj?.projectSummary || '';
             const currentIssues = sessionObj?.issuesScratchpad || [];
             
             let contextMsg = "";
             if (needsImmediateSync) {
                 contextMsg = [...messages.map((m: any) => `[${m.role}]: ${m.content}`), `[user]: ${userMessage}`, `[model]: ${cleanResponse}`].join('\n');
             } else {
                 contextMsg = [...messages.slice(-4).map((m: any) => `[${m.role}]: ${m.content}`), `[user]: ${userMessage}`, `[model]: ${cleanResponse}`].join('\n');
             }
             
             compressChatHistory(targetSessionId!, currentSummary, currentIssues, contextMsg);
        }
        
        setIsLoading(false);
        return; // Exit early since we already saved the message
      }

      const needsImmediateSync = fullResponse.includes('[SYNC_SCRATCHPAD]');
      // Phase-15 Next Action tag extraction for the non-streaming path (slash
      // commands, file analysis, etc.). Same parse + strip as the streaming path.
      const nonStreamNextActionMatch = fullResponse.match(NEXT_ACTION_REGEX);
      const nonStreamNextAction = nonStreamNextActionMatch ? nonStreamNextActionMatch[1].trim() : '';
      if (nonStreamNextAction) {
        setNextActionSuggestion(nonStreamNextAction);
      }
      let cleanResponse = fullResponse
        .replace(/\[SYNC_SCRATCHPAD\]/g, '')
        .replace(NEXT_ACTION_REGEX, '')
        .trim();

      if (cleanResponse.length > MAX_FIRESTORE_CHARS) {
          cleanResponse = cleanResponse.substring(0, MAX_FIRESTORE_CHARS) + '\n\n[SYSTEM WARNING: AI Response truncated. Exceeded 1MB database limit.]';
      }

      // Save non-streamed response (slash commands, file analysis)
      const aiNonStreamRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'model',
        content: cleanResponse || "",
        parentId: activeUserMsgId,
        timestamp: Timestamp.now(),
        ...(attachmentUrl ? { attachmentUrl, attachmentType } : {})
      });

      setActiveLeafId(aiNonStreamRef.id);

      await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
        activeLeafId: aiNonStreamRef.id,
        updatedAt: Timestamp.now()
      });

      const currentCount = messages.length + 2;

      if (needsImmediateSync || (currentCount > 0 && currentCount % 6 === 0)) {
           const sessionObj = sessions.find((s: any) => s.id === targetSessionId);
           const currentSummary = sessionObj?.projectSummary || '';
           const currentIssues = sessionObj?.issuesScratchpad || [];
           
           let contextMsg = "";
           if (needsImmediateSync) {
               contextMsg = [...messages.map((m: any) => `[${m.role}]: ${m.content}`), `[user]: ${userMessage}`, `[model]: ${cleanResponse}`].join('\n');
           } else {
               contextMsg = [...messages.slice(-4).map((m: any) => `[${m.role}]: ${m.content}`), `[user]: ${userMessage}`, `[model]: ${cleanResponse}`].join('\n');
           }

           compressChatHistory(targetSessionId!, currentSummary, currentIssues, contextMsg);
      }

    } catch (error) {
      console.error('Chat error:', error);
      if (targetSessionId) {
        const sysRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'system',
          content: 'Error: Failed to process request.',
          timestamp: Timestamp.now()
        });
        
        setActiveLeafId(sysRef.id);
        await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
           activeLeafId: sysRef.id
        });
      }
    } finally {
      setIsLoading(false);
      setProcessingAction(null);
      // Phase-17 safety net: guarantee the snapshot guard is cleared regardless
      // of which control-flow path sendMessage exits through.
      streamingSessionIdRef.current = null;
    }
  };

  const handleRegenerate = async (messageId: string) => {
    const aiMsg = messages.find((m: any) => m.id === messageId);
    if (!aiMsg || aiMsg.role !== 'model') return;
    
    const userMsg = messages.find((m: any) => m.id === aiMsg.parentId);
    if (!userMsg) return;
    
    await deleteMessageBranch(messageId, true);
    await sendMessage(null, undefined, userMsg.id);
  };

  const handleSyncProject = async () => {
    if (!user) return;
    
    const prefs = window.prompt(t('sync_preferences_prompt') || 'Any specific focus areas for sync? (optional)', '') || undefined;
    
    setIsLoading(true);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const newSessionRef = doc(collection(db, 'chatSessions'));
        targetSessionId = newSessionRef.id;
        await setDoc(newSessionRef, {
          userId: user.uid,
          title: t('sync_session_title') || 'Project Synchronization',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        setSessionId(targetSessionId);
      }

      const payload = generateSyncPrompt(prefs);
      const formattedPayload = `\`\`\`markdown [COPY THIS TO ANTIGRAVITY IDE]\n${payload}\n\`\`\``;

      const aiMsgRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'model',
        content: formattedPayload,
        timestamp: Timestamp.now(),
        parentId: activeLeafId
      });

      setActiveLeafId(aiMsgRef.id);

      await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
        activeLeafId: aiMsgRef.id,
        updatedAt: Timestamp.now(),
        ...(!sessionId ? { title: t('sync_session_title') || 'Project Synchronization' } : {})
      });
      
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(payload);
          window.alert(t('sync_copied_toast') || 'Sync prompt copied to clipboard!');
        }
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }

    } catch (error) {
      console.error('Failed to sync project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLanguageName = (val: string, globalDef: string) => {
    if (val === 'default') return `${t('default')} (${savedLanguages.find(l => l.value === globalDef)?.name || globalDef || 'en-US'})`;
    return savedLanguages.find(l => l.value === val)?.name || val;
  };

  const getIdeName = (val: string) => {
    if (val === 'default') return `${t('default')} (${globalDefaults.targetIde || 'VS Code'})`;
    return savedIdes.find(i => i.value === val)?.name || val;
  };

  const getComplexityName = (val: string, globalDef: string) => {
    if (val === 'default') {
      const mode = customModes.find(m => m.id === globalDef);
      const name = mode ? (mode.isPremade ? t(mode.name.toLowerCase()) || mode.name : mode.name) : globalDef;
      return `${t('default')} (${name})`;
    }
    const mode = customModes.find(m => m.id === val);
    if (!mode) return val;
    // Map premade modes to translation strings if applicable
    if (mode.isPremade) {
      const translationKey = mode.name.toLowerCase();
      const translated = t(translationKey);
      if (translated !== translationKey) return translated;
    }
    return mode.name;
  };

  const getInstructionName = (val: string) => {
    if (val === 'default') return 'Default';
    return savedInstructions.find(i => i.content === val)?.title || val;
  };

  const resolveTitle = (title?: string) => {
    if (!title) return t('new_session');
    if (title === 'sync_session_title' || title === 'Project Synchronization') return t('sync_session_title');
    return title;
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`border-e border-zinc-800/50 bg-muted/10 flex-col hidden md:flex transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 opacity-100 flex-none' : 'w-0 opacity-0 overflow-hidden border-none'}`}>
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Nexus Logo" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <h1 className="text-lg font-light tracking-[0.2em] uppercase leading-none">NEXUS</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen?.(!isSidebarOpen)} className="text-muted-foreground shrink-0 w-8 h-8">
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-4 border-b border-zinc-800/50 flex flex-col gap-3 shrink-0">
          <Button onClick={createNewSession} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 me-2" /> {t('new_chat')}
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={globalDefaults?.userLang?.startsWith('ar') ? 'البحث في المحادثات...' : 'Search chats...'} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-background/50 border-zinc-800/50 h-9 text-sm"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {searchQuery ? (
              searchResults.length > 0 ? (
                searchResults.map(result => (
                  <div 
                    key={result.sessionId}
                    onClick={() => {
                      setSessionId(result.sessionId);
                      setMessageLimit(50);
                      setSearchQuery(''); // clear query
                    }} 
                    className={`w-full text-start p-3 rounded-lg transition-colors flex flex-col gap-1 cursor-pointer group hover:bg-muted/50 hover:text-foreground ${sessionId === result.sessionId ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                  >
                    <div className="font-medium truncate text-sm text-foreground">{resolveTitle(result.title)}</div>
                    <div className="text-xs italic truncate opacity-80">{result.matchedSnippet}</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                  {isSearching ? (t('searching') || 'Searching...') : (t('no_results') || 'No results found.')}
                </div>
              )
            ) : (
              sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => {
                  setSessionId(session.id);
                  setMessageLimit(50);
                }} 
                className={`w-full text-start p-3 rounded-lg transition-colors flex items-center gap-3 cursor-pointer group ${sessionId === session.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <div className="overflow-hidden flex-1">
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Input 
                        value={editTitle} 
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveSessionTitle(session.id);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        autoFocus
                        className="h-6 text-sm px-1 py-0 bg-background border-border"
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => saveSessionTitle(session.id)}>
                        <Check className="w-3 h-3 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingSessionId(null)}>
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {session.isPinned && (
                          <Pin
                            className="w-3 h-3 text-primary shrink-0 fill-current"
                            aria-label={globalDefaults?.userLang?.startsWith('ar') ? 'مثبّتة' : 'Pinned'}
                          />
                        )}
                        <div className="font-medium truncate text-sm">{resolveTitle(session.title)}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center rounded-md h-6 w-6 shrink-0 bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinSession(session.id);
                              }}
                            >
                              <Pin className={`w-4 h-4 me-2 ${session.isPinned ? 'fill-current text-primary' : ''}`} />
                              {session.isPinned
                                ? (globalDefaults?.userLang?.startsWith('ar') ? 'إلغاء التثبيت' : 'Unpin')
                                : (t('pin_chat') || 'Pin')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(session.id);
                                setEditTitle(session.title);
                              }}
                            >
                              <Pencil className="w-4 h-4 me-2" /> {t('edit_chat')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionToDelete(session.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 me-2" /> {t('delete_chat')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                  <div className="text-xs opacity-70 truncate">
                    <RelativeTime date={session.updatedAt?.toDate ? session.updatedAt.toDate() : null} lang={i18n.language} fallback={t('just_now')} />
                  </div>
                </div>
              </div>
            )))}
          </div>
        </ScrollArea>
        
        {/* Bottom User Controls */}
        <div className="mt-auto border-t border-border/50 p-4 shrink-0 bg-background/50">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} alt={t('avatar') || 'Avatar'} className="w-9 h-9 rounded-full border border-border shrink-0" referrerPolicy="no-referrer" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate w-full text-foreground">{user.displayName}</span>
              <span className="text-xs text-muted-foreground truncate w-full">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 w-full">
            <GlobalSettings />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md w-9 h-9 shrink-0 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
                <Globe className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage('ar')}>العربية</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="w-9 h-9 text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col h-full min-w-0 relative transition-all duration-300 ease-in-out"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 shrink-0">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen?.(true)} className="text-muted-foreground hover:text-foreground md:flex shrink-0 w-8 h-8 -ms-2">
                <PanelLeftOpen className="w-4 h-4" />
              </Button>
            )}
            <div className="flex flex-col">
              <div className="font-semibold flex items-center gap-2">
                {resolveTitle(sessions.find((s: any) => s.id === sessionId)?.title)}
              </div>
            {sessions.find(s => s.id === sessionId) || globalDefaults.globalTechStack?.length ? (
              <div className="flex items-center gap-1 mt-1">
                {(() => {
                  const s = sessions.find(s => s.id === sessionId);
                  const stackIds = s?.techStack?.length > 0 ? s.techStack : globalDefaults.globalTechStack;
                  return stackIds?.map((id: string) => {
                    const tech = TECH_STACKS.find(t => t.id === id);
                    if (!tech) return null;
                    const Icon = tech.icon;
                    return (
                      <span key={id} title={tech.label}>
                        <Icon className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-200 transition-colors" />
                      </span>
                    );
                  });
                })()}
                {sessions.find(s => s.id === sessionId)?.githubRepo && (
                  <a href={sessions.find(s => s.id === sessionId)?.githubRepo} target="_blank" rel="noopener noreferrer" className="ms-2">
                    <Github className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300 transition-colors" />
                  </a>
                )}
              </div>
            ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showLocalSearch ? (
              <Button variant="ghost" size="icon" onClick={() => setShowLocalSearch(true)} className="text-muted-foreground hover:text-foreground">
                <Search className="w-5 h-5" />
              </Button>
            ) : (
              <div className="flex items-center bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 h-9 w-64 transition-all">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  placeholder={globalDefaults?.userLang?.startsWith('ar') ? 'بحث في المحادثة...' : 'Find in chat...'}
                  className="border-0 bg-transparent h-8 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-sm w-full"
                  autoFocus
                />
                {searchMatches.length > 0 && (
                  <div className="flex items-center gap-0.5 mx-1 shrink-0">
                    <span className="text-[10px] tabular-nums text-muted-foreground mr-1 whitespace-nowrap">
                      {activeMatchIndex + 1} / {searchMatches.length}
                    </span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-sm hover:bg-zinc-800" onClick={handlePrevMatch}>
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-sm hover:bg-zinc-800" onClick={handleNextMatch}>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-full hover:bg-zinc-800 ml-0.5" onClick={() => { setShowLocalSearch(false); setLocalSearchQuery(''); }}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
            <IssuesPanel issues={sessions.find(s => s.id === sessionId)?.issuesScratchpad || []} sessionId={sessionId} />
            {/* Executive Summary trigger button — always mounted, sidebar chunk is lazy. */}
            {(() => {
              const currentSession = sessions.find((s: any) => s.id === sessionId);
              const hasSummary = !!(currentSession?.longTermMemory && currentSession.longTermMemory.trim().length > 0);
              const useArabicLayout = !!globalDefaults?.userLang?.startsWith('ar');
              const updatedAtMs = currentSession?.longTermMemoryUpdatedAt?.toMillis?.() ?? null;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsSummarySidebarOpen(true)}
                    aria-label={useArabicLayout ? 'فتح الملخص التنفيذي' : 'Open executive summary'}
                    title={useArabicLayout ? 'الملخص التنفيذي' : 'Executive summary'}
                    className="group relative w-10 h-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
                  >
                    <BookText className={`w-5 h-5 transition-all ${hasSummary ? 'text-primary' : ''}`} aria-hidden="true" />
                    {hasSummary && (
                      <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                  </button>
                  {isSummarySidebarOpen && (
                    <Suspense fallback={null}>
                      <ExecutiveSummarySidebar
                        isOpen={isSummarySidebarOpen}
                        onClose={() => setIsSummarySidebarOpen(false)}
                        summary={currentSession?.longTermMemory || ''}
                        graph={currentSession?.knowledgeGraph || null}
                        updatedAt={updatedAtMs ? new Date(updatedAtMs) : null}
                        isArabic={useArabicLayout}
                      />
                    </Suspense>
                  )}
                </>
              );
            })()}
            <Sheet open={isSparksOpen} onOpenChange={setIsSparksOpen}>
              <SheetTrigger>
                <div role="button" aria-label="Sparks" className="group relative w-10 h-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Lightbulb className={`w-5 h-5 transition-all ${
                    (sessions.find(s => s.id === sessionId)?.sparks || []).filter((s: Spark) => s.status !== 'deployed').length > 0 
                      ? 'text-yellow-400 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' 
                      : 'group-hover:text-yellow-400'
                  }`} />
                </div>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto custom-scrollbar bg-zinc-950 border-s border-zinc-800">
                <SheetHeader>
                  <SheetTitle className="text-xl font-bold flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    {t('sparks_title') || 'Sparks'}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-6">
                  {/* Create New Spark */}
                  <div className="flex flex-col">
                    <TextareaAutosize 
                      value={newSparkText} 
                      onChange={(e) => setNewSparkText(e.target.value)}
                      placeholder={t('new_spark') || 'Draft a new thought...'}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm placeholder:text-zinc-500 w-full resize-none"
                      minRows={3}
                    />
                    <button 
                      type="button"
                      onClick={handleAddSpark}
                      disabled={!newSparkText.trim()} 
                      className="mt-2 w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" /> {t('add_spark')}
                    </button>
                    {(messages.length > 2 || (sessions.find(s => s.id === sessionId)?.techStack?.length > 0) || !!sessions.find(s => s.id === sessionId)?.githubRepo) && (
                      <button 
                        onClick={generateAutoSparks} 
                        disabled={isGeneratingSparks}
                        className="w-full mt-3 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 py-2 rounded-lg text-sm font-medium transition-all"
                      >
                        <Sparkles className={`h-4 w-4 ${isGeneratingSparks ? 'animate-pulse' : ''}`} />
                        {isGeneratingSparks ? t('generating_sparks') || 'Brainstorming...' : t('suggest_sparks') || 'Auto-Suggest Ideas'}
                      </button>
                    )}
                  </div>

                  {/* Spark List */}
                  <div className="flex flex-col gap-3">
                    {(sessions.find(s => s.id === sessionId)?.sparks || []).slice().reverse().map((spark: Spark) => (
                      <div key={spark.id} className="relative bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 shadow-sm hover:border-zinc-700 transition-colors group">
                        <div className="flex justify-between items-start gap-4">
                          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${spark.status === 'deployed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                            {spark.text}
                          </p>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-destructive" onClick={() => handleDeleteSpark(spark.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {spark.status !== 'deployed' && (
                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/50">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex-1"
                              onClick={() => handleEnhanceSpark(spark.text, spark.id)}
                              disabled={isEnhancingSparkId === spark.id}
                            >
                              {isEnhancingSparkId === spark.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1 text-purple-400" />}
                              {t('enhance_spark') || 'Enhance Idea'}
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="h-7 text-xs flex-1 bg-primary/20 text-primary hover:bg-primary/30"
                              onClick={() => handleDeploySpark(spark.text, spark.id)}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              {t('deploy_spark') || 'Send to Chat'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {(sessions.find(s => s.id === sessionId)?.sparks || []).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-48 text-center px-4 mt-10">
                        <div className="h-12 w-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                          <Lightbulb className="h-6 w-6 text-zinc-500" />
                        </div>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                          {t('empty_sparks') || 'Your scratchpad is empty. Jot down a brilliant idea!'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Dialog>
              <DialogTrigger render={<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" />}>
                <Settings className="w-5 h-5" />
              </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="pe-8">{t('session_settings')}</DialogTitle>
                <DialogDescription>
                  {t('session_settings_desc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('user_output_language')}</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>{t('user_output_desc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={(sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.userLang || 'default'} 
                    onValueChange={(v) => updateChatSettings({ userLang: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full bg-zinc-900/50 border-zinc-800 text-start">
                      <SelectValue placeholder={t('user_output_language')}>
                        {getLanguageName((sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.userLang || 'default', globalDefaults.userLang)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('default')} ({savedLanguages.find(l => l.value === globalDefaults.userLang)?.name || globalDefaults.userLang || 'en-US'})</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('official_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                      </SelectGroup>
                      {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>{t('my_custom_languages')}</SelectLabel>
                            {savedLanguages.filter(lang => !lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('ide_prompt_language')}</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>{t('ide_prompt_desc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={(sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.ideLang || 'default'} 
                    onValueChange={(v) => updateChatSettings({ ideLang: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full bg-zinc-900/50 border-zinc-800 text-start">
                      <SelectValue placeholder={t('ide_prompt_language')}>
                        {getLanguageName((sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.ideLang || 'default', globalDefaults.ideLang)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('default')} ({savedLanguages.find(l => l.value === globalDefaults.ideLang)?.name || globalDefaults.ideLang || 'en-US'})</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('official_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                      </SelectGroup>
                      {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>{t('my_custom_languages')}</SelectLabel>
                            {savedLanguages.filter(lang => !lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('target_ide')}</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>{t('target_ide_desc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={(sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.targetIde || 'default'} 
                    onValueChange={(v) => updateChatSettings({ targetIde: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full bg-zinc-900/50 border-zinc-800 text-start">
                      <SelectValue placeholder={t('target_ide')}>
                        {getIdeName((sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.targetIde || 'default')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('default')} ({globalDefaults.targetIde || 'VS Code'})</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('official_defaults')}</SelectLabel>
                        {savedIdes.filter(ide => ide.isDefault).map(i => <SelectItem key={i.id} value={i.value}>{i.name}</SelectItem>)}
                      </SelectGroup>
                      {savedIdes.filter(ide => !ide.isDefault).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>{t('my_custom_ides')}</SelectLabel>
                            {savedIdes.filter(ide => !ide.isDefault).map(i => <SelectItem key={i.id} value={i.value}>{i.name}</SelectItem>)}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('complexity_mode')}</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>{t('complexity_mode_desc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={(sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.complexityMode || 'default'} 
                    onValueChange={(v) => updateChatSettings({ complexityMode: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full bg-zinc-900/50 border-zinc-800 text-start">
                      <SelectValue>
                        {getComplexityName((sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.complexityMode || 'default', globalDefaults.complexityMode)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('default')}</SelectItem>
                      {customModes.map(m => <SelectItem key={m.id} value={m.id}>{m.isPremade ? t(m.name.toLowerCase()) : m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('custom_instructions')}</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>{t('custom_instructions_desc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={sessions.find(s => s.id === sessionId)?.customInstructions || 'default'} 
                    onValueChange={(v) => updateChatSettings({ customInstructions: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full bg-zinc-900/50 border-zinc-800 text-start">
                      <SelectValue placeholder={t('custom_instructions')}>
                        {getInstructionName(sessions.find(s => s.id === sessionId)?.customInstructions || 'default')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      {savedInstructions.map(i => <SelectItem key={i.id} value={i.content}>{i.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('ai_model')}</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>{t('ai_model_desc')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={model} onValueChange={(v: any) => setModel(v)}>
                    <SelectTrigger className="w-full bg-zinc-900/50 border-zinc-800 text-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="gemini-3.1-pro-preview">{t('model_pro')}</SelectItem>
                      <SelectItem value="gemini-3-flash-preview">{t('model_flash')}</SelectItem>
                      <SelectItem value="gemini-3.1-flash-lite-preview">{t('model_flash_lite')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 border-t border-zinc-800/50 pt-4">
                  <h3 className="text-sm font-medium text-foreground">{t('tech_stack') || 'Tech Stack'}</h3>
                  <TechStackSelector 
                    selected={(sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.techStack || []} 
                    onChange={(v) => updateChatSettings({ techStack: v })}
                  />
                  
                  <div className="space-y-2 mt-4">
                    <Label>{t('github_repo') || 'GitHub Repository'}</Label>
                    <Input 
                      placeholder="https://github.com/user/repo"
                      value={(sessionId ? sessions.find((s: any) => s.id === sessionId) : pendingSettings)?.githubRepo || ''}
                      onChange={(e) => updateChatSettings({ githubRepo: e.target.value })}
                      className="bg-zinc-900/50 border-zinc-800"
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary m-4 rounded-xl transition-all duration-200">
            <div className="flex flex-col items-center gap-4 text-primary pointer-events-none">
              <div className="bg-primary/20 p-6 rounded-full">
                <UploadCloud className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-bold">{t('drop_files')}</h3>
              <p className="text-muted-foreground text-sm">{t('drop_files_desc')}</p>
            </div>
          </div>
        )}
        {/* Distilled Memory Mirror: pinned above the scrollable feed. The chunk only
            loads when the current session has a non-empty projectSummary. */}
        {(() => {
          const currentSessionSummary = (sessions.find((s: any) => s.id === sessionId)?.projectSummary || '').trim();
          if (!currentSessionSummary) return null;
          const useArabicLayout = !!globalDefaults?.userLang?.startsWith('ar');
          return (
            <Suspense fallback={null}>
              <DistilledMemoryMirror summary={currentSessionSummary} isArabic={useArabicLayout} />
            </Suspense>
          );
        })()}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-6 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
          ref={scrollRef}
          onScroll={handleScroll}
        >
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-10 max-w-lg mx-auto flex flex-col items-center">
            <img src="/logo.png" alt="Nexus Logo" className="h-16 w-16 opacity-80 mx-auto mb-4" />
            <p>{t('welcome')}</p>
            <p className="text-sm mb-8">{t('welcome_desc')}</p>
            <Button variant="outline" className="gap-2 bg-background hover:bg-muted font-medium py-6 px-6 rounded-xl border-zinc-800 shadow-sm" onClick={handleSyncProject} disabled={isLoading}>
              <FolderSync className="w-5 h-5 text-primary" />
              {t('sync_existing')}
            </Button>
          </div>
        )}
        <div id="load-more-trigger" ref={loadMoreRef} className="h-4 w-full flex justify-center items-center my-2">
            {messages.length >= messageLimit && messages.length > 0 && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
        {[...activeThread].map((msg: any) => (
          <MessageBubble 
            key={msg.id} 
            msg={msg} 
            user={user} 
            sessionId={sessionId} 
            sessions={sessions} 
            globalDefaults={globalDefaults} 
            isArabic={isArabic} 
            t={t} 
            messages={messages}
            activeLeafId={activeLeafId}
            setActiveLeafId={setActiveLeafId}
            onEditSubmit={(content: string) => sendMessage(msg.parentId, content)}
            onDelete={deleteMessageBranch}
            onRegenerate={handleRegenerate}
            localSearchQuery={localSearchQuery}
            isActiveSearchMatch={msg.id === searchMatches[activeMatchIndex]}
          />
        ))}
        {processingAction && <LoadingBubble action={processingAction} />}
        {isDistilling && !processingAction && <LoadingBubble action="distilling" />}
      </div>
      {isScrolledUp && (
        <div className="absolute bottom-32 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <button
            onClick={() => {
              setIsScrolledUp(false);
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 text-sm pointer-events-auto"
          >
            <ArrowDown size={16} />
            <span>Scroll to bottom</span>
          </button>
        </div>
      )}
      <div className="px-4 pb-3 pt-2 flex flex-col gap-1">
        <div className="max-w-4xl mx-auto w-full rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 shadow-2xl p-2 flex flex-col gap-2 focus-within:ring-0 focus-within:ring-offset-0 focus-within:outline-none">
          {selectedFiles.length > 0 && (
            <div className="flex items-center gap-2 mb-2 overflow-x-auto custom-scrollbar pb-2 pt-2 px-1">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="relative shrink-0 group">
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt={`Preview ${idx}`} 
                    className="h-16 w-16 object-cover rounded-lg border border-zinc-700 pointer-events-none" 
                  />
                  <button
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-2 -right-2 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:border-red-500/50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col w-full">
            {activeTool && (
              <div className="bg-primary/20 text-primary px-3 py-1 rounded-full flex items-center gap-2 text-xs font-medium w-fit mb-2 mt-1 ms-2 border border-primary/30 shadow-lg">
                <Wand2 className="w-3 h-3" />
                {activeTool === 'image' ? (t('generate_image') || 'Generate Image') : activeTool === 'search' ? (t('search_web') || 'Search Web') : (t('text_to_speech') || 'Text-to-Speech')}
                <button type="button" onClick={() => setActiveTool(null)} className="hover:text-foreground hover:bg-background/20 rounded-full p-0.5 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {globalDefaults.enableDualMode && !activeTool && (
              <div className="flex items-center gap-1 mb-2 bg-zinc-900/80 p-1 rounded-lg w-fit border border-zinc-800 shadow-sm ms-1 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('user')}
                  title={t('user_note')}
                  className={`p-1.5 rounded-md transition-all flex items-center justify-center ${activeTab === 'user' ? 'bg-zinc-800 shadow-sm ring-1 ring-zinc-700/50' : 'opacity-50 hover:opacity-100 hover:bg-zinc-800/50'}`}
                >
                  <img src={user?.photoURL || '/default-avatar.png'} alt="User" className="h-5 w-5 rounded-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ide')}
                  title={t('ide_payload')}
                  className={`p-1.5 rounded-md transition-all flex items-center justify-center ${activeTab === 'ide' ? 'bg-primary/20 text-primary shadow-sm ring-1 ring-primary/30' : 'text-zinc-500 hover:text-primary hover:bg-zinc-800/50'}`}
                >
                  <Terminal className="h-5 w-5" />
                </button>
              </div>
            )}
            {/* Phase 15 — Proactive Next Action pill. Renders above the input only
                when the most recent AI response yielded a non-empty suggestion.
                Clicking populates the user-note input and dismisses the pill. */}
            {nextActionSuggestion && activeTab === 'user' && (
              <NextActionPill
                suggestion={nextActionSuggestion}
                isArabic={!!globalDefaults?.userLang?.startsWith('ar')}
                onClick={() => {
                  setInput(nextActionSuggestion);
                  setNextActionSuggestion(null);
                  // Focus the textarea so the user can immediately refine or press Enter.
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
              />
            )}
            {/* Phase 10 — Input telemetry + compress button. The wrapper row only
                mounts once the active input crosses 50% of the 90k limit; the
                CompressPayloadButton itself mounts at 80% per its internal gate. */}
            {(() => {
              const activeLen = activeTab === 'user' ? input.length : ideText.length;
              if (activeLen < MAX_INPUT_CHARS * 0.5) return null;
              const useArabicLayout = !!globalDefaults?.userLang?.startsWith('ar');
              return (
                <div className="flex items-center gap-2 mb-2 ms-2" dir={useArabicLayout ? 'rtl' : 'ltr'}>
                  <InputTelemetry length={activeLen} />
                  <CompressPayloadButton
                    length={activeLen}
                    onClick={handleCompressPayload}
                    isCompressing={isCompressing}
                    isArabic={useArabicLayout}
                  />
                </div>
              );
            })()}
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-center w-full">
              <DropdownMenu>
                  <DropdownMenuTrigger className={`inline-flex items-center justify-center rounded-md w-8 h-8 shrink-0 transition-opacity outline-none cursor-pointer hover:bg-muted ${activeTool ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Wand2 className="w-5 h-5" />
                  </DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 mb-2 bg-popover border-border w-56 flex flex-col gap-1 rounded-xl shadow-xl z-50">
                  <DropdownMenuItem onClick={() => setActiveTool('image')} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-primary/20 focus:bg-primary/20 focus:text-primary transition-all">
                    <ImageIcon className="w-4 h-4 text-primary" /> {t('generate_image') || 'Generate Image'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTool('search')} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-emerald-500/20 focus:bg-emerald-500/20 focus:text-emerald-500 transition-all">
                    <Globe className="w-4 h-4 text-emerald-500" /> {t('search_web') || 'Search Web'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTool('tts')} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-amber-500/20 focus:bg-amber-500/20 focus:text-amber-500 transition-all">
                    <Volume2 className="w-4 h-4 text-amber-500" /> {t('text_to_speech') || 'Text-to-Speech'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 text-muted-foreground hover:text-foreground hover:opacity-80 transition-opacity">
                <Paperclip className="w-5 h-5" />
              </Button>
            <Button 
              type="button" 
              tabIndex={-1}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              variant="ghost" 
              size="icon" 
              onClick={toggleListening} 
              className={`shrink-0 hover:opacity-80 transition-opacity ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
              title={isListening ? "Stop listening" : "Start dictation"}
            >
              <Mic className="w-5 h-5" />
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
            <div className="relative flex-1">
              <InputGhostOverlay
                input={activeTab === 'user' ? input : ''}
                suggestion={activeTab === 'user' ? ghostSuggestion : ''}
              />
            <TextareaAutosize
              ref={textareaRef}
              dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
              value={activeTab === 'user' ? input : ideText}
              onPaste={handlePaste}
              onChange={(e) => {
                // Dismiss any active Next Action suggestion the moment the user
                // starts typing — the pill is transient context, not a modal.
                if (nextActionSuggestion) setNextActionSuggestion(null);
                if (activeTab === 'user') {
                  setInput(e.target.value);
                } else {
                  setIdeText(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                // Ghost-text commit: Tab accepts the suggestion when one is visible.
                if (e.key === 'Tab' && ghostSuggestion && activeTab === 'user') {
                  e.preventDefault();
                  setInput(prev => prev + ghostSuggestion);
                  setGhostSuggestion('');
                  return;
                }
                // Escape dismisses the suggestion without committing.
                if (e.key === 'Escape' && ghostSuggestion) {
                  e.preventDefault();
                  setGhostSuggestion('');
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault(); // Prevent newline
                  
                  // STAGE 1: We are actively listening
                  if (isListening) {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                    isListeningRef.current = false;
                    
                    // Wait a tick for React state to update the input with the final transcript
                    setTimeout(async () => {
                      if (textareaRef.current) {
                        // Steal focus from the mic button and highlight everything
                        textareaRef.current.focus();
                        textareaRef.current.select();
                        
                        // Conditionally copy to clipboard based on user settings
                        if (globalDefaults.autoCopyVoice && textareaRef.current.value.trim()) {
                          try {
                            await navigator.clipboard.writeText(textareaRef.current.value);
                          } catch (err) {
                            console.error("Failed to auto-copy:", err);
                          }
                        }
                      }
                    }, 150); 
                    
                    return; // Abort here. Do not send the message yet.
                  }

                  // STAGE 2: Not listening, act as a normal submit
                  if (!isLoading && (input.trim() || ideText.trim() || selectedFiles.length > 0)) {
                    sendMessage();
                  }
                }
              }}
              placeholder={isForeshadowing ? t('initializing') || 'Nexus is connecting...' : activeTool === 'image' ? 'Describe the image...' : activeTool === 'search' ? 'What do you want to search?' : activeTool === 'tts' ? 'What should I say?' : (activeTab === 'ide' ? (t('ide_payload') || 'Paste IDE Context/Code...') : t('ask_nexus'))} 
              className={`relative bg-transparent border-none text-foreground shadow-none w-full resize-none break-words whitespace-pre-wrap overflow-x-hidden overflow-y-auto py-2 text-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none ${activeTab === 'ide' ? 'font-mono text-zinc-300 text-[0.8rem]' : ''} ${isForeshadowing ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading || isForeshadowing}
              minRows={1}
              maxRows={8}
            />
            </div>
            {isLoading ? (
              <Button type="button" onClick={stopGeneration} className="bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 shrink-0 rounded-xl transition-colors group" title="Stop generating">
                <Square className="w-4 h-4 fill-current transition-transform group-hover:scale-90" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading || isForeshadowing || (!input.trim() && !ideText.trim() && selectedFiles.length === 0)} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 rounded-xl hover:opacity-80 transition-opacity">
                <Send className="w-4 h-4" />
              </Button>
            )}
            </form>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-1 mb-0 opacity-70">
          {globalDefaults?.userLang?.startsWith('ar') 
            ? 'نكسس هو ذكاء اصطناعي وقد يرتكب أخطاء.' 
            : 'Nexus is AI and can make mistakes.'}
        </p>
      </div>
      </div>

      <Dialog open={!!sessionToDelete} onOpenChange={(open: boolean) => !open && setSessionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_session_title')}</DialogTitle>
            <DialogDescription>
              {t('delete_session_desc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToDelete(null)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={deleteSession}>{t('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
