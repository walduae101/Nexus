import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, Copy } from 'lucide-react';
import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/SettingsContext';

export function MessageCopyButton({ text }: { text: string }) {
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

export function ActionableCodeBlock({ payload, targetIde, userId }: { payload: string, targetIde: string, userId: string }) {
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
          dir="auto"
          className={`p-4 pb-6 text-zinc-300 whitespace-pre-wrap break-words ${sizeClass}`}
          style={fontStyle}
        >
          {payload}
        </pre>
      </CardContent>
    </Card>
  );
}

export function RelativeTime({ date, lang, fallback }: { date: Date | null, lang: string, fallback: string }) {
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

export function LoadingBubble({ action }: { action: 'text' | 'image' | 'tts' | 'search' | 'distilling' }) {
  const { t } = useTranslation();
  const text = action === 'text' ? t('loading_text') : action === 'tts' ? t('loading_tts') : action === 'image' ? t('loading_image') : action === 'search' ? t('loading_search') : (t('loading_distilling') || 'Distilling contextual memories...');
  return (
    <div className="flex gap-4 p-4 md:p-6 w-full text-foreground border-b border-border">
      <Avatar className="w-8 h-8 rounded-lg shrink-0 outline outline-1 outline-border shadow-sm">
        <AvatarImage src="/logo.png" className="p-1.5" />
        <AvatarFallback className="bg-primary/20 text-primary">N</AvatarFallback>
      </Avatar>
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2 h-5 mt-1">
          <m.div className="w-2 h-2 bg-primary rounded-full ms-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
          <m.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
          <m.div className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
          <span className="ms-3 text-xs font-medium bg-gradient-to-r from-teal-400 to-primary bg-clip-text text-transparent animate-pulse">{text}</span>
        </div>
      </div>
    </div>
  );
}
