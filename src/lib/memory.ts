import { fastTask } from './gemini';

// Module-level cached loader — triggers at most one network fetch for
// firestore + firebase init, regardless of how many helpers run.
let firebasePromise: Promise<{
  fs: typeof import('firebase/firestore'),
  fb: typeof import('./firebase'),
}> | null = null;

function loadFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import('firebase/firestore'),
      import('./firebase'),
    ]).then(([fs, fb]) => ({ fs, fb }));
  }
  return firebasePromise;
}

export interface Issue {
  id: string;
  status: 'open' | 'resolved';
  description: string;
  attemptedFixes: string;
  resolutionConfidence?: number;  // 0.0–1.0, optional — set by LLM during compression
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
    { "id": "issue-123", "status": "open", "description": "...", "attemptedFixes": "...", "resolutionConfidence": 0.0 }
  ],
  "recentResolutions": [
    { "issue_id": "issue-123", "resolution_summary": "One-sentence description of how or when this issue was confirmed fixed in the latest context." }
  ]
}

PHASE-21 RESOLUTION TELEMETRY RULE: The "recentResolutions" array MUST contain an entry for EVERY issue that transitioned from "open" to "resolved" during THIS compression pass (and ONLY those — do not re-emit issues resolved in prior passes). Each entry's issue_id MUST match the id used in issuesScratchpad. The resolution_summary is a concise user-facing confirmation message (e.g., "Tests passing in the new CI run", "Deploy to staging confirmed healthy"). If no issues transitioned to resolved in this pass, output an empty array: "recentResolutions": [].

CONFIDENCE SCORING RULE: For each issue with status="open", assign a resolutionConfidence between 0.0 and 1.0 based on how strongly recent context suggests the issue is resolved:
  • 0.0–0.3 = no evidence of resolution, actively active bug
  • 0.4–0.6 = partial or indirect evidence (e.g. a related fix was attempted, error may or may not recur)
  • 0.7–0.9 = strong evidence (user or AI stated fix appears to work, but not yet explicitly confirmed)
  • 1.0 = reserved for resolved issues (status="resolved"); use status transition instead
