import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { useTranslation } from 'react-i18next';
import { TechStackSelector } from './TechStackSelector';

export function GlobalSettings() {
  const { t, i18n } = useTranslation();
  const { 
    savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults,
    addLanguage, deleteLanguage, addIde, deleteIde, addInstruction, deleteInstruction,
    addCustomMode, deleteCustomMode, updateGlobalDefaults
  } = useSettings();

  const getLanguageName = (val: string) => savedLanguages.find(l => l.value === val)?.name || val;
  const getIdeName = (val: string) => savedIdes.find(i => i.value === val)?.name || val;

  const [newLangName, setNewLangName] = useState('');
  const [newLangValue, setNewLangValue] = useState('');
  
  const [newIdeName, setNewIdeName] = useState('');
  const [newIdeValue, setNewIdeValue] = useState('');

  const [newInstTitle, setNewInstTitle] = useState('');
  const [newInstContent, setNewInstContent] = useState('');

  const [newModeName, setNewModeName] = useState('');
  const [newModeRules, setNewModeRules] = useState('');

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" />}>
        <Settings className="w-5 h-5" />
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto custom-scrollbar">
        <SheetHeader>
          <SheetTitle>{t('global_settings_hub')}</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="defaults" className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="defaults">{t('tab_defaults')}</TabsTrigger>
            <TabsTrigger value="langs">{t('tab_langs')}</TabsTrigger>
            <TabsTrigger value="ides">{t('tab_ides')}</TabsTrigger>
            <TabsTrigger value="inst">{t('tab_prompts')}</TabsTrigger>
            <TabsTrigger value="modes">{t('tab_modes')}</TabsTrigger>
          </TabsList>

          <TabsContent value="defaults" className="space-y-6 mt-4">
            <div className="space-y-4 border-b border-zinc-800 pb-6">
              <h3 className="text-lg font-medium text-foreground">{t('typography_settings')}</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-200">{t('font_family')}</Label>
                  <Select 
                    value={globalDefaults.fontFamily} 
                    onValueChange={v => updateGlobalDefaults({ fontFamily: v })}
                  >
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="system">{t('font_system')}</SelectItem>
                      <SelectItem value="cairo">{t('font_cairo')}</SelectItem>
                      <SelectItem value="tajawal">{t('font_tajawal')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-zinc-200">{t('font_size')}</Label>
                  <Select 
                    value={globalDefaults.fontSize} 
                    onValueChange={v => updateGlobalDefaults({ fontSize: v })}
                  >
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="small">{t('size_small')}</SelectItem>
                      <SelectItem value="medium">{t('size_medium')}</SelectItem>
                      <SelectItem value="large">{t('size_large')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-b border-zinc-800 pb-6 mt-6">
               <h3 className="text-lg font-medium text-foreground">{t('tech_stack') || 'Tech Stack'}</h3>
               <TechStackSelector 
                 selected={globalDefaults.globalTechStack || []} 
                 onChange={v => updateGlobalDefaults({ globalTechStack: v })} 
               />
            </div>

            <div className="space-y-2 mt-6">
              <Label className="text-sm font-medium text-zinc-200">{t('default_user_language')}</Label>
              <p className="text-xs text-zinc-500">{t('user_output_desc')}</p>
              <Select 
                value={globalDefaults.userLang} 
                onValueChange={v => updateGlobalDefaults({ userLang: v })}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                  <SelectValue placeholder={t('select_user_language')}>
                    {globalDefaults.userLang ? getLanguageName(globalDefaults.userLang) : t('select_user_language')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t('official_languages')}</SelectLabel>
                    {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                      <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('my_custom_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => !lang.isDefault).map(lang => (
                          <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-200">{t('default_ide_language')}</Label>
              <p className="text-xs text-zinc-500">{t('ide_prompt_desc')}</p>
              <Select 
                value={globalDefaults.ideLang} 
                onValueChange={v => updateGlobalDefaults({ ideLang: v })}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                  <SelectValue placeholder={t('select_ide_language')}>
                    {globalDefaults.ideLang ? getLanguageName(globalDefaults.ideLang) : t('select_ide_language')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t('official_languages')}</SelectLabel>
                    {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                      <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('my_custom_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => !lang.isDefault).map(lang => (
                          <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-200">{t('spoken_language')}</Label>
              <p className="text-xs text-zinc-500">{t('select_user_language')}</p>
              <Select 
                value={globalDefaults.spokenLanguage} 
                onValueChange={v => updateGlobalDefaults({ spokenLanguage: v })}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                  <SelectValue placeholder={t('select_user_language')}>
                    {globalDefaults.spokenLanguage ? getLanguageName(globalDefaults.spokenLanguage) : t('select_user_language')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t('official_languages')}</SelectLabel>
                    {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                      <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('my_custom_languages')}</SelectLabel>
                        {savedLanguages.filter(lang => !lang.isDefault).map(lang => (
                          <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg mt-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-zinc-200">{t('auto_copy_voice')}</Label>
                <p className="text-xs text-zinc-500">Automatically copy transcribed text on Enter.</p>
              </div>
              <input
                type="checkbox"
                title={t('auto_copy_voice') || 'Auto Copy Voice'}
                checked={globalDefaults.autoCopyVoice || false}
                onChange={(e) => updateGlobalDefaults({ autoCopyVoice: e.target.checked })}
                className="h-4 w-4 bg-zinc-800 border-zinc-700 rounded rounded-md focus:ring-primary text-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-200">{t('default_target_ide')}</Label>
              <p className="text-xs text-zinc-500">{t('target_ide_desc')}</p>
              <Select 
                value={globalDefaults.targetIde} 
                onValueChange={v => updateGlobalDefaults({ targetIde: v })}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                  <SelectValue placeholder={t('select_default_ide')}>
                    {globalDefaults.targetIde ? getIdeName(globalDefaults.targetIde) : t('select_default_ide')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t('official_defaults')}</SelectLabel>
                    {savedIdes.filter(ide => ide.isDefault).map(ide => (
                      <SelectItem key={ide.id} value={ide.value}>{ide.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedIdes.filter(ide => !ide.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>{t('my_custom_ides')}</SelectLabel>
                        {savedIdes.filter(ide => !ide.isDefault).map(ide => (
                          <SelectItem key={ide.id} value={ide.value}>{ide.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-200">{t('complexity_mode')}</Label>
              <p className="text-xs text-zinc-500">{t('complexity_mode_desc')}</p>
              <Select 
                value={globalDefaults.complexityMode} 
                onValueChange={v => updateGlobalDefaults({ complexityMode: v })}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg">
                  <SelectValue placeholder={t('complexity_mode')}>
                    {customModes.find(m => m.id === globalDefaults.complexityMode)?.isPremade 
                      ? (t(customModes.find(m => m.id === globalDefaults.complexityMode)?.name.toLowerCase() || '') || customModes.find(m => m.id === globalDefaults.complexityMode)?.name) 
                      : (customModes.find(m => m.id === globalDefaults.complexityMode)?.name || globalDefaults.complexityMode)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customModes.map(mode => (
                    <SelectItem key={mode.id} value={mode.id}>
                      {mode.isPremade ? (t(mode.name.toLowerCase()) || mode.name) : mode.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-200">{t('default_custom_instructions')}</Label>
              <p className="text-xs text-zinc-500 text-start">{t('custom_instructions_desc')}</p>
              <Textarea 
                value={globalDefaults.customInstructions} 
                onChange={e => updateGlobalDefaults({ customInstructions: e.target.value })} 
                rows={4}
                className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg text-start"
                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                placeholder={t('custom_instructions_placeholder')}
              />
            </div>
          </TabsContent>

          <TabsContent value="langs" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder={t('name_placeholder_lang')} value={newLangName} onChange={e => setNewLangName(e.target.value)} />
              <Input placeholder={t('value_placeholder_lang')} value={newLangValue} onChange={e => setNewLangValue(e.target.value)} />
              <Button onClick={() => { addLanguage(newLangName, newLangValue); setNewLangName(''); setNewLangValue(''); }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {savedLanguages.filter(lang => !lang.isDefault).map(lang => (
                <div key={lang.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div>
                    <div className="font-medium text-sm">{lang.name}</div>
                    <div className="text-xs text-muted-foreground">{lang.value}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteLanguage(lang.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ides" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder={t('name_placeholder_ide')} value={newIdeName} onChange={e => setNewIdeName(e.target.value)} />
              <Input placeholder={t('value_placeholder_ide')} value={newIdeValue} onChange={e => setNewIdeValue(e.target.value)} />
              <Button onClick={() => { addIde(newIdeName, newIdeValue); setNewIdeName(''); setNewIdeValue(''); }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {savedIdes.filter(ide => !ide.isDefault).map(ide => (
                <div key={ide.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div>
                    <div className="font-medium text-sm">{ide.name}</div>
                    <div className="text-xs text-muted-foreground">{ide.value}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteIde(ide.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="inst" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Input placeholder={t('title_placeholder')} value={newInstTitle} onChange={e => setNewInstTitle(e.target.value)} />
              <Textarea placeholder={t('content_placeholder')} value={newInstContent} onChange={e => setNewInstContent(e.target.value)} className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg" />
              <Button className="w-full" onClick={() => { addInstruction(newInstTitle, newInstContent); setNewInstTitle(''); setNewInstContent(''); }}>
                {t('add_instruction')}
              </Button>
            </div>
            <div className="space-y-2">
              {savedInstructions.map(inst => (
                <div key={inst.id} className="p-2 bg-muted rounded-md relative group">
                  <div className="font-medium text-sm">{inst.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{inst.content}</div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-1 end-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteInstruction(inst.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="modes" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Input placeholder={t('mode_name_placeholder')} value={newModeName} onChange={e => setNewModeName(e.target.value)} className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg" />
              <Textarea placeholder={t('mode_rules_placeholder')} value={newModeRules} onChange={e => setNewModeRules(e.target.value)} className="bg-zinc-900/50 border-zinc-800 focus:ring-1 focus:ring-zinc-700 rounded-lg" />
              <Button className="w-full" onClick={() => { addCustomMode(newModeName, newModeRules); setNewModeName(''); setNewModeRules(''); }}>
                {t('add_mode')}
              </Button>
            </div>
            <div className="space-y-2">
              {customModes.map(mode => (
                <div key={mode.id} className="p-2 bg-muted rounded-md relative group">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {mode.isPremade ? t(mode.name.toLowerCase()) : mode.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{mode.isPremade ? t('mode_' + mode.name.toLowerCase()) : mode.rules}</div>
                  {!mode.isPremade && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-1 end-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteCustomMode(mode.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
