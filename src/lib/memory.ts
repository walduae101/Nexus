import { fastTask } from './gemini';

export async function compressChatHistory(currentSummary: string, newMessages: string): Promise<string> {
  const prompt = `You are an expert system architect. Update the following project summary with the new conversation context. Keep it highly compressed, strictly technical, and factual. Track: Tech Stack, Core Architecture, Completed Features, and Current Objective. Do NOT include greetings or fluff.

Current Summary: ${currentSummary || 'None initially.'}

New Context: ${newMessages}`;

  try {
    const summary = await fastTask(prompt);
    return summary;
  } catch (err) {
    console.error('Failed to compress chat history', err);
    return currentSummary;
  }
}
