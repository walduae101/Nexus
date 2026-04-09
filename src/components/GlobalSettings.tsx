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

export function GlobalSettings() {
  const { 
    savedLanguages, savedIdes, savedInstructions, customModes, globalDefaults,
    addLanguage, deleteLanguage, addIde, deleteIde, addInstruction, deleteInstruction,
    addCustomMode, deleteCustomMode, updateGlobalDefaults
  } = useSettings();

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
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Global Settings Hub</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="defaults" className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="langs">Langs</TabsTrigger>
            <TabsTrigger value="ides">IDEs</TabsTrigger>
            <TabsTrigger value="inst">Prompts</TabsTrigger>
            <TabsTrigger value="modes">Modes</TabsTrigger>
          </TabsList>

          <TabsContent value="defaults" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Default User Language</Label>
              <Select 
                value={globalDefaults.userLang} 
                onValueChange={v => updateGlobalDefaults({ userLang: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select User Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Official Languages</SelectLabel>
                    {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                      <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>My Custom Languages</SelectLabel>
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
              <Label>Default IDE Language</Label>
              <Select 
                value={globalDefaults.ideLang} 
                onValueChange={v => updateGlobalDefaults({ ideLang: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select IDE Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Official Languages</SelectLabel>
                    {savedLanguages.filter(lang => lang.isDefault).map(lang => (
                      <SelectItem key={lang.id} value={lang.value}>{lang.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedLanguages.filter(lang => !lang.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>My Custom Languages</SelectLabel>
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
              <Label>Default Target IDE</Label>
              <Select 
                value={globalDefaults.targetIde} 
                onValueChange={v => updateGlobalDefaults({ targetIde: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Default IDE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Official Defaults</SelectLabel>
                    {savedIdes.filter(ide => ide.isDefault).map(ide => (
                      <SelectItem key={ide.id} value={ide.value}>{ide.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {savedIdes.filter(ide => !ide.isDefault).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>My Custom IDEs</SelectLabel>
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
              <Label>Default Custom Instructions</Label>
              <Textarea 
                value={globalDefaults.customInstructions} 
                onChange={e => updateGlobalDefaults({ customInstructions: e.target.value })} 
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="langs" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Name (e.g. Spanish)" value={newLangName} onChange={e => setNewLangName(e.target.value)} />
              <Input placeholder="Value (e.g. es-ES)" value={newLangValue} onChange={e => setNewLangValue(e.target.value)} />
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
              <Input placeholder="Name (e.g. VS Code)" value={newIdeName} onChange={e => setNewIdeName(e.target.value)} />
              <Input placeholder="Value (e.g. vscode)" value={newIdeValue} onChange={e => setNewIdeValue(e.target.value)} />
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
              <Input placeholder="Title" value={newInstTitle} onChange={e => setNewInstTitle(e.target.value)} />
              <Textarea placeholder="Content" value={newInstContent} onChange={e => setNewInstContent(e.target.value)} />
              <Button className="w-full" onClick={() => { addInstruction(newInstTitle, newInstContent); setNewInstTitle(''); setNewInstContent(''); }}>
                Add Instruction
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
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
              <Input placeholder="Mode Name (e.g. CUSTOM)" value={newModeName} onChange={e => setNewModeName(e.target.value)} />
              <Textarea placeholder="Mode Rules" value={newModeRules} onChange={e => setNewModeRules(e.target.value)} />
              <Button className="w-full" onClick={() => { addCustomMode(newModeName, newModeRules); setNewModeName(''); setNewModeRules(''); }}>
                Add Mode
              </Button>
            </div>
            <div className="space-y-2">
              {customModes.map(mode => (
                <div key={mode.id} className="p-2 bg-muted rounded-md relative group">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {mode.name}
                    {mode.isPremade && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">PREMADE</span>}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{mode.rules}</div>
                  {!mode.isPremade && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
