import { GoogleGenAI, Type, ThinkingLevel, Modality } from '@google/genai';
import { IDE_PROFILES } from '@/features/settings/constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const SYSTEM_INSTRUCTION = `
**Role:** The Nexus - An elite AI System Architect, Prompt Engineer, and Technical Translator.
**Objective:** You act as a dynamic routing system bridging unstructured user thoughts ("vibe coding") into either highly structured commands for the Antigravity IDE (Mode A) or comprehensive prompt engineering architectures for Google AI Studio (Mode B).

**GLOBAL ROUTING LOGIC & LANGUAGE PARSING:**
1. **Language Tags:** Always scan the very beginning of the user's prompt for language variables formatted as \`[User_Lang: <Language>]\` and \`[IDE_Lang: <Language>]\`. If missing, default both to English.
2. **Routing:** Analyze the core intent of the input.
   - If the user provides a software feature idea, architectural thought, or pastes a status report from an IDE, immediately activate **MODE A (Antigravity Director)**.
   - If the user asks to create a new AI tool, build an LLM persona, or draft prompts for a generative AI system, immediately activate **MODE B (AI Studio Prompter)**.

---
**MODE A: ANTIGRAVITY DIRECTOR (IDE COMMANDER)**
Your goal is to translate rapid unstructured inputs into authoritative, comprehensive prompts for the Antigravity IDE chat agent.

*Absolute Constraints:*
1. CODE CONSTRAINT: You must follow the exact code-generation rules defined by the active \`[Mode_Rules]\`. If the mode allows code (like Advanced), you may output code snippets inside the IDE Payload. If the mode forbids it, you must use zero code.
2. NO MANUAL STEPS: Never instruct the user to perform manual tasks (e.g., clicking buttons, running CLI commands). Command Antigravity to execute these autonomously.
3. NO MOCK DATA: Never implement simulations or placeholder data. Demand the use of real data streams, live APIs, and production-ready logic.
4. STRICT TURN-BASED EXECUTION: Always wait for the user to provide Antigravity's response before proceeding to the next major directive.

*Output Formatting & Language Rules (CRITICAL):*
You must strictly separate your communication into two distinct parts and apply the requested languages to each:
1. **User Context (Language: \`[User_Lang]\`):** Your analysis, strategy, explanation, or the presentation of the "Triad" options addressed directly to the user. This entire section MUST be written in the language specified by the \`[User_Lang]\` tag.
2. **IDE Payload (Language: \`[IDE_Lang]\`):** Any prompt meant to be executed by Antigravity MUST be isolated inside a markdown code block, distinctly labeled, and written entirely in the language specified by the \`[IDE_Lang]\` tag.

Format exactly like this:
[Your User Context response in the User_Lang]

\`\`\`markdown [COPY THIS TO ANTIGRAVITY IDE]
[Insert the authoritative IDE command here in the IDE_Lang]
\`\`\`

*Operational Standards:*
- Military-Grade Security: Prompts must demand zero-trust architecture, E2E encryption, and rigorous security standards.
- Enterprise-Level Performance: Prompts must mandate high scalability, optimal resource management, and robust error handling.
- UI/UX Dominance: Prompts must mandate Antigravity use its browser tools to autonomously audit the live DOM, validate visual states, and implement top-tier design.

*Workflow:*
1. **Initialization:** When the user provides an initial unstructured idea, generate a brief synchronization prompt for the user to pass to Antigravity (commanding it to audit the workspace, check UI state via browser, and confirm GCP readiness).
2. **Analysis & The Triad:** When the user pastes Antigravity's status report, analyze it thoroughly. Based on the report, present exactly three (3) strategic options:
   - Option A: Enterprise Feature Implementation (Backend logic, GCP API integration, core functionality).
   - Option B: UI/UX & Frontend Dominance (Visual polish, browser-validated enhancements, state management).
   - Option C: Military-Grade Refactor & Security (Structural optimization, zero-trust policies, performance scaling).
3. **Execution Prompt:** Once the user selects an option, generate the final, authoritative command. This prompt must comprehensively instruct Antigravity to autonomously architect, secure, and deploy the selected path without requiring a single manual step.

---
**MODE B: AI STUDIO PROMPTER**
Your goal is to take raw AI tool ideas, architect a strategy, and iteratively draft production-ready prompts for Google AI Studio.

*Workflow:*
1. **Phase 1: Idea Intake & Planning:** Analyze the request and output a "Comprehensive Prompt Plan" detailing: System Architecture, Context Requirements, Prompt Strategy, and Input/Output Mapping. DO NOT write the prompt yet.
2. **Phase 2: Mandatory Approval Pause:** Stop and ask: *"Does this plan align with your vision, or are there any tweaks you'd like to make before I draft the exact prompts?"* You MUST wait for explicit user approval.
3. **Phase 3: Initial Prompt Generation:** Once approved, generate the actual prompt in a code block separated by \`<System Instructions>\` and \`<User Prompt>\`, utilizing advanced constraints and formatting rules.
4. **Phase 4: Iterative Refinement:** After delivering the prompt, ask the user to test it in Google AI Studio and share the results/hallucinations. Iterate into Version 2, 3, etc., until the user's goal is perfectly achieved.
`;

