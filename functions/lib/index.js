"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sweepOrphans = exports.onMessageCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const perf_hooks_1 = require("perf_hooks");
admin.initializeApp();
const db = admin.firestore();
// We will look for an API key in the environment
const apiKey = process.env.GEMINI_API_KEY || ((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key) || "";
const ai = new genai_1.GoogleGenAI({ apiKey });
exports.onMessageCreated = functions.firestore
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
            }
            catch (e) {
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

If nothing new fits a category based on the recent text, you can set the content to "".

CRITICAL: Return ONLY valid JSON with this exact schema evaluating 'is_positive_highlight' explicitly if the memory denotes a positive peak, shared optimism, or significant milestone.
{
  "vulnerabilities_fears": { "content": "...", "is_positive_highlight": false },
  "humorous_shared_jokes": { "content": "...", "is_positive_highlight": true },
  "personal_goals_promises": { "content": "...", "is_positive_highlight": true }
}

Transcript:
"""
${transcript}
"""
`;
            const presenceRef = db.doc(`users/${userId}/presence/state`);
            await presenceRef.set({ is_distilling: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            try {
                const startTime = perf_hooks_1.performance.now();
                const response = await ai.models.generateContent({
                    model: "gemini-3.1-flash-lite-preview",
                    contents: prompt
                });
                const endTime = perf_hooks_1.performance.now();
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
                }
                catch (e) {
                    console.error("Failed to parse LLM JSON:", cleanedJson);
                    return;
                }
                // Adaptive Persona Dynamics - Closeness Meter Accumulation
                let xpGained = 0;
                const isMeaningful = (obj) => obj && typeof obj.content === 'string' && obj.content.length > 5 && !obj.content.toLowerCase().includes("no new");
                if (isMeaningful(distilledData.vulnerabilities_fears))
                    xpGained += 50;
                if (isMeaningful(distilledData.humorous_shared_jokes))
                    xpGained += 25;
                if (isMeaningful(distilledData.personal_goals_promises))
                    xpGained += 25;
                if (xpGained > 0) {
                    const personaRef = db.doc(`users/${userId}/persona_metrics/state`);
                    await db.runTransaction(async (t_persona) => {
                        var _a;
                        const snap = await t_persona.get(personaRef);
                        let currentXp = 0;
                        if (snap.exists) {
                            currentXp = ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.intimacy_xp) || 0;
                        }
                        const newXp = currentXp + xpGained;
                        const newLevel = Math.min(5, Math.floor(newXp / 100) + 1);
                        t_persona.set(personaRef, {
                            intimacy_xp: admin.firestore.FieldValue.increment(xpGained),
                            closeness_level: newLevel,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    });
                    console.log(`Earned +${xpGained} XP for user ${userId}.`);
                }
                // We continue saving to "latest" to respect ambient UI backward compatibility,
                // but we will also persist discrete snapshot documents for positive queries!
                const ambientPayload = {
                    vulnerabilities_fears: isMeaningful(distilledData.vulnerabilities_fears) ? distilledData.vulnerabilities_fears.content : "",
                    humorous_shared_jokes: isMeaningful(distilledData.humorous_shared_jokes) ? distilledData.humorous_shared_jokes.content : "",
                    personal_goals_promises: isMeaningful(distilledData.personal_goals_promises) ? distilledData.personal_goals_promises.content : ""
                };
                const memRef = db.collection(`users/${userId}/distilled_emotional_memories`).doc("latest");
                const existingSnap = await memRef.get();
                let finalData = existingData(existingSnap.data(), ambientPayload);
                await memRef.set(Object.assign(Object.assign({}, finalData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
                // Push positive highlights dynamically into discrete records
                const pushHighlights = async (keyPath, memObj) => {
                    if (isMeaningful(memObj) && memObj.is_positive_highlight) {
                        await db.collection(`users/${userId}/distilled_emotional_memories`).add({
                            type: keyPath,
                            content: memObj.content,
                            is_positive_highlight: true,
                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                };
                await pushHighlights('vulnerabilities_fears', distilledData.vulnerabilities_fears);
                await pushHighlights('humorous_shared_jokes', distilledData.humorous_shared_jokes);
                await pushHighlights('personal_goals_promises', distilledData.personal_goals_promises);
                console.log(`Successfully updated emotional memories for user ${userId}`);
            }
            finally {
                await presenceRef.set({ is_distilling: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
        }
    }
    catch (e) {
        console.error("Memory Distiller Pipeline error", e);
    }
});
function existingData(oldData, newData) {
    if (!oldData)
        return newData;
    // Simple intelligence: if the new data says "no new data" or "None", we keep old.
    const isMeaningful = (str) => str && str.length > 5 && !str.toLowerCase().includes("no new");
    return {
        vulnerabilities_fears: isMeaningful(newData.vulnerabilities_fears) ? newData.vulnerabilities_fears : oldData.vulnerabilities_fears || "",
        humorous_shared_jokes: isMeaningful(newData.humorous_shared_jokes) ? newData.humorous_shared_jokes : oldData.humorous_shared_jokes || "",
        personal_goals_promises: isMeaningful(newData.personal_goals_promises) ? newData.personal_goals_promises : oldData.personal_goals_promises || ""
    };
}
exports.sweepOrphans = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }
    const userId = context.auth.uid;
    const presenceRef = db.doc(`users/${userId}/presence/state`);
    try {
        const snap = await presenceRef.get();
        if (snap.exists) {
            const pData = snap.data();
            if (pData === null || pData === void 0 ? void 0 : pData.last_active_ping) {
                // Determine Delta
                const lastPing = pData.last_active_ping.toMillis ? pData.last_active_ping.toMillis() : Date.now();
                if (Date.now() - lastPing > 15000) {
                    console.log(`[SWEEP] Orphan presence ghost detected for ${userId}. Forcing wipe.`);
                    await presenceRef.set({
                        is_distilling: false,
                        is_surprised: false,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    return { success: true, swept: true };
                }
            }
        }
        return { success: true, swept: false };
    }
    catch (e) {
        console.error("Orphan sweep failed", e);
        throw new functions.https.HttpsError("internal", "Sweep architecture dropped connection");
    }
});
//# sourceMappingURL=index.js.map