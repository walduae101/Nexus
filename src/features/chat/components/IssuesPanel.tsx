import { Bug, CheckCircle2, CircleDashed, TerminalSquare, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Issue } from '@/lib/memory';
import { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export function IssuesPanel({ issues }: { issues: Issue[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const { globalDefaults } = useSettings();
  
  const activeIssues = issues.filter(i => i.status === 'open');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');
  
  const isArabic = globalDefaults?.userLang?.startsWith('ar');

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger>
        <div role="button" aria-label="Issues" className="group relative w-10 h-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
          <Bug className={`w-5 h-5 transition-all ${activeIssues.length > 0 ? 'text-red-400 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]' : 'group-hover:text-red-400'}`} />
          {activeIssues.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-background">
              {activeIssues.length}
            </span>
          )}
        </div>
      </SheetTrigger>
      <SheetContent dir={isArabic ? 'rtl' : 'ltr'} className="w-[400px] sm:w-[540px] overflow-y-auto custom-scrollbar bg-zinc-950 border-s border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" />
            {isArabic ? 'سجل المشاكل' : 'Issues Scratchpad'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 flex flex-col gap-8">
          {/* Active Issues */}
          <div>
            <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {isArabic ? 'الأخطاء النشطة' : 'Active Bugs'} ({activeIssues.length})
            </h3>
            <div className="flex flex-col gap-3">
              {activeIssues.length === 0 ? (
                <div className="text-sm text-zinc-500 italic bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50 text-center">
                  {isArabic ? 'كل شيء على ما يرام. لا توجد مشاكل نشطة.' : 'All clear. No active issues tracked.'}
                </div>
              ) : (
                activeIssues.map(issue => (
                  <div key={issue.id} className="bg-red-950/20 border border-red-900/50 rounded-xl p-4 shadow-sm">
                    <div className="flex gap-3">
                      <div className="mt-1"><CircleDashed className="w-4 h-4 text-red-400 animate-spin-slow" /></div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-200 font-medium mb-2">{issue.description}</p>
                        {issue.attemptedFixes && (
                          <div className="bg-black/40 rounded-lg p-3 border border-red-900/30">
                            <h4 className="text-[10px] uppercase tracking-wider text-red-400/80 mb-1 font-bold">{isArabic ? 'المحاولات الفاشلة' : 'Failed Attempts'}</h4>
                            <p className="text-xs text-zinc-400 font-mono leading-relaxed text-start rtl:text-right" dir="ltr">{issue.attemptedFixes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Resolved Issues */}
          <div>
            <h3 className="text-sm font-bold text-green-500 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {isArabic ? 'الإصلاحات المنجزة' : 'Resolved Fixes'} ({resolvedIssues.length})
            </h3>
            <div className="flex flex-col gap-3">
              {resolvedIssues.length === 0 ? (
                <div className="text-sm text-zinc-500 italic bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50 text-center">
                  {isArabic ? 'لم يتم تسجيل أي إصلاحات حتى الآن.' : 'No resolved fixes recorded yet.'}
                </div>
              ) : (
                resolvedIssues.map(issue => (
                  <div key={issue.id} className="bg-green-950/10 border border-green-900/30 rounded-xl p-4 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <div className="flex gap-3">
                      <div className="mt-1"><CheckCircle2 className="w-4 h-4 text-green-500" /></div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-300 line-through decoration-green-900/80">{issue.description}</p>
                        {issue.attemptedFixes && (
                          <div className="mt-2 text-[10px] text-zinc-500 flex items-start gap-1.5">
                            <TerminalSquare className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="leading-snug">
                              {isArabic ? 'الأنماط المتجنبة:' : 'Avoided patterns:'} <span dir="ltr" className="inline-block mt-0.5">{issue.attemptedFixes}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
