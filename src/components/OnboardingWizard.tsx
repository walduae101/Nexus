import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { Label } from './ui/label';

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const { t } = useTranslation();
  const { 
    globalDefaults, 
    updateGlobalDefaults, 
    savedLanguages,
    customModes
  } = useSettings();

  const getLanguageName = (val: string) => savedLanguages.find(l => l.value === val)?.name || val;
  const getModeName = (val: string) => customModes.find(m => m.id === val)?.name || val;

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);
  const handleLaunch = () => updateGlobalDefaults({ hasCompletedOnboarding: true });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 pointer-events-auto">
      <Card className="w-full max-w-lg bg-card border-zinc-800 shadow-2xl relative overflow-hidden">
        
        {/* Progress Bar Header */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out" 
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <CardHeader className="text-center pt-8">
          <div className="mx-auto flex items-center justify-center mb-6">
            <img src="/logo.png" alt="Nexus Logo" className="w-20 object-contain rounded-md" />
          </div>
          <CardTitle className="text-3xl font-light tracking-[0.2em] uppercase">{t('welcome_to_nexus') || 'Welcome to Nexus'}</CardTitle>
          <CardDescription className="text-xs tracking-widest uppercase mt-2 text-muted-foreground">
            {t('step_indicator') ? t('step_indicator').replace('{1}', String(step)).replace('{2}', '3') : `Step ${step} of 3`}
          </CardDescription>
        </CardHeader>

        <CardContent className="min-h-[220px] pt-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-zinc-200">{t('default_user_language')}</Label>
                  <p className="text-xs text-zinc-500">{t('user_output_desc')}</p>
                  <Select 
                    value={globalDefaults.userLang} 
                    onValueChange={v => updateGlobalDefaults({ userLang: v })}
                  >
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-800 rounded-lg h-12">
                      <SelectValue placeholder={t('select_user_language')}>
                        {globalDefaults.userLang ? getLanguageName(globalDefaults.userLang) : t('select_user_language')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999] bg-popover border-border text-popover-foreground">
                      <SelectGroup>
                        <SelectLabel>{t('official_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                          <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-zinc-200">{t('spoken_language')}</Label>
                  <p className="text-xs text-zinc-500">{t('spoken_language_desc') || 'The native language you will be speaking into the microphone.'}</p>
                  <Select 
                    value={globalDefaults.spokenLanguage} 
                    onValueChange={v => updateGlobalDefaults({ spokenLanguage: v })}
                  >
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-800 rounded-lg h-12">
                      <SelectValue placeholder={t('spoken_language')}>
                        {globalDefaults.spokenLanguage ? getLanguageName(globalDefaults.spokenLanguage) : t('spoken_language')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999] bg-popover border-border text-popover-foreground">
                      <SelectGroup>
                        <SelectLabel>{t('official_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                          <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-zinc-200">{t('complexity_mode')}</Label>
                  <p className="text-xs text-zinc-500">{t('complexity_mode_desc')}</p>
                  <Select 
                    value={globalDefaults.complexityMode} 
                    onValueChange={v => updateGlobalDefaults({ complexityMode: v })}
                  >
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-800 rounded-lg h-12">
                      <SelectValue placeholder={t('complexity_mode')}>
                        {globalDefaults.complexityMode ? getModeName(globalDefaults.complexityMode) : t('complexity_mode')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999] bg-popover border-border text-popover-foreground">
                      <SelectGroup>
                        <SelectLabel>{t('premade')}</SelectLabel>
                        {customModes.filter(mode => mode.isPremade).map(mode => (
                          <SelectItem key={mode.id} value={mode.id}>{t(mode.name.toLowerCase()) || mode.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-zinc-200">{t('default_custom_instructions')}</Label>
                  <p className="text-xs text-zinc-500">{t('custom_instructions_desc')}</p>
                  <Textarea 
                    placeholder={t('custom_instructions_placeholder')}
                    value={globalDefaults.customInstructions}
                    onChange={(e) => updateGlobalDefaults({ customInstructions: e.target.value })}
                    className="min-h-[120px] bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-primary/50 font-mono text-sm resize-none rounded-lg p-4"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
        
        <div className="border-t border-zinc-800/50 mt-4 p-6 bg-zinc-900/20">
          <div className="flex gap-4">
            {step > 1 && (
              <Button variant="outline" className="flex-1 border-zinc-700 bg-transparent hover:bg-zinc-800 h-12 rounded-xl transition-all" onClick={handleBack}>
                {t('back') || 'Back'}
              </Button>
            )}
            {step < 3 ? (
              <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-semibold transition-all shadow-lg shadow-primary/20" onClick={handleNext}>
                {t('next') || 'Next'}
              </Button>
            ) : (
              <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 tracking-wide uppercase text-sm" onClick={handleLaunch}>
                {t('launch_nexus') || 'Launch Nexus'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
