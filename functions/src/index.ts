import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { performance } from "perf_hooks";

admin.initializeApp();
const db = admin.firestore();

// We will look for an API key in the environment
const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key || "";
const ai = new GoogleGenAI({ apiKey });

export const onMessageCreated = functions.firestore
  .document("chatSessions/{sessionId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const newMessage = snap.data();
    const sessionId = context.params.sessionId;
    const userId = newMessage.userId;

    if (!userId || !sessionId || newMessage.role === "system") {
      return;
    }

    try {
      // Calculate total messages in this session
      const messagesRef = db.collection(`chatSessions/${sessionId}/messages`);
      // We take a snapshot of the count or just read the limit to avoid huge reads
      const messagesSnapshot = await messagesRef.orderBy("timestamp", "desc").limit(10).get();
      
      // Batch threshold: every 5 messages or when explicitly requested?
      // Since it's a chat, maybe trigger on every 5 user messages or just 5 general messages. 
      // For real-time updates and given the prompt "batch threshold mechanism", we'll check if total modulo 5 is 0.
      // Easiest is to count all messages.
      const totalMessagesSnapshot = await messagesRef.count().get();
      const totalCount = totalMessagesSnapshot.data().count;

      if (totalCount > 0 && totalCount % 5 === 0) {
        const batchId = totalCount;
        const lockRef = db.doc(`users/${userId}/distillerLocks/batch_${batchId}`);
        
        try {
            await db.runTransaction(async (t) => {
                const lockDoc = await t.get(lockRef);
                if (lockDoc.exists) {
                    throw new Error("ALREADY_PROCESSED");
                }
                t.set(lockRef, { processedAt: admin.firestore.FieldValue.serverTimestamp(), eventId: context.eventId });
            });
        } catch (e: any) {
            if (e.message === "ALREADY_PROCESSED") {
                console.log(`Batch ${batchId} for user ${userId} already processed. Idempotency abort.`);
                return;
            }
            throw e;
        }

        // Fetch last 10 messages for context
        const msgs = messagesSnapshot.docs.map(doc => doc.data()).reverse();
        const transcript = msgs.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n");

        if (!apiKey) {
            console.error("No API key available for Memory Distiller.");
            return;
        }

        const prompt = `You are the "Memory Distiller", an internal AI component.
YOUR TASK:
Analyze the provided chat transcript and extract three specific emotional/contextual states.
Categorize them strictly under:
1. "vulnerabilities_fears" (User insecurities, confessed fears, or struggles)
2. "humorous_shared_jokes" (Inside jokes, sarcasm, or ongoing banter)
3. "personal_goals_promises" (User's stated ambitions, or promises made between the AI and the user)

If nothing new fits a category based on the recent text, you can note "No new data". We will merge this logically. Wait, to make it completely stateful, output an updated JSON. Let's just output the exact JSON structure for the newly observed items.

CRITICAL: Return ONLY valid JSON with this exact schema (no markdown formatting, no comments, no \`\`\` text):
{
  "vulnerabilities_fears": "...",
  "humorous_shared_jokes": "...",
  "personal_goals_promises": "..."
}

Transcript:
"""
${transcript}
"""
`;
        const presenceRef = db.doc(`chatSessions/${sessionId}/presence/state`);
        await presenceRef.set({ is_distilling: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

        try {
            const startTime = performance.now();
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite-preview",
                contents: prompt
            });
            const endTime = performance.now();

            if (process.env.FUNCTIONS_EMULATOR === 'true') {
                const durationMs = Math.round(endTime - startTime);
                const approxInputTokens = Math.ceil(prompt.length / 4);
                const approxOutputTokens = Math.ceil((response.text || "").length / 4);
                
                console.log(JSON.stringify({
                    event: "TELEMETRY_DISTILLER_API_CALL",
                    durationMs,
                    approxInputTokens,
                    approxOutputTokens,
                    model: "gemini-3.1-flash-lite-preview",
                    batchId
                }));
            }

            const rawResult = response.text || "{}";
            const cleanedJson = rawResult.replace(/^```json\n?|```$/gm, "").trim();
            
            let distilledData;
            try {
                distilledData = JSON.parse(cleanedJson);
            } catch (e) {
                console.error("Failed to parse LLM JSON:", cleanedJson);
                return;
            }

            // Fetch current distilled memory to merge it intelligently? 
            // For now, simpler: we replace or append? The user asked to "persist the resulting structured emotional payload". Let's do a merge over time or just store the latest.
            const memRef = db.collection(`users/${userId}/distilled_emotional_memories`).doc("latest");
            const existingSnap = await memRef.get();
            let finalData = existingData(existingSnap.data(), distilledData);
            
            // Adaptive Persona Dynamics - Closeness Meter Accumulation
            let xpGained = 0;
            const hasData = (str: any) => typeof str === 'string' && str.length > 5 && !str.toLowerCase().includes("no new");
            if (hasData(distilledData.vulnerabilities_fears)) xpGained += 50;
            if (hasData(distilledData.humorous_shared_jokes)) xpGained += 25;
            if (hasData(distilledData.personal_goals_promises)) xpGained += 25;

            if (xpGained > 0) {
                const personaRef = db.doc(`users/${userId}/persona_metrics/state`);
                await db.runTransaction(async (t_persona) => {
                    const snap = await t_persona.get(personaRef);
                    let currentXp = 0;
                    if (snap.exists) {
                        currentXp = snap.data()?.intimacy_xp || 0;
                    }
                    const newXp = currentXp + xpGained;
                    // Level increments every 100 XP, max 5.
                    const newLevel = Math.min(5, Math.floor(newXp / 100) + 1);
                    
                    t_persona.set(personaRef, {
                        intimacy_xp: newXp,
                        closeness_level: newLevel,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });
                console.log(`Earned +${xpGained} XP for user ${userId}.`);
            }

            await memRef.set({
                ...finalData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`Successfully updated emotional memories for user ${userId}`);
        } finally {
            await presenceRef.set({ is_distilling: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    } catch (e) {
      console.error("Memory Distiller Pipeline error", e);
    }
});

function existingData(oldData: any, newData: any) {
    if (!oldData) return newData;
    
    // Simple intelligence: if the new data says "no new data" or "None", we keep old.
    const isMeaningful = (str: string) => str && str.length > 5 && !str.toLowerCase().includes("no new");

    return {
        vulnerabilities_fears: isMeaningful(newData.vulnerabilities_fears) ? newData.vulnerabilities_fears : oldData.vulnerabilities_fears || "",
        humorous_shared_jokes: isMeaningful(newData.humorous_shared_jokes) ? newData.humorous_shared_jokes : oldData.humorous_shared_jokes || "",
        personal_goals_promises: isMeaningful(newData.personal_goals_promises) ? newData.personal_goals_promises : oldData.personal_goals_promises || ""
    };
}
