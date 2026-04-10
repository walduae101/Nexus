import React, { useState } from 'react';
import { Code2, Smartphone, Terminal, Flame, Cloud, Zap, Server, Database, Globe, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const TECH_STACKS = [
  { id: 'react', label: 'React', icon: Code2 },
  { id: 'flutter', label: 'Flutter', icon: Smartphone },
  { id: 'python', label: 'Python', icon: Terminal },
  { id: 'firebase', label: 'Firebase', icon: Flame },
  { id: 'gcp', label: 'Google Cloud', icon: Cloud },
  { id: 'vite', label: 'Vite', icon: Zap },
  { id: 'node', label: 'Node.js', icon: Server },
  { id: 'sql', label: 'SQL', icon: Database },
  { id: 'web', label: 'HTML/JS', icon: Globe }
];

export function TechStackSelector({ selected, onChange }: { selected: string[], onChange: (selected: string[]) => void }) {
  const { t } = useTranslation();
  const [customInput, setCustomInput] = useState('');

  const toggleSelection = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomInput('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TECH_STACKS.map((tech) => {
          const isSelected = selected.includes(tech.id);
          const Icon = tech.icon;
          return (
            <button
              key={tech.id}
              type="button"
              onClick={(e) => { e.preventDefault(); toggleSelection(tech.id); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/10 text-primary shadow-sm' 
                  : 'bg-zinc-900/50 hover:bg-zinc-800 text-muted-foreground border border-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tech.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map(item => {
          const isPredefined = TECH_STACKS.find(t => t.id === item);
          if (isPredefined) return null;
          return (
            <span key={item} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              {item}
              <button type="button" onClick={() => onChange(selected.filter(i => i !== item))} className="hover:text-primary/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>

      <form onSubmit={handleAddCustom} className="flex gap-2 items-center">
        <input 
          type="text" 
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder={t('custom_tech_placeholder') || 'e.g. Svelte, Prisma, Docker...'}
          className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary text-zinc-200"
        />
        <button type="submit" disabled={!customInput.trim()} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-sm transition-colors disabled:opacity-50">
          {t('add_custom_tech') || 'Add Custom'}
        </button>
      </form>
    </div>
  );
}