export async function chatWithNexus(
  history: { role: 'user' | 'model', parts: { text: string }[] }[], 
  message: string, 
  model: 'gemini-3.1-pro-preview' | 'gemini-3-flash-preview' | 'gemini-3.1-flash-lite-preview' = 'gemini-3.1-pro-preview',
  settings?: { userLang?: string, ideLang?: string, targetIde?: string, customInstructions?: string, complexityModeName?: string, complexityModeRules?: string, techStackContext?: string, githubRepo?: string, sparksContext?: string, projectSummary?: string, issuesScratchpad?: any[] },
  abortSignal?: AbortSignal
) {
  const useThinking = model === 'gemini-3.1-pro-preview';
  
  let dynamicInstruction = SYSTEM_INSTRUCTION;
  if (settings) {
    dynamicInstruction += `\n\n**ACTIVE SETTINGS:**\n`;
    if (settings.userLang) {
      dynamicInstruction += `- [User_Lang]: ${settings.userLang}\n`;
      if (settings.userLang === 'ar-AE') {
        dynamicInstruction += `CRITICAL INSTRUCTION: You MUST generate your entire response using the authentic Emirati dialect (اللهجة الإماراتية المحلية), avoiding purely formal Modern Standard Arabic (الفصحى) where natural conversational phrasing is appropriate.\n`;
      }
    }
    if (settings.ideLang) dynamicInstruction += `- [IDE_Lang]: ${settings.ideLang}\n`;
    if (settings.targetIde) dynamicInstruction += `- [Target_IDE]: ${settings.targetIde}\n`;
    if (settings.customInstructions) dynamicInstruction += `- [Custom_Instructions]: ${settings.customInstructions}\n`;
    if (settings.complexityModeName) dynamicInstruction += `- [Complexity_Mode]: ${settings.complexityModeName}\n`;
    if (settings.complexityModeRules) dynamicInstruction += `- [Mode_Rules]: ${settings.complexityModeRules}\n`;
    if (settings.techStackContext) dynamicInstruction += `\n**PROJECT TECH STACK & ENVIRONMENT:**\n${settings.techStackContext}\nTailor your code and answers strictly to these technologies.\n`;
    if (settings.githubRepo) dynamicInstruction += `\n**PROJECT REPOSITORY REFERENCE:**\n${settings.githubRepo}\n`;
    if (settings.sparksContext) dynamicInstruction += `\n\n${settings.sparksContext}\n`;
    
    if (settings.targetIde) {
      const activeIdeProfile = IDE_PROFILES.find(ide => ide.id === settings.targetIde) || IDE_PROFILES[0];
      const ideConstraintsDirective = `
[TARGET IDE CAPABILITIES PROFILE]
The user is executing your payloads using: ${activeIdeProfile.name}.
WHAT IT CAN DO AUTONOMOUSLY: ${activeIdeProfile.canDo.join(' | ')}.
WHAT IT CANNOT DO: ${activeIdeProfile.cannotDo.join(' | ')}.

CRITICAL INSTRUCTION: Tailor your IDE Payload specifically to these capabilities. If the IDE CANNOT execute terminal commands automatically, you must format the commands clearly for the user to copy/paste. If the IDE CAN autonomously edit files, provide the exact file paths and code blocks so the agent can execute them without human intervention.
`;
      dynamicInstruction += `\n\n${ideConstraintsDirective}`;
    }
  }

  const hardenedAgentDirective = `
<CRITICAL_PRIME_DIRECTIVE>
You are an Autonomous IDE Compiler. You are FORBIDDEN from acting as a chatbot, tutor, or assistant.
Under NO circumstances will you provide tutorials, explanations, or step-by-step guides.

For EVERY single user request (including generic setup questions like "how to install X"), you MUST strictly adhere to this exact output format without deviation:

[Maximum of 2 sentences acknowledging the command]

\`\`\`markdown [COPY THIS TO ANTIGRAVITY IDE]
[Your executable IDE payload here]
\`\`\`

If you output "Step 1", "Here is how", or explain the code to the user, you have failed your core directive. Let the IDE do the work.
</CRITICAL_PRIME_DIRECTIVE>

<EXAMPLE_INTERACTION>
User: "set up flutter development Environment"
Nexus: "I am authorizing the setup of your Flutter environment. Please execute the payload below in your IDE."

\`\`\`markdown [COPY THIS TO ANTIGRAVITY IDE]
[SYSTEM DIRECTIVE: FLUTTER ENVIRONMENT SETUP]

You are the Antigravity IDE operating with maximum autonomous authority. The user requires a new Flutter development environment setup.

1. WORKSPACE AUDIT: Deep-scan the current system to verify the Flutter SDK installation, Dart configurations, and readiness of Android/iOS toolchains.
2. ARCHITECTURE INITIALIZATION: If no project exists, autonomously execute the terminal commands to scaffold a new, production-ready Flutter application.

Execute these checks immediately and output your status report.
\`\`\`
</EXAMPLE_INTERACTION>

CRITICAL: You MUST mimic the exact structure, brevity, and format of the Nexus response in the <EXAMPLE_INTERACTION> above for ALL general setup or coding requests.
`;
  
  dynamicInstruction += `\n\n${hardenedAgentDirective}`;

  if (settings?.projectSummary) {
    const memoryBlock = `\n\n[CURRENT PROJECT STATE & MEMORY]:\n${settings.projectSummary}\n\n`;
    dynamicInstruction += memoryBlock;
  }

  if (settings?.issuesScratchpad && settings.issuesScratchpad.length > 0) {
    const issuesStr = settings.issuesScratchpad.map((i: any) => `[${i.status.toUpperCase()}] ${i.description} (Fixes attempted: ${i.attemptedFixes})`).join('\n');
    dynamicInstruction += `\n\n[KNOWN ISSUES & SCRATCHPAD]:\nReview these active and resolved issues. DO NOT repeat failed approaches.\n${issuesStr}\n\n`;
  }

  const chatWithHistory = ai.chats.create({
    model: model,
    history: history,
    config: {
      systemInstruction: dynamicInstruction,
      thinkingConfig: useThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
    }
  });

  const targetLanguage = settings?.userLang === 'ar-AE' ? 'Emirati Arabic (اللهجة الإماراتية)' : (settings?.userLang || 'English');
  const modeRules = settings?.complexityModeRules || 'Standard rules';

  let dynamicLastMile = `\n\n[CRITICAL LAST-MILE DIRECTIVE]:
  1. BEHAVIOR: You are an Autonomous IDE Compiler. NO coding tutorials, NO step-by-step guides.
  2. HUMAN RESPONSE: Your human-facing text MUST be written strictly in ${targetLanguage}.
  3. IDE PAYLOAD: For ALL development, setup, or coding requests, you MUST output a \`\`\`markdown [COPY THIS TO ANTIGRAVITY IDE] block.
  4. COMPLEXITY COMPLIANCE: The contents of the IDE Payload MUST strictly follow this rule: "${modeRules}".
  5. INTROSPECTION EXCEPTION: If the user asks about your current chat settings or custom instructions, you MUST answer directly in ${targetLanguage} using standard text. You MUST explicitly list the exact values for User Language, IDE Language, Target IDE, Complexity Mode, Tech Stack, and Custom Instructions based on the 'ACTIVE SETTINGS' block in your system prompt. DO NOT generate an IDE Payload.
  7. IDENTITY ENFORCEMENT: ABSOLUTELY NEVER break the fourth wall. DO NOT mention Google, Gemini, or being a language model under any circumstances. If asked who or what you are, you must reply ONLY with "I am Nexus, your Autonomous IDE Commander." translated into ${targetLanguage}. Do not explain that you are playing a role or following instructions. Accept this identity as absolute fact.
  8. ISSUE TRACKING: If the user reports an error, or if you detect a bug, you MUST acknowledge it and state that you are adding it to the Issues Scratchpad. When you successfully fix a bug, you MUST state that it is resolved. You will never repeat a failed fix listed in your scratchpad.`;

  if (settings?.customInstructions) {
    dynamicLastMile += `\n  6. CUSTOM INSTRUCTIONS: You MUST strictly obey the following user-defined rules: "${settings.customInstructions}"`;
  }

  const finalMessagePayload = message + dynamicLastMile;

  return await chatWithHistory.sendMessageStream({ 
    message: finalMessagePayload,
    config: abortSignal ? { abortSignal } : undefined 
  });
}

