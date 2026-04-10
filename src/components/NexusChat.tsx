import { useState, useEffect, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, where, updateDoc, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { chatWithNexus, generateImage, searchGrounding, textToSpeech, analyzeMedia, transcribeAudio, fastTask } from '../lib/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { Send, Bot, User as UserIcon, Loader2, Paperclip, X, Image as ImageIcon, Mic, Search, Video, Plus, MessageSquare, Pencil, Check, Trash2, Download, UploadCloud, Play, Settings, Info, FolderSync, Copy, Wand2, Globe, Volume2, MoreVertical, Pin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import Markdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from './ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';
import { TechStackSelector, TECH_STACKS } from './TechStackSelector';
import { Github } from 'lucide-react';

export interface Spark {
  id: string;
  text: string;
  attachments: string[];
  status: 'draft' | 'enhanced' | 'deployed';
  createdAt: number;
}

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

function MessageCopyButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800 rounded-md transition-all duration-200"
      title="Copy message"
    >
      {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ActionableCodeBlock({ payload, targetIde, userId }: { payload: string, targetIde: string, userId: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const { globalDefaults: settings } = useSettings();

  const sizeClass = settings.fontSize === 'small' ? 'text-sm' : settings.fontSize === 'large' ? 'text-lg' : 'text-base';
  const fontStyle = settings.fontFamily === 'cairo' ? { fontFamily: "'Cairo', sans-serif" } : settings.fontFamily === 'tajawal' ? { fontFamily: "'Tajawal', sans-serif" } : {};

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy payload:', error);
    }
  };

  return (
    <Card className="my-4 border-border bg-zinc-950 overflow-hidden shadow-lg h-auto">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
          <span className="ms-2 text-xs font-mono text-zinc-400">IDE Payload</span>
        </div>
        <Button 
          size="sm" 
          variant="secondary"
          className="h-7 text-xs gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          onClick={handleCopy}
          disabled={isCopied}
        >
          {isCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Payload</>}
        </Button>
      </div>
      <CardContent className="p-0 flex flex-col h-auto">
        <pre 
          className={`p-4 pb-6 text-zinc-300 whitespace-pre-wrap break-words ${sizeClass}`}
          style={fontStyle}
        >
          {payload}
        </pre>
      </CardContent>
    </Card>
  );
}

function RelativeTime({ date, lang, fallback }: { date: Date | null, lang: string, fallback: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!date) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!date) return <>{fallback}</>;

  const getRelativeTime = (d: Date, l: string) => {
    const rtf = new Intl.RelativeTimeFormat(l, { numeric: 'auto', style: 'short' });
    const diffInSeconds = (d.getTime() - Date.now()) / 1000;
    
    if (Math.abs(diffInSeconds) < 60) return rtf.format(Math.round(diffInSeconds), 'second');
    const diffInMinutes = diffInSeconds / 60;
    if (Math.abs(diffInMinutes) < 60) return rtf.format(Math.round(diffInMinutes), 'minute');
    const diffInHours = diffInMinutes / 60;
    if (Math.abs(diffInHours) < 24) return rtf.format(Math.round(diffInHours), 'hour');
    const diffInDays = diffInHours / 24;
    if (Math.abs(diffInDays) < 30) return rtf.format(Math.round(diffInDays), 'day');
    const diffInMonths = diffInDays / 30;
    if (Math.abs(diffInMonths) < 12) return rtf.format(Math.round(diffInMonths), 'month');
    const diffInYears = diffInDays / 365;
    return rtf.format(Math.round(diffInYears), 'year');
  };

  return <>{getRelativeTime(date, lang)}</>;
}