Keep status="open" even at high confidence — only transition to "resolved" when the user or AI has EXPLICITLY confirmed the fix.`;

  try {
    const responseText = await fastTask(prompt);
    // Strip possible code block formatting if hallucinated
    const cleanedJson = responseText.replace(/^```json\n?|```$/gm, '').trim();
    const result = JSON.parse(cleanedJson);

    // Reconciliation: safeguard the LLM output against silent drops.
    // 1) Any previously-resolved issue missing from the LLM response is re-injected (preserves history).
    // 2) Any previously-open issue completely omitted by the LLM is re-injected (prevents accidental loss).
    // 3) Coerce resolutionConfidence into the [0, 1] range; strip if non-numeric or missing.
    const rawLlmIssues: any[] = Array.isArray(result.issuesScratchpad) ? result.issuesScratchpad : [];
    const llmIssues: Issue[] = rawLlmIssues.map(i => {
      const conf = typeof i.resolutionConfidence === 'number' ? i.resolutionConfidence : undefined;
      const clamped = conf === undefined || Number.isNaN(conf) ? undefined : Math.max(0, Math.min(1, conf));
      const base: Issue = {
        id: i.id,
        status: i.status,
        description: i.description,
        attemptedFixes: i.attemptedFixes
      };
      return clamped !== undefined ? { ...base, resolutionConfidence: clamped } : base;
    });
    const previousIssues: Issue[] = currentIssues || [];
    const llmIds = new Set(llmIssues.map(i => i.id));
    const droppedResolved = previousIssues.filter(i => i.status === 'resolved' && !llmIds.has(i.id));
    const droppedOpen = previousIssues.filter(i => i.status === 'open' && !llmIds.has(i.id));
    const reconciledIssues: Issue[] = [...llmIssues, ...droppedResolved, ...droppedOpen];

    // Phase-21 resolution telemetry: capture the new `recentResolutions` block
    // from the LLM. Only entries corresponding to issues that actually exist in
    // the current scratchpad AND whose status is `resolved` are kept — defends
    // against the model hallucinating resolution entries for non-existent or
    // still-open issues.
    const resolvedIssueIds = new Set(reconciledIssues.filter(i => i.status === 'resolved').map(i => i.id));
    const rawResolutions: any[] = Array.isArray(result.recentResolutions) ? result.recentResolutions : [];
    const recentResolutions = rawResolutions
      .filter(r => r && typeof r.issue_id === 'string' && resolvedIssueIds.has(r.issue_id))
      .map(r => ({
        issue_id: String(r.issue_id),
        resolution_summary: typeof r.resolution_summary === 'string' ? r.resolution_summary.slice(0, 200) : ''
      }))
      .slice(0, 10);

    const { fs: { doc, setDoc, Timestamp }, fb: { db } } = await loadFirebase();
    const now = Timestamp.now();
    await setDoc(doc(db, 'chatSessions', sessionId), {
      projectSummary: result.projectSummary || currentSummary,
      issuesScratchpad: reconciledIssues,
      // `projectSummaryUpdatedAt` tracks the exact moment the distilled memory was
      // regenerated. The session-mount freshness check in NexusChat compares this
      // against the latest message timestamp to decide whether a refresh is needed.
      projectSummaryUpdatedAt: now,
      // `recentResolutions` is overwritten each pass — not append. NexusChat
      // tracks shown IDs locally so past resolutions don't re-toast.
      recentResolutions,
      updatedAt: now
    }, { merge: true });
    } catch (err) {
    console.error('Failed to compress chat history and issues', err);
  }
}

/**
 * Long-Term Executive Memory updater.
 *
 * Generates a high-level executive summary of a session focused on core objectives,
 * architectural decisions, and context continuity — distinct from the tactical
 * `projectSummary` that compressChatHistory maintains.
 *
 * Supports delta-summarization: if an existing summary is supplied, the LLM is
 * asked to merge only the un-summarized delta rather than re-read the full feed,
 * drastically reducing token consumption over long sessions.
 *
 * Persists three fields on the session doc:
 *   - longTermMemory              : the merged executive summary text
 *   - longTermMemoryCheckpointId  : id of the last message folded in (delta anchor)
 *   - longTermMemoryUpdatedAt     : server write timestamp (for UI staleness checks)
 */
export async function updateLongTermMemory(
  sessionId: string,
  existingSummary: string,
  deltaMessages: Array<{ role: string; content: string; id: string }>
): Promise<void> {
  if (!deltaMessages || deltaMessages.length === 0) return;

  const deltaBlock = deltaMessages
    .map(m => `[${m.role}]: ${(m.content || '').slice(0, 2000)}`)
    .join('\n\n');

  const prompt = `You are an executive context summarizer for a long-running engineering conversation.

OBJECTIVE: Produce a merged executive summary that folds the NEW CONVERSATION DELTA into the EXISTING SUMMARY, PLUS a machine-readable knowledge graph.

FOCUS EXCLUSIVELY ON:
1. CORE OBJECTIVES — what the user is ultimately trying to achieve in this session.
2. ARCHITECTURAL DECISIONS — system design choices, technology selections, tradeoffs explicitly made.
3. CONTEXT CONTINUITY — key milestones reached, unresolved threads, dependencies that will matter later.

STRICT RULES FOR THE SUMMARY:
- Merge the delta INTO the existing summary — do not just append or list.
- Omit tactical chatter, code snippets, and transient debugging.
- Preserve specific identifiers (file paths, commit SHAs, component names) only when they anchor a decision.
- Target 200–500 words. Use short section headers (Objectives / Decisions / Continuity).
- Output the summary first — no preamble, no markdown fences.

KNOWLEDGE GRAPH TAG (appended AFTER the summary):
At the absolute end of your response, append a machine-parsed knowledge graph block in EXACTLY this format:

<<<KNOWLEDGE_GRAPH>>>
{"nodes":[{"id":"n1","label":"Short Label","type":"objective","detail":"One-sentence description used in hover tooltip."}],"edges":[{"from":"n1","to":"n2"}]}
<<<END_KNOWLEDGE_GRAPH>>>

