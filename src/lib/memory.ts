import { fastTask } from './gemini';
import { doc, setDoc, getDoc, collection, query, where, orderBy, limit, getDocs , Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface Issue {
  id: string;
  status: 'open' | 'resolved';
  description: string;
  attemptedFixes: string;
}

export async function compressChatHistory(
  sessionId: string,
  currentSummary: string, 
  currentIssues: Issue[] | undefined,
  newMessages: string
): Promise<void> {
  const issuesStr = JSON.stringify(currentIssues || []);
  const prompt = `You are an expert system architect and project manager tracking state in the background.

YOUR TASK:
Analyze the new context. Update the project summary AND the issues scratchpad.

1. PROJECT SUMMARY: Keep it highly compressed, technical, and factual. Track: Tech Stack, Core Architecture, Completed Features, and Current Objective.
2. ISSUES SCRATCHPAD: Extract active bugs or errors mentioned. If an existing issue was confirmed fixed in the context, change its status to "resolved". If fixes failed, append them to "attemptedFixes". If new errors originated, add them as "open".

CRITICAL ISSUE DETECTION: You must extract active bugs from TWO sources: 1) Explicit user complaints in the text. 2) Implicit errors found inside any \`IDE Payload\` blocks (e.g., stack traces, red screen errors, failing tests). If a payload contains an error, log it as an active issue immediately, even if the user did not explicitly report it.

MATHEMATICAL PRIORITY RULE: You MUST prioritize explicitly acknowledged bugs in the very last user/assistant exchange above all earlier context. If the AI stated it is actively adding a bug to the scratchpad (e.g., "أضفتها للسجل", "I have registered a critical bug"), you MUST generate that structured JSON issue immediately without fail.

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

    // Reconciliation: safeguard the LLM output against silent drops.
    // 1) Any previously-resolved issue missing from the LLM response is re-injected (preserves history).
    // 2) Any previously-open issue completely omitted by the LLM is re-injected (prevents accidental loss).
    const llmIssues: Issue[] = Array.isArray(result.issuesScratchpad) ? result.issuesScratchpad : [];
    const previousIssues: Issue[] = currentIssues || [];
    const llmIds = new Set(llmIssues.map(i => i.id));
    const droppedResolved = previousIssues.filter(i => i.status === 'resolved' && !llmIds.has(i.id));
    const droppedOpen = previousIssues.filter(i => i.status === 'open' && !llmIds.has(i.id));
    const reconciledIssues: Issue[] = [...llmIssues, ...droppedResolved, ...droppedOpen];

    await setDoc(doc(db, 'chatSessions', sessionId), {
      projectSummary: result.projectSummary || currentSummary,
      issuesScratchpad: reconciledIssues,
      updatedAt: Timestamp.now()
    }, { merge: true });
    } catch (err) {
    console.error('Failed to compress chat history and issues', err);
  }
}

/**
 * Deterministic state transition for a single issue in a session's scratchpad.
 * Reads the current `issuesScratchpad`, mutates the entry with matching `issueId`,
 * and writes the array back with `merge: true`. Reactive `onSnapshot` listeners
 * in the UI pick up the change automatically — no manual refresh needed.
 */
export async function setIssueStatus(
  sessionId: string,
  issueId: string,
  status: 'open' | 'resolved'
): Promise<void> {
  try {
    const sessionRef = doc(db, 'chatSessions', sessionId);
    const snap = await getDoc(sessionRef);
    const current: Issue[] = (snap.data()?.issuesScratchpad as Issue[]) || [];
    const updated = current.map(i => (i.id === issueId ? { ...i, status } : i));
    await setDoc(
      sessionRef,
      {
        issuesScratchpad: updated,
        updatedAt: Timestamp.now()
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to update issue status', err);
  }
}

export async function getHistoricalContext(userId: string, excludeSessionId: string | null = null, daysWindow: number = 7): Promise<string> {
  try {
    const windowStartMs = Date.now() - (daysWindow * 24 * 60 * 60 * 1000);
    
    // Abstracted Historical Data Retrieval Engine
    // Construct compound query targeting historical sessions
    const sessionsQuery = query(
      collection(db, 'chatSessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );
    
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const recentSessions = sessionsSnapshot.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((s: any) => {
        const t = s.updatedAt?.toMillis?.() || Date.now();
        return t > windowStartMs && s.id !== excludeSessionId;
      });

    if (recentSessions.length === 0) return '';

    let historyLog = '';
    // Apply order: oldest of recent first or newest first? Let's do newest sessions first.
    for (const s of recentSessions) {
      const msgsQuery = query(
        collection(db, `chatSessions/${s.id}/messages`),
        orderBy('timestamp', 'desc'),
        limit(15) // fetch trailing context
      );
      const mSnap = await getDocs(msgsQuery);
      const msgs = mSnap.docs.map(d => d.data()).reverse(); // chronological
      
      if (msgs.length > 0) {
        historyLog += `\n--- [SESSION: ${s.title || 'Untitled'}] ---\n`;
        msgs.forEach(m => {
          const roleLabel = m.role === 'model' ? 'Nexus' : 'User';
          historyLog += `[${roleLabel}]: ${m.content}\n`;
        });
      }
    }
    return historyLog.trim();
  } catch (error) {
    console.error('Failed to retrieve historical context:', error);
    return '';
  }
}

export async function getDistilledMemories(userId: string): Promise<any> {
  const emptyPrimitive = {
    vulnerabilities_fears: '',
    humorous_shared_jokes: '',
    personal_goals_promises: ''
  };
  try {
    const q = query(
      collection(db, `users/${userId}/distilled_emotional_memories`),
      where('userId', '==', userId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
    return emptyPrimitive;
  } catch (error) {
    console.error('Failed to retrieve distilled memories, using optimistic fallback:', error);
    return emptyPrimitive;
  }
}
