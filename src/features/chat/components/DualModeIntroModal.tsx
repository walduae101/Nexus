import { useTranslation } from 'react-i18next';
import { Terminal, Check } from 'lucide-react';

export function DualModeIntroModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" dir={t('dual_intro_title').match(/[\u0600-\u06FF]/) ? 'rtl' : 'ltr'}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
            <Terminal className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-zinc-100 text-center mb-2">{t('dual_intro_title') || 'Meet Dual Input Mode 🎛️'}</h2>
        <p className="text-zinc-400 text-sm text-center mb-6">{t('dual_intro_desc') || 'Say goodbye to messy text walls! We\'ve upgraded how you talk to Nexus:'}</p>
        
        <ul className="space-y-4 mb-8">
          {[
            t('dual_intro_f1') || 'Separate Context: Paste your massive code blocks into the IDE Payload tab.', 
            t('dual_intro_f2') || 'Clear Questions: Type your actual question in the User Note tab.', 
            t('dual_intro_f3') || 'Smarter AI: Nexus will read both perfectly, keeping your chat feed clean and organized.'
          ].map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
              <div className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary" />
              </div>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          {t('dual_intro_btn') || 'Awesome, let\'s code!'}
        </button>
      </div>
    </div>
  );
}
