"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importDefault(require("openai"));
class AIService {
    geminiGenAI = null;
    openAI = null;
    constructor() {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
            console.log('[AI Service]: Gemini API Key detected. Initializing Gemini SDK...');
            this.geminiGenAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        }
        const openAIKey = process.env.OPENAI_API_KEY;
        if (openAIKey) {
            console.log('[AI Service]: OpenAI API Key detected. Initializing OpenAI SDK...');
            this.openAI = new openai_1.default({ apiKey: openAIKey });
        }
        if (!geminiKey && !openAIKey) {
            console.warn('[AI Service]: No API keys detected (GEMINI_API_KEY or OPENAI_API_KEY). Running in mock/fallback mode.');
        }
    }
    async generateEmbedding(text) {
        const cleanText = text.substring(0, 8000); // Truncate to safety limits
        // 1. OpenAI Option
        if (this.openAI) {
            try {
                const response = await this.openAI.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: cleanText,
                });
                return response.data[0].embedding;
            }
            catch (err) {
                console.error('[AI Service]: OpenAI Embedding generation failed, trying fallback...', err);
            }
        }
        // 2. Gemini Option
        if (this.geminiGenAI) {
            try {
                const model = this.geminiGenAI.getGenerativeModel({ model: 'text-embedding-004' });
                const result = await model.embedContent(cleanText);
                if (result.embedding && result.embedding.values) {
                    return result.embedding.values;
                }
            }
            catch (err) {
                console.error('[AI Service]: Gemini Embedding generation failed, trying fallback...', err);
            }
        }
        // 3. Mock Fallback (Useful for offline dev / no keys)
        // Return a deterministically pseudo-random 1536-dimensional vector based on text
        const size = 1536;
        const mockVector = [];
        let hash = 0;
        for (let i = 0; i < cleanText.length; i++) {
            hash = cleanText.charCodeAt(i) + ((hash << 5) - hash);
        }
        for (let i = 0; i < size; i++) {
            const seed = Math.sin(hash + i) * 10000;
            mockVector.push(seed - Math.floor(seed));
        }
        return mockVector;
    }
    async generateSummary(fileName, content, language) {
        const systemPrompt = `You are DevVault AI engineering memory. Summarize the content of the file "${fileName}" (${language || 'unknown language'}). Describe its purpose, main functions, export values, and architectural role. Keep it concise (1-3 paragraphs).`;
        // 1. OpenAI Option
        if (this.openAI) {
            try {
                const completion = await this.openAI.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Here is the file content:\n\n${content.substring(0, 10000)}` },
                    ],
                    max_tokens: 400,
                });
                return completion.choices[0].message.content || 'No summary generated.';
            }
            catch (err) {
                console.error('[AI Service]: OpenAI Summary failed, trying fallback...', err);
            }
        }
        // 2. Gemini Option
        if (this.geminiGenAI) {
            try {
                const model = this.geminiGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const prompt = `${systemPrompt}\n\nHere is the file content:\n\n${content.substring(0, 10000)}`;
                const result = await model.generateContent(prompt);
                return result.response.text() || 'No summary generated.';
            }
            catch (err) {
                console.error('[AI Service]: Gemini Summary failed, trying fallback...', err);
            }
        }
        // 3. Mock Fallback
        return `[Mock AI Summary for ${fileName}]: This file contains code written in ${language || 'unknown language'}. It exports core functions/utilities related to ${fileName.split('.')[0]}. Code length is ${content.length} characters. (Configure API key to see real AI summaries)`;
    }
    async explainCode(fileName, code, language) {
        const systemPrompt = `You are a Senior Full Stack Engineer. Analyze the code in file "${fileName}" (${language || 'unknown language'}).
Provide an explanation including:
1. What does the code do?
2. What are the inputs & outputs?
3. Are there any security issues or bugs?
4. How can the code be optimized?
5. How is it used in typical applications?

Format in beautiful markdown.`;
        if (this.openAI) {
            try {
                const completion = await this.openAI.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Analyze the following code:\n\n\`\`\`${language || ''}\n${code.substring(0, 15000)}\n\`\`\`` },
                    ],
                });
                return completion.choices[0].message.content || 'Could not explain.';
            }
            catch (err) {
                console.error('[AI Service]: OpenAI Explain failed, trying fallback...', err);
            }
        }
        if (this.geminiGenAI) {
            try {
                const model = this.geminiGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const prompt = `${systemPrompt}\n\nAnalyze the following code:\n\n\`\`\`${language || ''}\n${code.substring(0, 15000)}\n\`\`\``;
                const result = await model.generateContent(prompt);
                return result.response.text() || 'Could not explain.';
            }
            catch (err) {
                console.error('[AI Service]: Gemini Explain failed, trying fallback...', err);
            }
        }
        return `### AI Explanation for \`${fileName}\` (Offline Mock Mode)

1. **Overview**: This file defines code structures related to \`${fileName.split('.')[0]}\`.
2. **Inputs & Outputs**: Typically processes application logic, database actions, or routing.
3. **Security/Bugs**: None detected in offline scanning. Enable API keys to trigger high-accuracy LLM security scanning.
4. **Optimizations**: Keep dependencies clean, implement caching if reading files repeatedly, and separate concerns.
5. **Usage**: Can be imported globally or wired in components.`;
    }
    async chatWithContext(question, history, contextChunks) {
        const formattedContext = contextChunks
            .map((chunk, index) => `--- SOURCE #${index + 1} (File: ${chunk.path}) ---\n${chunk.content}`)
            .join('\n\n');
        const systemPrompt = `You are DevVault AI, an intelligent engineering memory for developers.
Answer the user's question using the provided context chunks of their files and code.
Always refer to the file names and paths when discussing code.
If the answer is found in the sources, provide code snippets and cite the source name/path clearly.
If the context does not contain enough information to answer, state that, but give a general engineering suggestion.

CONTEXT FROM USER CODEBASE:
${formattedContext}

INSTRUCTIONS:
- Answer in the same language as the user's question (e.g. if asked in Arabic, reply in Arabic).
- Be extremely precise, providing clean code blocks when helpful.`;
        const chatMessages = [
            { role: 'system', content: systemPrompt },
            ...history.map((h) => ({ role: h.role, content: h.content })),
            { role: 'user', content: question },
        ];
        if (this.openAI) {
            try {
                const completion = await this.openAI.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: chatMessages,
                });
                return completion.choices[0].message.content || '';
            }
            catch (err) {
                console.error('[AI Service]: OpenAI Chat failed, trying fallback...', err);
            }
        }
        if (this.geminiGenAI) {
            try {
                const model = this.geminiGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                // Format history for Gemini
                const formattedPrompt = `${systemPrompt}\n\nChat History:\n${history
                    .map((h) => `${h.role === 'user' ? 'User' : 'AI'}: ${h.content}`)
                    .join('\n')}\n\nUser Question: ${question}\nAI Answer:`;
                const result = await model.generateContent(formattedPrompt);
                return result.response.text() || '';
            }
            catch (err) {
                console.error('[AI Service]: Gemini Chat failed, trying fallback...', err);
            }
        }
        // Mock Answer
        const arabicQuestion = question.includes('فين') || question.includes('ازاي') || question.includes('كود');
        if (arabicQuestion) {
            return `مرحباً! أنا أعمل حالياً في وضع عدم الاتصال (Offline Mode). 
بناءً على الملفات المرفوعة في المشروع، إليك الإجابة التقريبية:
لقد عثرت على تطابق للملفات التالية في قاعدة البيانات الخاصة بك:
${contextChunks.map((c) => `- \`${c.path}\` (تطابق: ${(c.score ? c.score * 100 : 80).toFixed(0)}%)`).join('\n')}

لتفعيل الإجابات الذكية الكاملة وتوليد الأكواد بالتفصيل، يرجى تزويدي بمفتاح \`GEMINI_API_KEY\` أو \`OPENAI_API_KEY\` في ملف الـ \`.env\`.`;
        }
        return `Hello! I am currently running in offline mock mode.
I found the following matches in your codebase:
${contextChunks.map((c) => `- \`${c.path}\` (Score: ${(c.score ? c.score * 100 : 80).toFixed(0)}%)`).join('\n')}

Please set up a \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` in your \`.env\` file to enable real conversational RAG answers.`;
    }
}
exports.aiService = new AIService();
