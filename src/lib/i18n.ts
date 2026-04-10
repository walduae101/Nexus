import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English Translation Resource
const en = {
  translation: {
    // General
    "default": "Default",
    "sync_existing": "Sync Existing Project",
    "sync_session_title": "Project Sync Session",
    "slogan": "UNIFIED WORKFLOW",
    "loading": "Loading...",
    "sign_in_google": "Sign in with Google",

    // Header & Sidebar
    "new_chat": "New Chat",
    "avatar": "Avatar",
    "logout": "Log Out",
    "just_now": "Just now",
    "pin_chat": "Pin",
    "edit_chat": "Edit",
    "delete_chat": "Delete",
    "loading_text": "Nexus is typing...",
    "loading_tts": "Generating audio...",
    "loading_image": "Painting image...",
    "loading_search": "Searching the web...",
    "read_more": "Read more",
    "read_less": "Read less",

    // Empty States & Interactions
    "welcome": "Welcome to the Nexus.",
    "welcome_desc": "Enter your unstructured thoughts or IDE status report to begin.",
    "drop_files": "Drop files here",
    "drop_files_desc": "Upload images, audio, or video for Nexus to analyze",
    "input_placeholder": "Type a message or use /image, /search, /tts...",
    "ask_nexus": "Ask Nexus",
    "generate_image": "Generate Image",
    "search_web": "Search Web",
    "text_to_speech": "Text to Speech",
    "spoken_language": "Voice Input Language",
    "auto_copy_voice": "Auto-copy Voice Input",
    "error_failed": "Error: Failed to process request.",
    "ide_payload": "IDE Payload",
    "run_in": "Run in {{target}}",
    "dispatching": "Dispatching...",
    "dispatched": "Dispatched",
    "sparks_title": "Sparks",
    "new_spark": "Draft a new thought...",
    "enhance_spark": "Enhance Idea",
    "deploy_spark": "Send to Chat",
    "add_spark": "Add Spark",
    "empty_sparks": "Your scratchpad is empty. Jot down a brilliant idea!",
    "sparks_intro_title": "Introducing Sparks 💡",
    "sparks_intro_desc": "Your private cognitive buffer. Here is what you can do:",
    "sparks_intro_f1": "Draft messy ideas without sending them to the chat.",
    "sparks_intro_f2": "Enhance your thoughts into perfect prompts using AI.",
    "sparks_intro_f3": "Nexus silently reads your Sparks to align with your goals, even if you don't mention them!",
    "sparks_intro_btn": "Got it, let's go!",
    "suggest_sparks": "Auto-Suggest Ideas",
    "generating_sparks": "Brainstorming...",
    "dual_mode": "Dual Input Mode",
    "user_note": "Your Note...",
    "ide_payload": "Paste IDE Context/Code...",
    "attached_ide": "IDE Context Attached",
    "dual_intro_title": "Meet Dual Input Mode 🎛️",
    "dual_intro_desc": "Say goodbye to messy text walls! We've upgraded how you talk to Nexus:",
    "dual_intro_f1": "Separate Context: Paste your massive code blocks into the IDE Payload tab.",
    "dual_intro_f2": "Clear Questions: Type your actual question in the User Note tab.",
    "dual_intro_f3": "Smarter AI: Nexus will read both perfectly, keeping your chat feed clean and organized.",
    "dual_intro_btn": "Awesome, let's code!",

    // Chat Settings Dialog
    "session_settings": "Chat Session Settings",
    "session_settings_desc": "Configure the behavior and output of this specific chat session.",
    "user_output_language": "User Output Language",
    "user_output_desc": "The language the AI uses to explain strategies and converse with you.",
    "ide_prompt_language": "IDE Prompt Language",
    "ide_prompt_desc": "The language used for the raw command payload sent to your IDE.",
    "target_ide": "Target IDE",
    "target_ide_desc": "The IDE where the generated commands will be executed.",
    "complexity_mode": "Complexity Mode",
    "complexity_mode_desc": "Determines technical depth. 'Advanced' allows raw code snippets; 'Simple' removes jargon.",
    "custom_instructions": "Custom Instructions",
    "custom_instructions_desc": "Injects your saved custom behavioral rules into the AI's system prompt.",
    "custom_instructions_placeholder": "e.g., Always use TypeScript interfaces instead of types...",
    "ai_model": "AI Model",
    "ai_model_desc": "Select the Gemini model powering this specific chat session.",

    // Global Settings
    "global_settings_hub": "Global Settings Hub",
    "tech_stack": "Tech Stack",
    "github_repo": "GitHub Repository",
    "select_env": "Select Environment",
    "add_custom_tech": "Add Custom",
    "custom_tech_placeholder": "e.g. Svelte, Prisma, Docker...",
    "tab_defaults": "Defaults",
    "tab_langs": "Langs",
    "tab_ides": "IDEs",
    "tab_prompts": "Prompts",
    "tab_modes": "Modes",

    // Global Defaults Panel
    "default_user_language": "Default User Language",
    "select_user_language": "Select User Language",
    "default_ide_language": "Default IDE Language",
    "select_ide_language": "Select IDE Language",
    "default_target_ide": "Default Target IDE",
    "select_default_ide": "Select Default IDE",
    "default_custom_instructions": "Default Custom Instructions",
    "typography_settings": "Typography",
    "font_family": "Font Family",
    "font_size": "Font Size",
    "size_small": "Small",
    "size_medium": "Medium",
    "size_large": "Large",
    "font_system": "System Default",
    "font_cairo": "Cairo (Arabic)",
    "font_tajawal": "Tajawal (Arabic)",
    
    // Select Group Labels
    "official_languages": "Official Languages",
    "my_custom_languages": "My Custom Languages",
    "official_defaults": "Official Defaults",
    "my_custom_ides": "My Custom IDEs",

    // Languages Tab
    "name_placeholder_lang": "Name (e.g. Spanish)",
    "value_placeholder_lang": "Value (e.g. es-ES)",
    
    // IDEs Tab
    "name_placeholder_ide": "Name (e.g. VS Code)",
    "value_placeholder_ide": "Value (e.g. vscode)",

    // Prompts Tab
    "title_placeholder": "Title",
    "content_placeholder": "Content",
    "add_instruction": "Add Instruction",

    // Modes Tab
    "mode_name_placeholder": "Mode Name (e.g. CUSTOM)",
    "mode_rules_placeholder": "Mode Rules",
    "add_mode": "Add Mode",
    "mode_simple": "Zero technical jargon. Explain the prompt strategy conceptually and generate the IDE command using basic, layman logic.",
    "mode_specific": "Use exact technical architecture terms, framework names, and precise logic flow, but strictly adhere to ZERO code snippets.",
    "mode_advanced": "Senior expert level. You are explicitly authorized to override the \"No Code\" constraint. Provide structural code scaffolding, interfaces, and exact syntax examples within the generated IDE command to guide execution.",
    "simple": "SIMPLE",
    "specific": "SPECIFIC",
    "advanced": "ADVANCED",
    "custom": "CUSTOM",

    // Onboarding Wizard
    "welcome_to_nexus": "Welcome to Nexus",
    "step_indicator": "Step {1} of {2}",
    "spoken_language_desc": "The native language you will be speaking into the microphone.",
    "next": "Next",
    "back": "Back",
    "launch_nexus": "Launch Nexus",

    // UI Additions
    "premade": "PREMADE",
    "new_session": "New Session",
    
    // Model Names
    "model_pro": "Pro (Complex/Thinking)",
    "model_flash": "Flash (General)",
    "model_flash_lite": "Flash Lite (Fast)",

    // Dialogs
    "delete_session_title": "Delete Chat Session",
    "delete_session_desc": "Are you sure you want to delete this chat session? This action cannot be undone and all messages will be permanently removed.",
    "cancel": "Cancel",
    "delete": "Delete"
  }
};

