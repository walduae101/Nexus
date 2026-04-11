export interface SavedItem {
  id: string;
  name: string;
  value: string;
  isDefault?: boolean;
}

export interface SavedInstruction {
  id: string;
  title: string;
  content: string;
}

export interface CustomMode {
  id: string;
  name: string;
  rules: string;
  isPremade?: boolean;
}

export interface GlobalDefaults {
  userLang: string;
  ideLang: string;
  targetIde: string;
  customInstructions: string;
  complexityMode: string;
  spokenLanguage: string;
  hasCompletedOnboarding?: boolean;
  fontFamily: string;
  fontSize: string;
  globalTechStack?: string[];
  autoCopyVoice?: boolean;
  enableDualMode?: boolean;
}

export const IDE_PROFILES = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    canDo: ['Autonomously create, read, and edit files', 'Execute terminal commands natively', 'Deploy to cloud directly'],
    cannotDo: ['Cannot physically test UI on a real mobile device']
  },
  {
    id: 'cursor',
    name: 'Cursor',
    canDo: ['Edit files autonomously via Composer', 'Run terminal commands if approved by user'],
    cannotDo: ['Cannot autonomously browse the live web without specific tools']
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    canDo: ['Deep workspace context awareness', 'Autonomous agentic coding and file creation'],
    cannotDo: ['Cannot bypass human approval for destructive actions']
  },
  {
    id: 'vscode',
    name: 'VS Code (Standard)',
    canDo: ['Highlight syntax', 'Accept standard markdown code blocks'],
    cannotDo: ['CANNOT autonomously edit files', 'CANNOT run terminal commands automatically. User MUST copy/paste the payload manually.']
  },
  {
    id: 'claude',
    name: 'Claude (Desktop / Code)',
    canDo: [
      'Connect to local databases, tools, and file systems via Model Context Protocol (MCP)',
      'Navigate, click, and inspect live websites autonomously using Browser Tools (Computer Use)',
      'Autonomously execute terminal commands and manipulate deep file structures (via Claude Code CLI)'
    ],
    cannotDo: [
      'Lacks a traditional integrated code editor GUI (operates strictly via Chat UI or CLI)',
      'Requires manual user configuration to start and expose local MCP servers before use',
      'May require human approval for highly destructive terminal commands'
    ]
  }
];

export const PREMADE_MODES: CustomMode[] = [
  { id: 'premade-simple', name: 'SIMPLE', rules: 'Zero technical jargon. Explain the prompt strategy conceptually and generate the IDE command using basic, layman logic.', isPremade: true },
  { id: 'premade-specific', name: 'SPECIFIC', rules: 'Use exact technical architecture terms, framework names, and precise logic flow, but strictly adhere to ZERO code snippets.', isPremade: true },
  { id: 'premade-advanced', name: 'ADVANCED', rules: 'Senior expert level. You are explicitly authorized to override the "No Code" constraint. Provide structural code scaffolding, interfaces, and exact syntax examples within the generated IDE command to guide execution.', isPremade: true }
];

export const DEFAULT_IDES = ["Antigravity", "Claude", "Cursor", "VS Code", "Windsurf", "JetBrains", "Neovim"];

export const DEFAULT_LANGUAGES = [
  { name: "English (US)", value: "en-US" },
  { name: "Arabic (UAE)", value: "ar-AE" },
  { name: "Spanish (Global)", value: "es-ES" },
  { name: "Chinese (Simplified)", value: "zh-CN" },
  { name: "French (Global)", value: "fr-FR" }
];
