import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Mic, Pencil, Trash2, Terminal, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import { MessageCopyButton, ActionableCodeBlock } from './ChatUIPrimitives';

export function MessageBubble({ msg, user, sessionId, sessions, globalDefaults, isArabic, t, messages, activeLeafId, setActiveLeafId, onEditSubmit, onDelete, onRegenerate, localSearchQuery }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  const textRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const isMatch = localSearchQuery && localSearchQuery.trim() !== '' && 
    (msg.content?.toLowerCase().includes(localSearchQuery.toLowerCase()) || 
     msg.idePayload?.toLowerCase().includes(localSearchQuery.toLowerCase()));
  const showDimmed = localSearchQuery && localSearchQuery.trim() !== '' && !isMatch;

  useEffect(() => {
    if (msg.role !== 'user' || isExpanded) return;

    const checkOverflow = () => {
      if (textRef.current) {
        // Add a 25px tolerance to absorb line-height inflation
        const overflowing = textRef.current.scrollHeight > textRef.current.clientHeight + 25;
        setIsOverflowing(overflowing);
      }
    };

    // Run immediately
    checkOverflow();
    // Run again slightly after paint to catch late layout shifts
    const timer = setTimeout(checkOverflow, 50);
    return () => clearTimeout(timer);
  }, [msg.content, isExpanded, msg.role]);

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
      className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${showDimmed ? 'opacity-40 grayscale-[80%]' : ''}`}
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
      <div className={`relative max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : msg.role === 'system' ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-muted text-foreground'} ${isMatch ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/20 transition-all shadow-xl' : ''}`}>
        
        {siblings.length > 1 && (
          <div className={`flex items-center gap-2 mb-2 text-xs font-mono font-bold ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            <button onClick={() => navigateBranch(-1)} disabled={currentIndex === 0} className="hover:text-current disabled:opacity-30"> <ChevronLeft className="w-3 h-3" /> </button>
            <span>{currentIndex + 1} / {siblings.length}</span>
            <button onClick={() => navigateBranch(1)} disabled={currentIndex === siblings.length - 1} className="hover:text-current disabled:opacity-30"> <ChevronRight className="w-3 h-3" /> </button>
          </div>
        )}

        {msg.attachmentUrl && msg.attachmentType?.startsWith('image/') && (!msg.attachments || msg.attachments.length === 0) && (
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

        {msg.attachments && msg.attachments.length > 0 && (
          <div className={`grid gap-2 mb-3 w-full ${msg.attachments.length === 1 ? 'grid-cols-1 max-w-sm' : msg.attachments.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {msg.attachments.map((url: string, idx: number) => (
              <div key={idx} className={`relative overflow-hidden rounded-lg border border-zinc-800 ${msg.isUploading ? 'opacity-70 animate-pulse' : ''} group`}>
                <img 
                  src={url} 
                  alt={`Attachment ${idx + 1}`} 
                  className="w-full h-full object-cover max-h-48 cursor-pointer hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
                {!msg.isUploading && (
                  <a 
                    href={url} 
                    download={`attachment-${idx}.png`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="absolute top-2 right-2 bg-background/80 hover:bg-background p-1.5 rounded-full opacity-0 md:group-hover:opacity-100 transition-opacity z-10 shadow-sm border border-zinc-700"
                  >
                    <Download className="w-3 h-3 text-foreground" />
                  </a>
                )}
              </div>
            ))}
            {msg.isUploading && <Loader2 className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-spin shadow-lg drop-shadow-xl" />}
          </div>
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
            <>
              <div 
                ref={msg.role === 'user' ? textRef : null}
                dir="auto" 
                className={`markdown-body prose ${msg.role === 'user' ? 'prose-invert prose-headings:text-primary-foreground prose-a:text-primary-foreground' : 'prose-invert'} max-w-none prose-p:my-0 prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 ${msg.role === 'user' && !isExpanded ? 'line-clamp-5 overflow-hidden break-words' : 'break-words'}`}
              >
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
              {msg.role === 'user' && isOverflowing && (
                <div className="mt-1 flex justify-start w-full" dir="ltr">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="p-1 -ml-1 text-white/70 hover:text-white transition-colors rounded-md hover:bg-black/20 flex items-center justify-center"
                    title={isExpanded ? "Show Less" : "Show More"}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {msg.role === 'user' && msg.idePayload && (
                <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden text-start dir-ltr">
                  <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 border-b border-zinc-800">
                    <Terminal className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-zinc-300">{t('attached_ide') || 'IDE Context Attached'}</span>
                  </div>
                  <div className="p-3 text-xs font-mono text-zinc-400 whitespace-pre-wrap break-words custom-scrollbar max-h-64 overflow-y-auto" dir="auto">
                    {msg.idePayload}
                  </div>
                </div>
              )}
            </>
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
            {msg.role === 'model' && onRegenerate && !msg.isGenerating && (
               <button 
                 onClick={(e) => { e.stopPropagation(); onRegenerate(msg.id); }}
                 className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800 rounded-md transition-all duration-200"
                 title={t('regenerate_message') || 'Regenerate'}
               >
                 <RotateCw className="w-3.5 h-3.5" />
               </button>
            )}
            <MessageCopyButton text={content} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