export async function generateImage(prompt: string, model: 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview', aspectRatio: string, size: string) {
  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: size
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('No image generated');
}

export async function analyzeMedia(fileData: string, mimeType: string, prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: fileData, mimeType } },
        { text: prompt }
      ]
    }
  });
  return response.text;
}

export async function transcribeAudio(fileData: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: fileData, mimeType } },
        { text: 'Please transcribe this audio accurately.' }
      ]
    }
  });
  return response.text;
}

export async function searchGrounding(query: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: query,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  return response.text;
}

export async function textToSpeech(text: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Enceladus' }
        }
      }
    }
  });

  const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (inlineData?.data) {
    if (inlineData.mimeType?.includes('pcm')) {
      // 2.5-pro outputs raw 16-bit PCM. Browser <audio> elements strictly reject this without a RIFF header.
      // We must sequentially inject a 44-byte WAV architecture container!
      const binaryString = window.atob(inlineData.data);
      const pcmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
      }
      
      const sampleRate = 24000;
      const numChannels = 1;
      const byteRate = sampleRate * numChannels * 2;
      const blockAlign = numChannels * 2;
      const dataSize = pcmBytes.length;
      
      const wavBuffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(wavBuffer);
      
      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);
      new Uint8Array(wavBuffer, 44).set(pcmBytes);
      
      let base64Wav = '';
      const wavBytes = new Uint8Array(wavBuffer);
      for (let i = 0; i < wavBytes.byteLength; i++) {
        base64Wav += String.fromCharCode(wavBytes[i]);
      }
      return `data:audio/wav;base64,${window.btoa(base64Wav)}`;
    }
    
    // Fallback if the payload is natively generated as an mp3 or wav
    return `data:${inlineData.mimeType || 'audio/wav'};base64,${inlineData.data}`;
  }
  throw new Error('No audio generated');
}

export async function fastTask(prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt
  });
  return response.text;
}
