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