function LoadingBubble({ action }: { action: 'text' | 'image' | 'tts' | 'search' }) {
  const { t } = useTranslation();
  const text = action === 'text' ? t('loading_text') : action === 'tts' ? t('loading_tts') : action === 'image' ? t('loading_image') : t('loading_search');
  return (
    <div className="flex gap-4 p-4 md:p-6 w-full text-foreground border-b border-border">
      <Avatar className="w-8 h-8 rounded-lg shrink-0 outline outline-1 outline-border shadow-sm">
        <AvatarImage src="/logo.png" className="p-1.5" />
        <AvatarFallback className="bg-primary/20 text-primary">N</AvatarFallback>
      </Avatar>
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2 h-5 mt-1">
          <motion.div className="w-2 h-2 bg-primary rounded-full ms-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
          <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
          <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
          <span className="ms-3 text-xs font-medium bg-gradient-to-r from-teal-400 to-primary bg-clip-text text-transparent animate-pulse">{text}</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, user, sessionId, sessions, globalDefaults, isArabic, t, messages, activeLeafId, setActiveLeafId, onEditSubmit, onDelete }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  const content = msg.content;
  const isMsgArabic = isArabic(content);

  const siblings = messages ? messages.filter((m: any) => m.parentId === msg.parentId && m.role === msg.role) : [];
  if (siblings.length > 0) {
    siblings.sort((a: any, b: any) => {
      const tA = a.timestamp?.toMillis?.() || new Date(a.timestamp).getTime() || 0;
      const tB = b.timestamp?.toMillis?.() || new Date(b.timestamp).getTime() || 0;
      return tA - tB;
    });
  }
  const currentIndex = siblings.findIndex((m: any) => m.id === msg.id);

  const navigateBranch = (dir: number) => {
    const targetSibling = siblings[currentIndex + dir];
    if (!targetSibling) return;
    
    let currentDeepest = targetSibling.id;
    let keepSearching = true;
    while(keepSearching) {
      const children = messages.filter((m: any) => m.parentId === currentDeepest);
      if (children.length > 0) {
        children.sort((a: any, b: any) => {
           const tA = a.timestamp?.toMillis?.() || new Date(a.timestamp).getTime() || 0;
           const tB = b.timestamp?.toMillis?.() || new Date(b.timestamp).getTime() || 0;
           return tB - tA; // newest first
        });
        currentDeepest = children[0].id;
      } else {
        keepSearching = false;
      }
    }
    setActiveLeafId(currentDeepest);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      <Avatar className="w-8 h-8 shrink-0">
        {msg.role === 'user' ? (
          <>
            <AvatarImage src={user?.photoURL || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
          </>
        ) : msg.role === 'system' ? (
          <AvatarFallback className="bg-destructive text-destructive-foreground font-bold text-xs">!</AvatarFallback>
        ) : (
          <>
            <AvatarImage src="/logo.png" alt="Nexus" className="object-cover" />
            <AvatarFallback className="bg-teal-900 text-white font-bold text-xs">N</AvatarFallback>
          </>
        )}
      </Avatar>
      <div className={`relative max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : msg.role === 'system' ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-muted text-foreground'}`}>
        
        {siblings.length > 1 && (
          <div className={`flex items-center gap-2 mb-2 text-xs font-mono font-bold ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            <button onClick={() => navigateBranch(-1)} disabled={currentIndex === 0} className="hover:text-current disabled:opacity-30"> <ChevronLeft className="w-3 h-3" /> </button>
            <span>{currentIndex + 1} / {siblings.length}</span>
            <button onClick={() => navigateBranch(1)} disabled={currentIndex === siblings.length - 1} className="hover:text-current disabled:opacity-30"> <ChevronRight className="w-3 h-3" /> </button>
          </div>
        )}

        {msg.attachmentUrl && msg.attachmentType?.startsWith('image/') && (
          <Card className={`mb-3 overflow-hidden border-border bg-muted/30 ${msg.isUploading ? 'opacity-70 animate-pulse' : ''}`}>
            <CardContent className="p-2 relative group flex items-center justify-center">
              <img src={msg.attachmentUrl} alt="User attachment" className="max-w-full rounded-md" />
              {msg.isUploading && <Loader2 className="w-8 h-8 absolute text-primary animate-spin" />}
              {!msg.isUploading && (
                <a 
                  href={msg.attachmentUrl} 
                  download="generated-image.png" 
                  target="_blank" 
                  rel="noreferrer"
                  className="absolute top-4 end-4 bg-background/80 hover:bg-background p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <Download className="w-4 h-4 text-foreground" />
                </a>
              )}
            </CardContent>
          </Card>
        )}
        {msg.attachmentUrl && msg.attachmentType?.startsWith('audio/') && (
          <Card className="mb-3 border-border bg-muted/30">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-full shrink-0">
                <Mic className="w-4 h-4 text-primary" />
              </div>
              <audio src={msg.attachmentUrl} controls className="w-full h-10" />
            </CardContent>
          </Card>
        )}
        {msg.attachmentUrl && msg.attachmentType?.startsWith('video/') && (
          <Card className="mb-3 overflow-hidden border-border bg-muted/30">
            <CardContent className="p-2">
              <video src={msg.attachmentUrl} controls className="max-w-full rounded-md" />
            </CardContent>
          </Card>
        )}
        <div className="relative group/content">
          {isEditing ? (
             <div className="flex flex-col gap-2 min-w-[250px]">
                <TextareaAutosize 
                   value={editText}
                   onChange={e => setEditText(e.target.value)}
                   className="w-full bg-zinc-950/50 text-white rounded-md p-2 text-sm max-h-[300px]"
                />
                <div className="flex justify-end gap-2 mt-2">
                   <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditText(msg.content); }}>Cancel</Button>
                   <Button size="sm" onClick={() => { setIsEditing(false); onEditSubmit(editText); }}>Save & Submit</Button>
                </div>
             </div>
          ) : (
            <div dir={isMsgArabic ? "rtl" : "ltr"} className={`markdown-body prose ${msg.role === 'user' ? 'prose-invert prose-headings:text-primary-foreground prose-a:text-primary-foreground' : 'prose-invert'} max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 text-start`}>
              <Markdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const rawText = String(children).replace(/\n$/, '');
                    const meta = node?.data?.meta || '';
                    const isAntigravity = 
                      className?.includes('[COPY THIS TO ANTIGRAVITY IDE]') || 
                      meta.includes('[COPY THIS TO ANTIGRAVITY IDE]') ||
                      rawText.includes('[COPY THIS TO ANTIGRAVITY IDE]');
                    
                    if (!inline && isAntigravity) {
                      const payload = rawText.replace(/\[COPY THIS TO ANTIGRAVITY IDE\]/g, '').trim();
                      const currentSession = sessions.find((s: any) => s.id === sessionId);
                      const targetIde = currentSession?.targetIde || globalDefaults.targetIde;
                      return <ActionableCodeBlock payload={payload} targetIde={targetIde} userId={user.uid} />;
                    }
                    
                    return <code className={className} {...props}>{children}</code>;
                  }
                }}
              >
                {content}
              </Markdown>
            </div>
          )}
        </div>
        {!isEditing && (
          <div className={`absolute -bottom-4 ${msg.role === 'user' ? 'start-2' : 'end-2'} flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/90 rounded-md border shadow-sm p-1 gap-1`}>
            {msg.role === 'user' && (
               <>
                 <button onClick={() => setIsEditing(true)} className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800 rounded-md transition-all duration-200" title="Edit">
                   <Pencil className="w-3.5 h-3.5" />
                 </button>
                 <button 
                   onClick={(e) => { e.stopPropagation(); onDelete(msg.id); }}
                   className="p-1.5 text-zinc-400 hover:text-red-400 bg-zinc-800/50 hover:bg-red-500/10 rounded-md transition-all duration-200"
                   title={t('delete_message') || 'Delete'}
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                 </button>
               </>
            )}
            <MessageCopyButton text={content} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const generateSyncPrompt = (userPreferences?: string) => {
  const baseInstruction = `I am coordinating our workflow with Nexus. To ensure we stay synchronized, please generate a comprehensive current-state summary of the workspace. Include the latest updates on our modular architecture, the current status of the game logic and UI/UX polish, and any active system-level configurations.`;
  
  const ongoingRule = `Moving forward, please provide a brief exportable summary after major changes so I can easily keep Nexus in the loop.`;

  if (userPreferences && userPreferences.trim().length > 0) {
    return `${baseInstruction}\n\nUSER SPECIFIC PREFERENCES & FOCUS AREAS:\n"""\n${userPreferences.trim()}\n"""\n\n${ongoingRule}`;
  }

  return `${baseInstruction}\n\n${ongoingRule}`;
};

export function NexusChat({ user, isSidebarOpen = true }: { user: User; isSidebarOpen?: boolean }) {
  const { t, i18n } = useTranslation();
  const { savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults } = useSettings();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageLimit, setMessageLimit] = useState(50);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isFetchingMoreRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [processingAction, setProcessingAction] = useState<'text' | 'image' | 'tts' | 'search' | null>(null);
  const [model, setModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3-flash-preview' | 'gemini-3.1-flash-lite-preview'>('gemini-3.1-pro-preview');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreviewUrl(URL.createObjectURL(droppedFile));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
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
          setFile(pastedFile);
          setPreviewUrl(URL.createObjectURL(pastedFile));
        }
      }
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'chatSessions'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side to handle pending server timestamps
      fetchedSessions.sort((a: any, b: any) => {
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
        updatedAt: serverTimestamp()
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

  const saveSessionTitle = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'chatSessions', id), {
        title: editTitle.trim(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update session title', error);
    }
    setEditingSessionId(null);
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
      setMessages(prev => {
        const firestoreMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
        const optimisticMessages = prev.filter(m => m.id && m.id.toString().startsWith('temp-'));
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
              updatedAt: serverTimestamp()
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
      if (isNearBottom || messages.length <= 50) { 
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, isLoading]);

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

  const deleteMessageBranch = async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message and all its replies?")) return;

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

  const sendMessage = async (overrideParentId?: string | null, overrideInput?: string) => {
    const isOverride = overrideInput !== undefined;
    let userMessage = isOverride ? overrideInput : input;
    
    if ((!userMessage.trim() && !file) || isLoading) return;
    
    if (activeTool === 'image') userMessage = '/image ' + userMessage;
    else if (activeTool === 'search') userMessage = '/search ' + userMessage;
    else if (activeTool === 'tts') userMessage = '/tts ' + userMessage;

    const currentFile = file;
    const currentPreviewUrl = previewUrl;
    
    if (!isOverride) {
      setInput('');
      clearFile();
      setActiveTool(null);
    }
    setIsLoading(true);

    let targetSessionId = sessionId;

    try {
      if (!targetSessionId) {
        const newSessionRef = doc(collection(db, 'chatSessions'));
        targetSessionId = newSessionRef.id;
        await setDoc(newSessionRef, {
          userId: user.uid,
          title: t('new_chat') || 'New Chat',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...pendingSettings
        });
        await new Promise(r => setTimeout(r, 400)); // Delay listener attachment to allow strict firestore rule propagations
        setSessionId(targetSessionId);
        setPendingSettings({});
      } else {
        await updateDoc(doc(db, 'chatSessions', targetSessionId), {
          updatedAt: serverTimestamp()
        });
      }

      let finalAttachmentUrl = '';
      const tempUserMsgId = `temp-user-${Date.now()}`;
      
      const userParentId = overrideParentId !== undefined 
          ? overrideParentId 
          : (activeLeafId || (activeThread.length > 0 ? activeThread[activeThread.length - 1].id : null));

      if (currentFile && currentPreviewUrl) {
         setMessages(prev => [...prev, {
            id: tempUserMsgId,
            sessionId: targetSessionId,
            userId: user.uid,
            role: 'user',
            content: userMessage || `[Uploaded ${currentFile.type}]`,
            timestamp: new Date(),
            attachmentUrl: currentPreviewUrl,
            attachmentType: currentFile.type,
            isUploading: true,
            parentId: userParentId
         }]);
         setActiveLeafId(tempUserMsgId);

         const safeName = currentFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
         const attachmentRef = ref(storage, `users/${user.uid}/attachments/${Date.now()}_${safeName}`);
         await uploadBytes(attachmentRef, currentFile, { contentType: currentFile.type });
         finalAttachmentUrl = await getDownloadURL(attachmentRef);
      }

      // Save user message
      const userDocRef = doc(collection(db, `chatSessions/${targetSessionId}/messages`));
      
      await setDoc(userDocRef, {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'user',
        content: userMessage || (currentFile ? `[Uploaded ${currentFile.type}]` : ''),
        timestamp: serverTimestamp(),
        parentId: userParentId,
        ...(finalAttachmentUrl ? { attachmentUrl: finalAttachmentUrl, attachmentType: currentFile.type } : {})
      });
      
      setActiveLeafId(userDocRef.id);
      await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
         activeLeafId: userDocRef.id,
         updatedAt: serverTimestamp()
      });
      
      if (currentFile && currentPreviewUrl) {
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
      } else if (currentFile) {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(currentFile);
        });
        
        if (currentFile.type.startsWith('audio/')) {
          fullResponse = await transcribeAudio(base64Data, currentFile.type);
        } else {
          fullResponse = await analyzeMedia(base64Data, currentFile.type, userMessage || 'Describe this media.');
        }
      } else {
        // Standard Chat
        const history = activeThread.map(m => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })) as { role: 'user' | 'model', parts: { text: string }[] }[];

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

        const activeSettings = {
          userLang: activeSettingsData.userLang || globalDefaults.userLang,
          ideLang: activeSettingsData.ideLang || globalDefaults.ideLang,
          targetIde: activeSettingsData.targetIde || globalDefaults.targetIde,
          customInstructions: activeSettingsData.customInstructions || globalDefaults.customInstructions,
          complexityModeName: activeMode?.name,
          complexityModeRules: activeMode?.rules,
          techStackContext,
          githubRepo: activeSettingsData.githubRepo || '',
          sparksContext: ''
        };

        const activeSparks = (currentSession?.sparks || []).filter((s: Spark) => s.status !== 'deployed');
        if (activeSparks.length > 0) {
          const sparkTexts = activeSparks.map((s: Spark) => s.text).join(' | ');
          activeSettings.sparksContext = `[PRIVATE USER SPARKS]: The user has the following unsubmitted drafts/ideas: "${sparkTexts}". Use this to understand their deeper intent and align your responses to their overall goals. CRITICAL: DO NOT mention these sparks proactively. Act as if you don't know they exist unless the user directly brings them up.`;
        }

        const stream = await chatWithNexus(history, userMessage, model, activeSettings);
        setProcessingAction(null); // Clear loading spinner instantly
        
        const aiMsgId = `temp-ai-${Date.now()}`;
        setMessages(prev => [...prev, { id: aiMsgId, role: 'model', content: '', timestamp: null, parentId: userDocRef.id }]);
        setActiveLeafId(aiMsgId);

        let pendingBuffer = "";
        let displayedText = "";
        let isNetworkDone = false;

        const flushInterval = setInterval(() => {
          if (pendingBuffer.length > 0) {
            const charsToPull = pendingBuffer.substring(0, 3); 
            pendingBuffer = pendingBuffer.substring(3);
            displayedText += charsToPull;

            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === aiMsgId ? { ...msg, content: displayedText } : msg
              )
            );
          } else if (isNetworkDone) {
            clearInterval(flushInterval);
          }
        }, 15);

        try {
          for await (const chunk of stream) {
            if (chunk.text) {
              fullResponse += chunk.text;
              pendingBuffer += chunk.text;
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
        } finally {
          isNetworkDone = true;
        }

        // Suspend the main async function until the typewriter completely drains its buffer to UI
        await new Promise<void>((resolve) => {
          const checkDrain = setInterval(() => {
            if (isNetworkDone && pendingBuffer.length === 0) {
              clearInterval(checkDrain);
              resolve();
            }
          }, 30);
        });

        const aiDocRefResult = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'model',
          content: fullResponse,
          parentId: userDocRef.id,
          timestamp: serverTimestamp()
        });

        setActiveLeafId(aiDocRefResult.id);

        // Clean up the optimistic streaming message
        setMessages(prev => prev.filter(m => m.id !== aiMsgId));

        await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
          activeLeafId: aiDocRefResult.id,
          updatedAt: serverTimestamp()
        });
        
        setIsLoading(false);
        return; // Exit early since we already saved the message
      }

      // Save non-streamed response (slash commands, file analysis)
      const aiNonStreamRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'model',
        content: fullResponse,
        parentId: userDocRef.id,
        timestamp: serverTimestamp(),
        ...(attachmentUrl ? { attachmentUrl, attachmentType } : {})
      });

      setActiveLeafId(aiNonStreamRef.id);

      await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
        activeLeafId: aiNonStreamRef.id,
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Chat error:', error);
      if (targetSessionId) {
        const sysRef = await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'system',
          content: 'Error: Failed to process request.',
          timestamp: serverTimestamp()
        });
        
        setActiveLeafId(sysRef.id);
        await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
           activeLeafId: sysRef.id
        });
      }
    } finally {
      setIsLoading(false);
      setProcessingAction(null);
    }
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
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
        timestamp: serverTimestamp(),
        parentId: activeLeafId
      });

      setActiveLeafId(aiMsgRef.id);

      await updateDoc(doc(db, 'chatSessions', targetSessionId!), {
        activeLeafId: aiMsgRef.id,
        updatedAt: serverTimestamp(),
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
      <div className={`border-e border-zinc-800/50 bg-muted/10 flex-col hidden md:flex transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'}`}>
        <div className="p-4 border-b border-zinc-800/50">
          <Button onClick={createNewSession} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 me-2" /> {t('new_chat')}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map(session => (
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
                      <div className="font-medium truncate text-sm">{resolveTitle(session.title)}</div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center rounded-md h-6 w-6 shrink-0 bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem className="cursor-pointer opacity-50 cursor-not-allowed">
                              <Pin className="w-4 h-4 me-2" /> {t('pin_chat')}
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
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col h-full min-w-0 relative transition-all duration-300 ease-in-out"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
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

          <div className="flex items-center">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600" ref={scrollRef}>
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
          />
        ))}
        {processingAction && <LoadingBubble action={processingAction} />}
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="max-w-4xl mx-auto w-full mb-2 sm:mb-6 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 shadow-2xl p-2 flex flex-col gap-2 focus-within:ring-0 focus-within:ring-offset-0 focus-within:outline-none">
          {previewUrl && (
            <div className="relative inline-block w-24 h-24 ms-2 mt-2">
              {file?.type.startsWith('video/') ? (
                <video src={previewUrl} className="w-full h-full object-cover rounded-lg border border-zinc-800/50" />
              ) : file?.type.startsWith('audio/') ? (
                <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border border-zinc-800/50">
                  <Mic className="w-8 h-8 text-muted-foreground" />
                </div>
              ) : (
                <img src={previewUrl} className="w-full h-full object-cover rounded-lg border border-zinc-800/50" />
              )}
              <button onClick={clearFile} className="absolute -top-2 -end-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-80 transition-opacity">
                <X className="w-4 h-4" />
              </button>
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
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
            <TextareaAutosize 
              ref={textareaRef}
              dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
              value={input} 
              onPaste={handlePaste}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
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
                  if (!isLoading && (input.trim() || file)) {
                    sendMessage();
                  }
                }
              }}
              placeholder={activeTool === 'image' ? 'Describe the image...' : activeTool === 'search' ? 'What do you want to search?' : activeTool === 'tts' ? 'What should I say?' : t('ask_nexus')} 
              className="bg-transparent border-none text-foreground flex-1 shadow-none w-full resize-none break-words whitespace-pre-wrap overflow-x-hidden overflow-y-auto py-2 text-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
              disabled={isLoading}
              minRows={1}
              maxRows={8}
            />
            <Button type="submit" disabled={isLoading || (!input.trim() && !file)} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 rounded-xl hover:opacity-80 transition-opacity">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          </div>
        </div>
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
