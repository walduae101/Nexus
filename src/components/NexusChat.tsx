import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, where, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { chatWithNexus, generateImage, searchGrounding, textToSpeech, analyzeMedia, transcribeAudio } from '../lib/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { Send, Bot, User as UserIcon, Loader2, Paperclip, X, Image as ImageIcon, Mic, Search, Video, Plus, MessageSquare, Pencil, Check, Trash2, Download, UploadCloud, Play, Settings, Info } from 'lucide-react';
import Markdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Label } from './ui/label';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import TextareaAutosize from 'react-textarea-autosize';

function ActionableCodeBlock({ payload, targetIde, userId }: { payload: string, targetIde: string, userId: string }) {
  const [status, setStatus] = useState<'idle' | 'dispatching' | 'dispatched'>('idle');

  const handleDispatch = async () => {
    setStatus('dispatching');
    try {
      await addDoc(collection(db, `users/${userId}/command_queue`), {
        payload,
        targetIde,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      setStatus('dispatched');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to dispatch command', error);
      setStatus('idle');
    }
  };

  return (
    <Card className="my-4 border-border bg-zinc-950 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
          <span className="ml-2 text-xs font-mono text-zinc-400">IDE Payload</span>
        </div>
        <Button 
          size="sm" 
          variant={status === 'dispatched' ? 'default' : 'secondary'}
          className={`h-7 text-xs gap-1.5 ${status === 'dispatched' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
          onClick={handleDispatch}
          disabled={status !== 'idle'}
        >
          {status === 'idle' && <><Play className="w-3 h-3" /> Run in {targetIde}</>}
          {status === 'dispatching' && <><Loader2 className="w-3 h-3 animate-spin" /> Dispatching...</>}
          {status === 'dispatched' && <><Check className="w-3 h-3" /> Dispatched</>}
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

export function NexusChat({ user }: { user: User }) {
  const { savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults } = useSettings();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3-flash-preview' | 'gemini-3.1-flash-lite-preview'>('gemini-3.1-pro-preview');
  const [isLoading, setIsLoading] = useState(false);
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
      
      if (fetchedSessions.length === 0) {
        const createFirst = async () => {
          const newSessionRef = doc(collection(db, 'chatSessions'));
          try {
            await setDoc(newSessionRef, {
              userId: user.uid,
              title: 'New Session',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'chatSessions');
          }
        };
        createFirst();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chatSessions');
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (!sessionId && sessions.length > 0) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const createNewSession = async () => {
    const newSessionRef = doc(collection(db, 'chatSessions'));
    try {
      await setDoc(newSessionRef, {
        userId: user.uid,
        title: 'New Session',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSessionId(newSessionRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chatSessions');
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
    if (!sessionId) return;
    const q = query(collection(db, `chatSessions/${sessionId}/messages`), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chatSessions/${sessionId}/messages`);
    });
    return () => unsubscribe();
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if ((!input.trim() && !file) || !sessionId || isLoading) return;
    
    const userMessage = input;
    const currentFile = file;
    setInput('');
    clearFile();
    setIsLoading(true);

    try {
      // Save user message
      await addDoc(collection(db, `chatSessions/${sessionId}/messages`), {
        sessionId,
        userId: user.uid,
        role: 'user',
        content: userMessage || (currentFile ? `[Uploaded ${currentFile.type}]` : ''),
        timestamp: serverTimestamp(),
        ...(currentFile && previewUrl ? { attachmentUrl: previewUrl, attachmentType: currentFile.type } : {})
      });

      // Update session updatedAt and title if first message
      await updateDoc(doc(db, 'chatSessions', sessionId), {
        updatedAt: serverTimestamp(),
        ...(messages.length === 0 && userMessage ? { title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') } : {})
      });

      let fullResponse = '';
      let attachmentUrl = '';
      let attachmentType = '';

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
        const text = userMessage.replace('/tts ', '');
        fullResponse = `Generated audio for: "${text}"`;
        attachmentUrl = await textToSpeech(text);
        attachmentType = 'audio/wav';
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

        const currentSession = sessions.find(s => s.id === sessionId);
        
        // Find the active complexity mode object
        const activeModeId = currentSession?.complexityMode || globalDefaults.complexityMode;
        const activeMode = customModes.find(m => m.id === activeModeId) || customModes.find(m => m.id === 'premade-specific');

        const activeSettings = {
          userLang: currentSession?.userLang || globalDefaults.userLang,
          ideLang: currentSession?.ideLang || globalDefaults.ideLang,
          targetIde: currentSession?.targetIde || globalDefaults.targetIde,
          customInstructions: currentSession?.customInstructions || globalDefaults.customInstructions,
          complexityModeName: activeMode?.name,
          complexityModeRules: activeMode?.rules
        };

        const stream = await chatWithNexus(history, userMessage, model, activeSettings);
        
        const modelMessageRef = await addDoc(collection(db, `chatSessions/${sessionId}/messages`), {
          sessionId,
          userId: user.uid,
          role: 'model',
          content: '',
          timestamp: serverTimestamp()
        });

        setStreamingMessageId(modelMessageRef.id);
        setStreamingContent('');

        for await (const chunk of stream) {
          fullResponse += chunk.text;
          setStreamingContent(fullResponse);
        }

        await setDoc(modelMessageRef, {
          content: fullResponse
        }, { merge: true });

        setStreamingMessageId(null);
        setStreamingContent('');

        await updateDoc(doc(db, 'chatSessions', sessionId), {
          updatedAt: serverTimestamp()
        });
        
        setIsLoading(false);
        return; // Exit early since we already saved the message
      }

      // Save non-streamed response (slash commands, file analysis)
      await addDoc(collection(db, `chatSessions/${sessionId}/messages`), {
        sessionId,
        userId: user.uid,
        role: 'model',
        content: fullResponse,
        timestamp: serverTimestamp(),
        ...(attachmentUrl ? { attachmentUrl, attachmentType } : {})
      });

      await updateDoc(doc(db, 'chatSessions', sessionId), {
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Chat error:', error);
      await addDoc(collection(db, `chatSessions/${sessionId}/messages`), {
        sessionId,
        userId: user.uid,
        role: 'system',
        content: 'Error: Failed to process request.',
        timestamp: serverTimestamp()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800/50 bg-muted/10 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-zinc-800/50">
          <Button onClick={createNewSession} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => setSessionId(session.id)} 
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 cursor-pointer group ${sessionId === session.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(session.id);
                            setEditTitle(session.title);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="text-xs opacity-70 truncate">
                    {session.updatedAt?.toDate ? new Date(session.updatedAt.toDate()).toLocaleDateString() : 'Just now'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col h-full min-w-0 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
          <div className="font-semibold">{sessions.find(s => s.id === sessionId)?.title || 'New Chat'}</div>
          <Dialog>
            <DialogTrigger render={<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" />}>
              <Settings className="w-5 h-5" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Chat Session Settings</DialogTitle>
                <DialogDescription>
                  Configure the behavior and output of this specific chat session.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>User Output Language</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>The language the AI uses to explain strategies and converse with you.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={sessions.find(s => s.id === sessionId)?.userLang || 'default'} 
                    onValueChange={(v) => updateDoc(doc(db, 'chatSessions', sessionId!), { userLang: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="User Lang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default ({savedLanguages.find(l => l.value === globalDefaults.userLang)?.name || globalDefaults.userLang || 'en-US'})</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Official Languages</SelectLabel>
                        {savedLanguages.filter(lang => lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                      </SelectGroup>
                      {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>My Custom Languages</SelectLabel>
                            {savedLanguages.filter(lang => !lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>IDE Prompt Language</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>The language used for the raw command payload sent to your IDE.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={sessions.find(s => s.id === sessionId)?.ideLang || 'default'} 
                    onValueChange={(v) => updateDoc(doc(db, 'chatSessions', sessionId!), { ideLang: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="IDE Lang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default ({savedLanguages.find(l => l.value === globalDefaults.ideLang)?.name || globalDefaults.ideLang || 'en-US'})</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Official Languages</SelectLabel>
                        {savedLanguages.filter(lang => lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                      </SelectGroup>
                      {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>My Custom Languages</SelectLabel>
                            {savedLanguages.filter(lang => !lang.isDefault).map(l => <SelectItem key={l.id} value={l.value}>{l.name}</SelectItem>)}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Target IDE</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>The IDE where the generated commands will be executed.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={sessions.find(s => s.id === sessionId)?.targetIde || 'default'} 
                    onValueChange={(v) => updateDoc(doc(db, 'chatSessions', sessionId!), { targetIde: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Target IDE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default ({globalDefaults.targetIde || 'VS Code'})</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Official Defaults</SelectLabel>
                        {savedIdes.filter(ide => ide.isDefault).map(i => <SelectItem key={i.id} value={i.value}>{i.name}</SelectItem>)}
                      </SelectGroup>
                      {savedIdes.filter(ide => !ide.isDefault).length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>My Custom IDEs</SelectLabel>
                            {savedIdes.filter(ide => !ide.isDefault).map(i => <SelectItem key={i.id} value={i.value}>{i.name}</SelectItem>)}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Complexity Mode</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>Determines technical depth. 'Advanced' allows raw code snippets; 'Simple' removes jargon.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={sessions.find(s => s.id === sessionId)?.complexityMode || 'default'} 
                    onValueChange={(v) => updateDoc(doc(db, 'chatSessions', sessionId!), { complexityMode: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Complexity Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      {customModes.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Custom Instructions</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>Injects your saved custom behavioral rules into the AI's system prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    value={sessions.find(s => s.id === sessionId)?.customInstructions || 'default'} 
                    onValueChange={(v) => updateDoc(doc(db, 'chatSessions', sessionId!), { customInstructions: v === 'default' ? null : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Instructions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      {savedInstructions.map(i => <SelectItem key={i.id} value={i.content}>{i.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>AI Model</Label>
                    <Tooltip>
                      <TooltipTrigger render={<Info className="w-4 h-4 text-muted-foreground cursor-help" />} />
                      <TooltipContent>
                        <p>Select the Gemini model powering this specific chat session.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={model} onValueChange={(v: any) => setModel(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="gemini-3.1-pro-preview">Pro (Complex/Thinking)</SelectItem>
                      <SelectItem value="gemini-3-flash-preview">Flash (General)</SelectItem>
                      <SelectItem value="gemini-3.1-flash-lite-preview">Flash Lite (Fast)</SelectItem>
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
              <h3 className="text-2xl font-bold">Drop files here</h3>
              <p className="text-muted-foreground text-sm">Upload images, audio, or video for Nexus to analyze</p>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-10">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Welcome to the Nexus.</p>
            <p className="text-sm">Enter your unstructured thoughts or IDE status report to begin.</p>
          </div>
        )}
        {messages.map((msg) => (
          <motion.div 
            key={msg.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary' : msg.role === 'system' ? 'bg-destructive' : 'bg-muted-foreground'}`}>
              {msg.role === 'user' ? <UserIcon className="w-5 h-5 text-primary-foreground" /> : <Bot className="w-5 h-5 text-background" />}
            </div>
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
                      className="absolute top-4 right-4 bg-background/80 hover:bg-background p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="markdown-body prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                {((msg.id === streamingMessageId && !streamingContent) || (!msg.content && msg.role === 'model' && isLoading)) ? (
                  <div className="flex space-x-1 items-center h-5 mt-1">
                    <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                    <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                    <motion.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                  </div>
                ) : (
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
                          const currentSession = sessions.find(s => s.id === sessionId);
                          const targetIde = currentSession?.targetIde || globalDefaults.targetIde;
                          return <ActionableCodeBlock payload={payload} targetIde={targetIde} userId={user.uid} />;
                        }
                        
                        return <code className={className} {...props}>{children}</code>;
                      }
                    }}
                  >
                    {msg.id === streamingMessageId ? streamingContent : msg.content}
                  </Markdown>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="max-w-4xl mx-auto w-full mb-2 sm:mb-6 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 shadow-2xl p-2 flex flex-col gap-2">
          {previewUrl && (
            <div className="relative inline-block w-24 h-24 ml-2 mt-2">
              {file?.type.startsWith('video/') ? (
                <video src={previewUrl} className="w-full h-full object-cover rounded-lg border border-zinc-800/50" />
              ) : file?.type.startsWith('audio/') ? (
                <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border border-zinc-800/50">
                  <Mic className="w-8 h-8 text-muted-foreground" />
                </div>
              ) : (
                <img src={previewUrl} className="w-full h-full object-cover rounded-lg border border-zinc-800/50" />
              )}
              <button onClick={clearFile} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-80 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-center">
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
              placeholder="Type a message or use /image, /search, /tts..." 
              className="bg-transparent border-none text-foreground focus-visible:ring-0 flex-1 shadow-none w-full resize-none break-words whitespace-pre-wrap overflow-x-hidden overflow-y-auto py-2"
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

      <Dialog open={!!sessionToDelete} onOpenChange={(open: boolean) => !open && setSessionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat session? This action cannot be undone and all messages will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSession}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