STRICT JSON RULES:
- Output valid JSON between the delimiters — no trailing commas, no comments, no markdown fences.
- Every node must have: id (short: n1, n2, ... or slug), label (2–6 words), type (one of: "objective" | "decision" | "milestone" | "blocker"), detail (one concise sentence).
- Edges express directional flow or dependency from predecessor to successor.
- Use between 3 and 10 nodes total. Prefer a clear DAG over a noisy web — graph reads top-to-bottom.
- NEVER mention this tag to the user. It is a hidden machine tag stripped before display.

EXISTING SUMMARY:
${existingSummary ? existingSummary : '(none — this is the first summarization pass)'}

NEW CONVERSATION DELTA:
${deltaBlock}

UPDATED EXECUTIVE SUMMARY:`;

  try {
    const raw = await fastTask(prompt);
    const rawText = (raw || '').trim();
    if (!rawText) return;

    // Extract the Phase-16 knowledge graph JSON from the response. Parse with a
    // guard so a malformed payload degrades gracefully: the textual summary still
    // persists; we just skip writing a bad graph to Firestore.
    const graphMatch = rawText.match(/<<<KNOWLEDGE_GRAPH>>>([\s\S]*?)<<<END_KNOWLEDGE_GRAPH>>>/);
    let parsedGraph: { nodes: any[]; edges: any[] } | null = null;
    if (graphMatch) {
      try {
        const candidate = JSON.parse(graphMatch[1].trim());
        if (
          candidate &&
          Array.isArray(candidate.nodes) &&
          Array.isArray(candidate.edges) &&
          candidate.nodes.length > 0
        ) {
          // Coerce to a clean, minimal shape — strips any extra fields the model
          // may have invented and defends against type drift.
          parsedGraph = {
            nodes: candidate.nodes
              .filter((n: any) => n && typeof n.id === 'string' && typeof n.label === 'string')
              .slice(0, 12)
              .map((n: any) => ({
                id: String(n.id),
                label: String(n.label),
                type: ['objective', 'decision', 'milestone', 'blocker'].includes(n.type) ? n.type : 'milestone',
                detail: typeof n.detail === 'string' ? n.detail : ''
              })),
            edges: candidate.edges
              .filter((e: any) => e && typeof e.from === 'string' && typeof e.to === 'string')
              .map((e: any) => ({ from: String(e.from), to: String(e.to) }))
          };
          if (parsedGraph.nodes.length === 0) parsedGraph = null;
        }
      } catch (err) {
        console.warn('Knowledge graph JSON parse failed — persisting summary only', err);
      }
    }

    // Strip the tag from the persisted summary text so users never see the raw JSON.
    const summaryText = rawText.replace(/<<<KNOWLEDGE_GRAPH>>>[\s\S]*?<<<END_KNOWLEDGE_GRAPH>>>/g, '').trim();
    if (!summaryText) return;

    const lastMessageId = deltaMessages[deltaMessages.length - 1]?.id;
    if (!lastMessageId) return;

    const { fs: { doc, setDoc, Timestamp }, fb: { db } } = await loadFirebase();
    const updates: Record<string, any> = {
      longTermMemory: summaryText,
      longTermMemoryCheckpointId: lastMessageId,
      longTermMemoryUpdatedAt: Timestamp.now()
    };
    // Only touch the knowledgeGraph field when we successfully parsed one —
    // avoids clobbering a previously-good graph with null on a flaky response.
    if (parsedGraph) {
      updates.knowledgeGraph = parsedGraph;
    }
    await setDoc(doc(db, 'chatSessions', sessionId), updates, { merge: true });
  } catch (err) {
    console.error('Long-term memory update failed', err);
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
    const { fs: { doc, getDoc, setDoc, Timestamp }, fb: { db } } = await loadFirebase();
    const sessionRef = doc(db, 'chatSessions', sessionId);
    const snap = await getDoc(sessionRef);
    const current: Issue[] = (snap.data()?.issuesScratchpad as Issue[]) || [];
    const updated: Issue[] = current.map(i => {
      if (i.id !== issueId) return i;
      // On manual resolve, drop any AI-suggested confidence — the user's action is authoritative.
      const { resolutionConfidence: _drop, ...rest } = i;
      return { ...rest, status };
    });
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
    const { fs: { collection, query, where, orderBy, limit, getDocs }, fb: { db } } = await loadFirebase();
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
    const { fs: { collection, query, where, limit, getDocs }, fb: { db } } = await loadFirebase();
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