// Arabic Translation Resource
const ar = {
  translation: {
    // General
    "default": "الافتراضي",
    "sync_existing": "مزامنة المشروع الحالي",
    "sync_session_title": "جلسة مزامنة المشروع",
    "slogan": "سير عمل موحد",
    "loading": "جاري التحميل...",
    "sign_in_google": "تسجيل الدخول باستخدام جوجل",

    // Header & Sidebar
    "new_chat": "محادثة جديدة",
    "avatar": "الصورة الرمزية",
    "logout": "تسجيل الخروج",
    "just_now": "الآن",
    "pin_chat": "تثبيت",
    "edit_chat": "تعديل",
    "delete_chat": "حذف",
    "loading_text": "Nexus يكتب...",
    "loading_tts": "جاري توليد الصوت...",
    "loading_image": "جاري رسم الصورة...",
    "loading_search": "جاري البحث في الويب...",
    "read_more": "قراءة المزيد",
    "read_less": "عرض أقل",

    // Empty States & Interactions
    "welcome": "مرحباً بك في Nexus.",
    "welcome_desc": "أدخل أفكارك غير المنظمة أو تقرير حالة بيئة التطوير للبدء.",
    "drop_files": "أفلت الملفات هنا",
    "drop_files_desc": "قم بتحميل الصور أو الصوت أو الفيديو ليقوم نكسيوس بتحليله",
    "input_placeholder": "اكتب رسالة أو استخدم /image، /search، /tts...",
    "ask_nexus": "اسأل Nexus",
    "generate_image": "توليد صورة",
    "search_web": "البحث في الويب",
    "text_to_speech": "تحويل النص إلى صوت",
    "spoken_language": "لغة الإدخال الصوتي",
    "auto_copy_voice": "النسخ التلقائي للإدخال الصوتي",
    "error_failed": "خطأ: فشل في معالجة الطلب.",
    "ide_payload": "حزمة أوامر بيئة التطوير",
    "run_in": "تشغيل في {{target}}",
    "dispatching": "جاري الإرسال...",
    "dispatched": "تم الإرسال",
    "sparks_title": "شرارات",
    "new_spark": "اكتب فكرة جديدة...",
    "enhance_spark": "تحسين الفكرة",
    "deploy_spark": "إرسال للمحادثة",
    "add_spark": "إضافة",
    "empty_sparks": "مسودة الأفكار فارغة. دوّن أفكارك هنا!",
    "sparks_intro_title": "تقديم ميزة الشرارات (Sparks) 💡",
    "sparks_intro_desc": "مساحتك الخاصة لعصف الأفكار. إليك ما يمكنك فعله:",
    "sparks_intro_f1": "دوّن أفكارك غير المكتملة دون إرسالها للمحادثة.",
    "sparks_intro_f2": "حسّن أفكارك وحولها إلى أوامر احترافية بضغطة زر.",
    "sparks_intro_f3": "يقرأ Nexus أفكارك بصمت ليفهم أهدافك العميقة، حتى لو لم تتحدث عنها!",
    "sparks_intro_btn": "علم، لننطلق!",
    "suggest_sparks": "اقتراح أفكار ذكية",
    "generating_sparks": "جاري العصف الذهني...",
    "dual_mode": "وضع الإدخال المزدوج",
    "user_note": "ملاحظتك...",
    "ide_payload": "ألصق سياق/كود بيئة التطوير...",
    "attached_ide": "مرفق سياق بيئة التطوير",
    "dual_intro_title": "تعرف على الإدخال المزدوج 🎛️",
    "dual_intro_desc": "وداعاً للنصوص الطويلة المزعجة! قمنا بتحديث طريقة تواصلك مع Nexus:",
    "dual_intro_f1": "فصل السياق: قم بلصق الأكواد الطويلة في خانة بيئة التطوير (IDE Payload).",
    "dual_intro_f2": "أسئلة واضحة: اكتب سؤالك المباشر في خانة ملاحظة المستخدم (User Note).",
    "dual_intro_f3": "ذكاء أكبر: سيفهم Nexus الاثنين معاً، مع الحفاظ على نظافة وترتيب المحادثة.",
    "dual_intro_btn": "رائع، لنبدأ البرمجة!",

    // Chat Settings Dialog
    "session_settings": "إعدادات جلسة المحادثة",
    "session_settings_desc": "قم بتكوين سلوك ومخرجات جلسة المحادثة هذه.",
    "user_output_language": "لغة مخرجات المستخدم",
    "user_output_desc": "اللغة التي يستخدمها الذكاء الاصطناعي لشرح الاستراتيجيات والتحدث معك.",
    "ide_prompt_language": "لغة توجيهات بيئة التطوير",
    "ide_prompt_desc": "اللغة المستخدمة في حملة الأوامر المرسلة إلى بيئة التطوير الخاصة بك.",
    "target_ide": "بيئة التطوير المستهدفة",
    "target_ide_desc": "بيئة التطوير التي سيتم تنفيذ الأوامر الناتجة عليها.",
    "complexity_mode": "مستوى التعقيد",
    "complexity_mode_desc": "يحدد العمق الفني. 'متقدم' يسمح بمقتطفات التعليمات البرمجية؛ 'بسيط' يزيل المصطلحات المعقدة.",
    "custom_instructions": "التعليمات المخصصة",
    "custom_instructions_desc": "يقوم بإدخال قواعد السلوك المخصصة المحفوظة الخاصة بك في نظام توجيه الذكاء الاصطناعي.",
    "custom_instructions_placeholder": "مثال: استخدم دائماً واجهات TypeScript بدلاً من الأنواع...",
    "ai_model": "نموذج الذكاء الاصطناعي",
    "ai_model_desc": "اختر نموذج جيمناي الذي يقوي هذه المحادثة.",

    // Global Settings
    "global_settings_hub": "مركز الإعدادات العامة",
    "tech_stack": "حزمة التقنيات",
    "github_repo": "مستودع جيت هاب",
    "select_env": "اختيار بيئة العمل",
    "add_custom_tech": "إضافة مخصصة",
    "custom_tech_placeholder": "مثال: Svelte, Prisma, Docker...",
    "tab_defaults": "الافتراضيات",
    "tab_langs": "اللغات",
    "tab_ides": "بيئات العمل",
    "tab_prompts": "المحفزات",
    "tab_modes": "الأوضاع",

    // Global Defaults Panel
    "default_user_language": "لغة المستخدم الافتراضية",
    "select_user_language": "اختر لغة المستخدم",
    "default_ide_language": "لغة بيئة التطوير الافتراضية",
    "select_ide_language": "اختر لغة بيئة التطوير",
    "default_target_ide": "بيئة التطوير المستهدفة الافتراضية",
    "select_default_ide": "اختر البيئة الافتراضية",
    "default_custom_instructions": "التعليمات المخصصة الافتراضية",
    "typography_settings": "الخطوط والنصوص",
    "font_family": "نوع الخط",
    "font_size": "حجم الخط",
    "size_small": "صغير",
    "size_medium": "متوسط",
    "size_large": "كبير",
    "font_system": "الخط الافتراضي للنظام",
    "font_cairo": "Cairo (عربي)",
    "font_tajawal": "Tajawal (عربي)",
    
    // Select Group Labels
    "official_languages": "اللغات الرسمية",
    "my_custom_languages": "لغاتي المخصصة",
    "official_defaults": "الافتراضيات الرسمية",
    "my_custom_ides": "بيئات التطوير الخاصة بي",

    // Languages Tab
    "name_placeholder_lang": "الاسم (مثال: الإسبانية)",
    "value_placeholder_lang": "القيمة (مثال: es-ES)",
    
    // IDEs Tab
    "name_placeholder_ide": "الاسم (مثال: VS Code)",
    "value_placeholder_ide": "القيمة (مثال: vscode)",

    // Prompts Tab
    "title_placeholder": "العنوان",
    "content_placeholder": "المحتوى",
    "add_instruction": "إضافة تعليمة",

    // Modes Tab
    "mode_name_placeholder": "اسم الوضع (مثال: مُخصص)",
    "mode_rules_placeholder": "قواعد الوضع",
    "add_mode": "إضافة وضع",
    "mode_simple": "بدون مصطلحات تقنية معقدة. اشرح استراتيجية التلقين بشكل مبسط وقم بإنشاء أمر بيئة التطوير باستخدام منطق أساسي وبسيط.",
    "mode_specific": "استخدم مصطلحات معمارية تقنية دقيقة وأسماء أطر العمل وتدفق منطقي دقيق، مع الالتزام التام بعدم كتابة أي مقتطفات برمجية.",
    "mode_advanced": "مستوى خبير أول. مصرح لك صراحةً بتجاوز قيد 'عدم كتابة كود'. قم بتوفير هيكلة برمجية، واجهات، وأمثلة دقيقة للصيغ داخل أمر بيئة التطوير.",
    "simple": "مُبسط",
    "specific": "دقيق",
    "advanced": "مُتقدم",
    "custom": "مُخصص",

    // Onboarding Wizard
    "welcome_to_nexus": "مرحباً بك في Nexus",
    "step_indicator": "الخطوة {1} من {2}",
    "spoken_language_desc": "اللغة الأم التي ستتحدث بها عبر الميكروفون.",
    "next": "التالي",
    "back": "رجوع",
    "launch_nexus": "بدء الاستخدام",

    // UI Additions
    "premade": "مُعَد مسبقاً",
    "new_session": "جلسة جديدة",
    
    // Model Names
    "model_pro": "برو (معقد/تفكير)",
    "model_flash": "فلاش (عام)",
    "model_flash_lite": "فلاش لايت (سريع)",

    // Dialogs
    "delete_session_title": "حذف جلسة المحادثة",
    "delete_session_desc": "هل أنت متأكد أنك تريد حذف جلسة المحادثة هذه؟ لا يمكن التراجع عن هذا الإجراء وستتم إزالة جميع الرسائل بشكل دائم.",
    "cancel": "إلغاء",
    "delete": "حذف"
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en,
      ar
    },
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
