import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, X, Search } from 'lucide-react';
import { 
  SiReact, SiFlutter, SiPython, SiFirebase, SiGooglecloud, 
  SiVite, SiNodedotjs, SiMongodb, SiPostgresql, SiDocker, 
  SiFigma, SiSwift, SiKotlin, SiTailwindcss, SiTypescript, 
  SiRust, SiNextdotjs, SiJavascript, SiAndroid, SiApple
} from 'react-icons/si';

export const TECH_STACKS = [
  { id: 'react', label: 'React', icon: SiReact, color: 'text-[#61DAFB]' },
  { id: 'flutter', label: 'Flutter', icon: SiFlutter, color: 'text-[#02569B]' },
  { id: 'python', label: 'Python', icon: SiPython, color: 'text-[#3776AB]' },
  { id: 'typescript', label: 'TypeScript', icon: SiTypescript, color: 'text-[#3178C6]' },
  { id: 'javascript', label: 'JavaScript', icon: SiJavascript, color: 'text-[#F7DF1E]' },
  { id: 'android', label: 'Android', icon: SiAndroid, color: 'text-[#3DDC84]' },
  { id: 'apple', label: 'iOS / Apple', icon: SiApple, color: 'text-zinc-200' },
  { id: 'tailwind', label: 'Tailwind CSS', icon: SiTailwindcss, color: 'text-[#06B6D4]' },
  { id: 'node', label: 'Node.js', icon: SiNodedotjs, color: 'text-[#339933]' },
  { id: 'nextjs', label: 'Next.js', icon: SiNextdotjs, color: 'text-zinc-200' },
  { id: 'vite', label: 'Vite', icon: SiVite, color: 'text-[#646CFF]' },
  { id: 'firebase', label: 'Firebase', icon: SiFirebase, color: 'text-[#FFCA28]' },
  { id: 'gcp', label: 'Google Cloud', icon: SiGooglecloud, color: 'text-[#4285F4]' },
  { id: 'docker', label: 'Docker', icon: SiDocker, color: 'text-[#2496ED]' },
  { id: 'mongodb', label: 'MongoDB', icon: SiMongodb, color: 'text-[#47A248]' },
  { id: 'postgres', label: 'PostgreSQL', icon: SiPostgresql, color: 'text-[#4169E1]' },
  { id: 'swift', label: 'Swift', icon: SiSwift, color: 'text-[#F05138]' },
  { id: 'kotlin', label: 'Kotlin', icon: SiKotlin, color: 'text-[#7F52FF]' },
  { id: 'rust', label: 'Rust', icon: SiRust, color: 'text-[#000000] dark:text-white' },
  { id: 'figma', label: 'Figma', icon: SiFigma, color: 'text-[#F24E1E]' },
];

export function TechStackSelector({ selected, onChange }: { selected: string[], onChange: (selected: string[]) => void }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredTechs = TECH_STACKS.filter(tItem => 
    tItem.label.toLowerCase().includes(searchQuery.toLowerCase()) && !selected.includes(tItem.id)
  );

  const handleSelect = (id: string) => {
    if (!selected.includes(id)) {
      onChange([...selected, id]);
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleRemove = (id: string) => {
    onChange(selected.filter(item => item !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      
      const exactMatch = filteredTechs.find(tItem => tItem.label.toLowerCase() === trimmed.toLowerCase());
      if (exactMatch) {
         handleSelect(exactMatch.id);
      } else if (filteredTechs.length > 0) {
         handleSelect(filteredTechs[0].id);
      } else {
         if (!selected.includes(trimmed)) {
           onChange([...selected, trimmed]);
         }
         setSearchQuery('');
         setIsDropdownOpen(false);
      }
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-3" ref={dropdownRef}>
      <div className="flex flex-wrap gap-2">
        {selected.map(item => {
          const predefined = TECH_STACKS.find(tItem => tItem.id === item);
          const Icon = predefined?.icon || Terminal;
          const colorClass = predefined?.color || 'text-primary';
          
          return (
            <span key={item} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700 text-sm font-medium text-zinc-200">
              <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
              {predefined ? predefined.label : item}
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); handleRemove(item); }} 
                className="ml-1 opacity-60 hover:opacity-100 hover:text-white transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <div className="flex items-center bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
          <Search className="h-4 w-4 text-zinc-500" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t('custom_tech_placeholder') || 'Search or add custom tech...'}
            className="flex-1 bg-transparent border-none focus:outline-none px-3 py-2.5 text-sm text-zinc-200"
          />
        </div>

        {isDropdownOpen && (filteredTechs.length > 0 || searchQuery.trim()) && (
          <div className="absolute top-full left-0 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {filteredTechs.map((tech) => {
              const Icon = tech.icon;
              return (
                <button
                  key={tech.id}
                  onClick={(e) => { e.preventDefault(); handleSelect(tech.id); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-zinc-800/80 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${tech.color}`} />
                    <span className="text-sm font-medium text-zinc-200">{tech.label}</span>
                  </div>
                </button>
              );
            })}
            
            {filteredTechs.length === 0 && searchQuery.trim() && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (!selected.includes(searchQuery.trim())) {
                    onChange([...selected, searchQuery.trim()]);
                  }
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/80 rounded-lg transition-colors text-left"
              >
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-zinc-200">
                  Hit Enter to add "<span className="text-primary">{searchQuery}</span>" as custom
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
