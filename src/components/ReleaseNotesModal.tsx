import { Bug, BrainCircuit, Search, MessageSquare, MousePointer2, RotateCw, Sparkles, X } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

export function ReleaseNotesModal({ onClose }: { onClose: () => void }) {
  const { globalDefaults } = useSettings();
  const isArabic = globalDefaults?.userLang?.startsWith('ar');

  const features = [
    {
      icon: Bug,
      title: isArabic ? "سجل المشاكل" : "Issues Scratchpad",
      desc: isArabic ? "يتذكر نكسس الآن بشكل دائم الأخطاء النشطة والإصلاحات الفاشلة السابقة لتجنب تكرارها أو الدخول في دوامة الذكاء الاصطناعي." : "Nexus now permanently remembers active bugs and past failed fixes to prevent the 'AI loop of death.'"
    },
    {
      icon: BrainCircuit,
      title: isArabic ? "مسار الذاكرة المستمر" : "Continuous Memory Pipeline",
      desc: isArabic ? "يضمن التلخيص التلقائي في الخلفية ألا يفقد نكسس مسار التقنيات المستخدمة أو بنية المشروع في المحادثات الطويلة." : "Background summarization ensures Nexus never loses track of your tech stack or architecture in long conversations."
    },
    {
      icon: Search,
      title: isArabic ? "بحث عميق غير متزامن" : "Async Deep-Search",
      desc: isArabic ? "استعلم فوراً في قواعد البيانات التاريخية للعثور على مقتطفات الأكواد البرمجية عبر جميع جلساتك السابقة." : "Instantly query historical databases to find code snippets across all your past sessions."
    },
    {
      icon: MessageSquare,
      title: isArabic ? "البحث داخل المحادثة" : "In-Chat Search",
      desc: isArabic ? "إبراز وعزل مصطلحات معينة بوضوح داخل المخطط الزمني لمحادثتك النشطة." : "Visually highlight and isolate specific terms within your active conversation timeline."
    },
    {
      icon: MousePointer2,
      title: isArabic ? "التمرير التلقائي الذكي" : "Smart Auto-Scroll",
      desc: isArabic ? "تصفح سجل المحادثة للأعلى دون أن يتم سحبك للأسفل إجبارياً أثناء قيام الذكاء الاصطناعي بإنشاء الأكواد." : "Scroll back through chat history without being yanked to the bottom while the AI is generating code."
    },
    {
      icon: RotateCw,
      title: isArabic ? "إعادة توليد الرسائل" : "Message Regeneration",
      desc: isArabic ? "أعد توليد ردود الذكاء الاصطناعي واحذف التفرعات غير المرغوبة من المحادثة بنقرة واحدة." : "Seamlessly re-roll AI responses and prune conversational branches with a single click."
    }
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300 ${isArabic ? 'dir-rtl' : 'dir-ltr'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-primary/50 shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header Ribbon */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary tracking-wide uppercase">
                {isArabic ? "تحديث النظام: بنية نكسس الإصدار 1.0" : "SYSTEM UPDATE: Nexus Architecture V1.0"}
              </h2>
              <p className="text-sm text-zinc-400">
                {isArabic ? "بنية نكسس الإصدار 1.0" : "Nexus Architecture V1.0"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`text-zinc-500 hover:text-zinc-300 transition-colors ${isArabic ? 'me-auto ms-0' : ''}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrolling Content Area */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-6 border-b border-zinc-800/50 custom-scrollbar">
          <p className="text-zinc-300 mb-8 leading-relaxed text-[15px]">
            {isArabic 
              ? "تم ترقية بيئة نكسس الأساسية بشكل شامل في الخلفية لضمان استقرار المشاريع طويلة الأمد، السرعة، والاحتفاظ بالسياق العميق. راجع التحديثات التكتيكية التي تم نشرها في بيئة عملك:" 
              : "The core Nexus environment has been massively upgraded on the backend for long-term project stability, speed, and deep-context retention. Review the tactical upgrades deployed to your workspace:"}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
            {features.map((feat, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1 shrink-0 h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <feat.icon className="w-4 h-4 text-primary shrink-0" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-1">{feat.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-5 bg-zinc-900/30 flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
          <button 
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground focus:ring-4 focus:ring-primary/20 font-medium py-2.5 px-6 rounded-lg transition-all shadow-lg flex items-center gap-2"
          >
            {isArabic ? "فهمت، ابدأ التشغيل" : "Acknowledge & Initialize"}
          </button>
        </div>

      </div>
    </div>
  );
}
