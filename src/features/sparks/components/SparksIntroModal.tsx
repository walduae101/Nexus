import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';

export function SparksIntroModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('nexus_sparks_intro_seen');
    if (!hasSeen) {
      // Add a slight delay for dramatic effect after app load
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('nexus_sparks_intro_seen', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
            <Lightbulb className="h-8 w-8 text-yellow-400 animate-pulse" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-zinc-100 text-center mb-2">{t('sparks_intro_title')}</h2>
        <p className="text-zinc-400 text-sm text-center mb-6">{t('sparks_intro_desc')}</p>
        
        <ul className="space-y-4 mb-8">
          {[t('sparks_intro_f1'), t('sparks_intro_f2'), t('sparks_intro_f3')].map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
              <div className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
              <span className="leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
        
        <button 
          onClick={handleClose}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
        >
          {t('sparks_intro_btn')}
        </button>
      </div>
    </div>
  );
}
