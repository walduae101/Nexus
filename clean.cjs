const fs = require('fs');

const path = 'src/features/chat/components/NexusChat.tsx';
let txt = fs.readFileSync(path, 'utf8');

const target1 = "        // Final constraint injection overriding immediately prior to transmission";
const target2 = "        finalAiPrompt += `\\n\\n[CRITICAL SYSTEM REMINDER: You are an Autonomous IDE Compiler. DO NOT output a tutorial, explanations, or step-by-step guide. You MUST output a maximum 2-sentence acknowledgment followed immediately by the \\`\\`\\`markdown [COPY THIS TO ANTIGRAVITY IDE] payload block containing the execution commands.]`;";

txt = txt.replace(target1, "");
txt = txt.replace(target2, "");

fs.writeFileSync(path, txt, 'utf8');
console.log("Cleaned NexusChat.");
