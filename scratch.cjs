const fs = require('fs'); 
const lines = fs.readFileSync('src/components/NexusChat.tsx', 'utf8').split('\n'); 
const before = lines.slice(0, 36); 
const after = lines.slice(411); 
const importStatements = [
  "import { MessageBubble } from '@/features/chat/components/MessageBubble';",
  "import { MessageCopyButton, ActionableCodeBlock, RelativeTime, LoadingBubble } from '@/features/chat/components/ChatUIPrimitives';"
]; 
const newLines = [...before, ...importStatements, '', ...after]; 
fs.writeFileSync('src/components/NexusChat.tsx', newLines.join('\n'));
