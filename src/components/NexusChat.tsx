import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, where, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { chatWithNexus, generateImage, searchGrounding, textToSpeech, analyzeMedia, transcribeAudio, fastTask } from '../lib/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { Send, Bot, User as UserIcon, Loader2, Paperclip, X, Image as ImageIcon, Mic, Search, Video, Plus, MessageSquare, Pencil, Check, Trash2, Download, UploadCloud, Play, Settings, Info, FolderSync, Copy, Wand2, Globe, Volume2, MoreVertical, Pin, ChevronUp, ChevronDown } from 'lucide-react';
import Markdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

function ActionableCodeBlock({ payload, targetIde, userId }: { payload: string, targetIde: string, userId: string }) {
  const [isCopied, setIsCopied] = useState(false);

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
    <Card className="my-4 border-border bg-zinc-950 overflow-hidden shadow-lg">
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
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <pre className="p-4 text-sm font-mono text-zinc-300 whitespace-pre-wrap break-all">
            {payload}
          </pre>
        </ScrollArea>
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

function MessageBubble({ msg, user, isStreaming, streamingContent, sessionId, sessions, globalDefaults, isArabic, t }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const content = isStreaming ? streamingContent : msg.content;
  const isMsgArabic = isArabic(content);

  useEffect(() => {
    if (textRef.current) {
      setHasOverflow(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  }, [content]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
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
      <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : msg.role === 'system' ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-muted text-foreground'}`}>
        {msg.attachmentUrl && msg.attachmentType?.startsWith('image/') && (
          <Card className="mb-3 overflow-hidden border-border bg-muted/30">
            <CardContent className="p-2 relative group">
              <img src={msg.attachmentUrl} alt="Attachment" className="max-w-full rounded-md" />
              <a 
                href={msg.attachmentUrl} 
                download="generated-image.png" 
                target="_blank" 
                rel="noreferrer"
                className="absolute top-4 end-4 bg-background/80 hover:bg-background p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download className="w-4 h-4 text-foreground" />
              </a>
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
        <div className="relative">
          <div ref={textRef} dir={isMsgArabic ? "rtl" : "ltr"} className={`markdown-body prose ${msg.role === 'user' ? 'prose-invert prose-headings:text-primary-foreground prose-a:text-primary-foreground' : 'prose-invert'} max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 text-start ${!isExpanded ? 'line-clamp-5' : ''}`}>
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
          {hasOverflow && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className={`mt-2 flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors ${isMsgArabic ? 'flex-row-reverse' : ''}`}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{isExpanded ? (t('read_less') || 'Read less') : (t('read_more') || 'Read more')}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function NexusChat({ user, isSidebarOpen = true }: { user: User; isSidebarOpen?: boolean }) {
  const { t, i18n } = useTranslation();
  const { savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults } = useSettings();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
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

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingSettings, setPendingSettings] = useState<any>({});
  const [activeTool, setActiveTool] = useState<'image' | 'search' | 'tts' | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<string>(input);

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
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = globalDefaults.spokenLanguage || 'en-US';
        }
        recognitionRef.current?.start();
        setIsListening(true);
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
      return;
    }
    setMessages([]); // Clear buffer instantly on session switch
    const q = query(collection(db, `chatSessions/${sessionId}/messages`), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chatSessions/${sessionId}/messages`);
    });
    return () => unsubscribe();
  }, [sessionId]);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if ((!input.trim() && !file) || isLoading) return;
    
    let userMessage = input;
    if (activeTool === 'image') userMessage = '/image ' + userMessage;
    else if (activeTool === 'search') userMessage = '/search ' + userMessage;
    else if (activeTool === 'tts') userMessage = '/tts ' + userMessage;

    const currentFile = file;
    setInput('');
    clearFile();
    setActiveTool(null);
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

      // Save user message
      await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'user',
        content: userMessage || (currentFile ? `[Uploaded ${currentFile.type}]` : ''),
        timestamp: serverTimestamp(),
        ...(currentFile && previewUrl ? { attachmentUrl: previewUrl, attachmentType: currentFile.type } : {})
      });

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
        const history = messages.map(m => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })) as { role: 'user' | 'model', parts: { text: string }[] }[];

        const currentSession = sessions.find(s => s.id === targetSessionId);
        const activeSettingsData = currentSession || pendingSettings;
        
        // Find the active complexity mode object
        const activeModeId = activeSettingsData.complexityMode || globalDefaults.complexityMode;
        const activeMode = customModes.find(m => m.id === activeModeId) || customModes.find(m => m.id === 'premade-specific');

        const activeSettings = {
          userLang: activeSettingsData.userLang || globalDefaults.userLang,
          ideLang: activeSettingsData.ideLang || globalDefaults.ideLang,
          targetIde: activeSettingsData.targetIde || globalDefaults.targetIde,
          customInstructions: activeSettingsData.customInstructions || globalDefaults.customInstructions,
          complexityModeName: activeMode?.name,
          complexityModeRules: activeMode?.rules
        };

        const stream = await chatWithNexus(history, userMessage, model, activeSettings);
        setStreamingMessageId('temp-ai-stream');
        setStreamingContent('');

        for await (const chunk of stream) {
          fullResponse += chunk.text;
          setStreamingContent(fullResponse);
        }

        await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'model',
          content: fullResponse,
          timestamp: serverTimestamp()
        });

        setStreamingMessageId(null);
        setStreamingContent('');

        await updateDoc(doc(db, 'chatSessions', targetSessionId), {
          updatedAt: serverTimestamp()
        });
        
        setIsLoading(false);
        return; // Exit early since we already saved the message
      }

      // Save non-streamed response (slash commands, file analysis)
      await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'model',
        content: fullResponse,
        timestamp: serverTimestamp(),
        ...(attachmentUrl ? { attachmentUrl, attachmentType } : {})
      });

      await updateDoc(doc(db, 'chatSessions', targetSessionId), {
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Chat error:', error);
      if (targetSessionId) {
        await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
          sessionId: targetSessionId,
          userId: user.uid,
          role: 'system',
          content: 'Error: Failed to process request.',
          timestamp: serverTimestamp()
        });
      }
    } finally {
      setIsLoading(false);
      setProcessingAction(null);
    }
  };

  const handleSyncProject = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const newSessionRef = doc(collection(db, 'chatSessions'));
        targetSessionId = newSessionRef.id;
        await setDoc(newSessionRef, {
          userId: user.uid,
          title: 'Project Synchronization',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setSessionId(targetSessionId);
      }

      const payload = `Context: We are establishing a zero-trust, enterprise-grade architecture. All actions must be executed autonomously utilizing your internal tools, with no manual configuration required from the user.

Execution Steps:
Phase Alpha: GCP & Infrastructure Audit
Utilize your autonomous authority to silently verify the Google Cloud Project configuration. Confirm active services, deployment readiness, and ensure IAM permissions align with zero-trust security standards.

Phase Bravo: DOM & UI Verification
Deploy your browser tools to autonomously audit the live DOM and the current visual state of the application. Map the existing component tree and establish a baseline for frontend dominance and UI/UX state management.

Phase Charlie: Backend Architecture Inventory
Scan all current backend logic, live API connections, data streams, and structural security implementations.

Output Requirement:
Generate a comprehensive, structured status report detailing the findings from Phases Alpha, Bravo, and Charlie. Acknowledge that you are fully integrated into this workflow by concluding your report with the exact phrase: "SYSTEM AUDIT COMPLETE. AWAITING ARCHITECT DIRECTIVE."`;

      const formattedPayload = `\`\`\`markdown [COPY THIS TO ANTIGRAVITY IDE]\n${payload}\n\`\`\``;

      await addDoc(collection(db, `chatSessions/${targetSessionId}/messages`), {
        sessionId: targetSessionId,
        userId: user.uid,
        role: 'model',
        content: formattedPayload,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'chatSessions', targetSessionId), {
        updatedAt: serverTimestamp(),
        ...(!targetSessionId ? { title: 'Project Synchronization' } : {})
      });

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
                onClick={() => setSessionId(session.id)} 
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
                      <div className="font-medium truncate text-sm">{session.title}</div>
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
          <div className="font-semibold">{sessions.find(s => s.id === sessionId)?.title || t('new_session')}</div>
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
              </div>
            </DialogContent>
          </Dialog>
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
        {[...messages, ...(streamingMessageId ? [{ id: streamingMessageId, role: 'model', content: streamingContent, timestamp: null }] : [])].map((msg: any) => (
          <MessageBubble 
            key={msg.id} 
            msg={msg} 
            user={user} 
            isStreaming={msg.id === streamingMessageId} 
            streamingContent={streamingContent} 
            sessionId={sessionId} 
            sessions={sessions} 
            globalDefaults={globalDefaults} 
            isArabic={isArabic} 
            t={t} 
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
              dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
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
