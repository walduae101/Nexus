import { fastTask } from './gemini';

export interface Issue {
  id: string;
  status: 'open' | 'resolved';
  description: string;
  attemptedFixes: string;
}

export async function compressChatHistory(
  currentSummary: string, 
  currentIssues: Issue[] | undefined,
  newMessages: string
): Promise<{ projectSummary: string, issuesScratchpad: Issue[] } | null> {
  const issuesStr = JSON.stringify(currentIssues || []);
  const prompt = `You are an expert system architect and project manager tracking state in the background.

YOUR TASK:
Analyze the new context. Update the project summary AND the issues scratchpad.

1. PROJECT SUMMARY: Keep it highly compressed, technical, and factual. Track: Tech Stack, Core Architecture, Completed Features, and Current Objective.
2. ISSUES SCRATCHPAD: Extract active bugs or errors mentioned. If an existing issue was confirmed fixed in the context, change its status to "resolved". If fixes failed, append them to "attemptedFixes". If new errors originated, add them as "open".

CRITICAL ISSUE DETECTION: You must extract active bugs from TWO sources: 1) Explicit user complaints in the text. 2) Implicit errors found inside any \`IDE Payload\` blocks (e.g., stack traces, red screen errors, failing tests). If a payload contains an error, log it as an active issue immediately, even if the user did not explicitly report it.

Current Summary: ${currentSummary || 'None'}
Current Issues: ${issuesStr}

New Context: 
"""
${newMessages}
"""

CRITICAL RULE: You MUST output ONLY valid JSON using this EXACT schema, with NO markdown formatting, no \`\`\`json block, and no extra text:
{
  "projectSummary": "...",
  "issuesScratchpad": [
    { "id": "issue-123", "status": "open", "description": "...", "attemptedFixes": "..." }
  ]
}`;

  try {
    const responseText = await fastTask(prompt);
    // Strip possible code block formatting if hallucinated
    const cleanedJson = responseText.replace(/^```json\n?|```$/gm, '').trim();
    const result = JSON.parse(cleanedJson);
    return {
      projectSummary: result.projectSummary || currentSummary,
      issuesScratchpad: result.issuesScratchpad || currentIssues || []
    };
  } catch (err) {
    console.error('Failed to compress chat history and issues', err);
    return null;
  }
}
