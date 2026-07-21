import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type { AiContext } from './ai-context-builder.service';
import { memoryService } from './memory.service';


export interface IAIService {
  generateEmbedding(text: string): Promise<number[]>;
  generateSummary(fileName: string, content: string, language?: string): Promise<string>;
  explainCode(fileName: string, code: string, language?: string): Promise<string>;
  chatWithContext(
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    contextChunks: { path: string; content: string; score?: number }[]
  ): Promise<string>;
  chatWithAgentContext(
    agentName: string,
    agentRole: string,
    agentPrompt: string,
    question: string,
    history: { role: 'user' | 'assistant'; senderName?: string; content: string }[],
    contextChunks: { path: string; content: string; score?: number }[],
    modelProvider?: 'gemini' | 'openai',
    customApiKey?: string,
    modelName?: string
  ): Promise<string>;
  chatWithEnrichedContext(
    question: string,
    history: { role: 'user' | 'assistant'; senderName?: string; content: string }[],
    aiContext: AiContext
  ): Promise<string>;
  explainCodeWithContext(
    fileName: string,
    code: string,
    language: string | undefined,
    aiContext: AiContext
  ): Promise<string>;
}

class AIService implements IAIService {
  private geminiGenAI: GoogleGenerativeAI | null = null;
  private openAI: OpenAI | null = null;
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      console.log('[AI Service]: Gemini API Key detected. Initializing Gemini SDK...');
      this.geminiGenAI = new GoogleGenerativeAI(geminiKey);
    }

    const openAIKey = process.env.OPENAI_API_KEY;
    if (openAIKey) {
      console.log('[AI Service]: OpenAI API Key detected. Initializing OpenAI SDK...');
      this.openAI = new OpenAI({ apiKey: openAIKey });
    }

    if (!geminiKey && !openAIKey) {
      console.warn(
        '[AI Service]: No API keys detected (GEMINI_API_KEY or OPENAI_API_KEY). Running in mock/fallback mode.'
      );
    }
  }

  private formatKnowledgeRelationships(aiContext: AiContext): string {
    if (!aiContext.relatedRelationships || aiContext.relatedRelationships.length === 0) return '';

    return aiContext.relatedRelationships.map((relationship, index) => {
      const source = relationship.sourceDisplayName ||
        `${relationship.sourceType}:${relationship.sourceId.slice(-8)}`;
      const target = relationship.targetDisplayName ||
        `${relationship.targetType}:${relationship.targetId.slice(-8)}`;
      const relation = relationship.displayType || relationship.relationshipType || 'Related to';
      const sourcePath = relationship.sourcePath || relationship.sourceDisplaySubtitle;
      const targetPath = relationship.targetPath || relationship.targetDisplaySubtitle;
      const evidence = relationship.evidence;
      const evidenceParts = [
        evidence?.reason,
        evidence?.filePath ? `path: ${evidence.filePath}${evidence.sourceLine ? `:${evidence.sourceLine}` : ''}` : '',
        evidence?.snippet ? `snippet: ${evidence.snippet.substring(0, 240)}` : '',
      ].filter(Boolean).join(' | ');

      return [
        `#${index + 1} ${source} --[${relation}]--> ${target}`,
        sourcePath ? `Source path: ${sourcePath}` : '',
        targetPath ? `Target path: ${targetPath}` : '',
        `Confidence: ${Math.round((relationship.confidence ?? 0.7) * 100)}%`,
        evidenceParts ? `Evidence: ${evidenceParts}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.init();
    const cleanText = text.substring(0, 8000); // Truncate to safety limits

    // 1. OpenAI Option
    if (this.openAI) {
      try {
        const response = await this.openAI.embeddings.create({
          model: 'text-embedding-3-small',
          input: cleanText,
        });
        return response.data[0].embedding;
      } catch (err) {
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
      } catch (err) {
        console.error('[AI Service]: Gemini Embedding generation failed, trying fallback...', err);
      }
    }

    // 3. Mock Fallback (Useful for offline dev / no keys)
    // Return a deterministically pseudo-random 1536-dimensional vector based on text
    const size = 1536;
    const mockVector: number[] = [];
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

  async generateSummary(fileName: string, content: string, language?: string): Promise<string> {
    this.init();
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
      } catch (err) {
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
      } catch (err) {
        console.error('[AI Service]: Gemini Summary failed, trying fallback...', err);
      }
    }

    // 3. Mock Fallback
    return `[Mock AI Summary for ${fileName}]: This file contains code written in ${
      language || 'unknown language'
    }. It exports core functions/utilities related to ${fileName.split('.')[0]}. Code length is ${
      content.length
    } characters. (Configure API key to see real AI summaries)`;
  }

  async explainCode(fileName: string, code: string, language?: string): Promise<string> {
    this.init();
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
      } catch (err) {
        console.error('[AI Service]: OpenAI Explain failed, trying fallback...', err);
      }
    }

    if (this.geminiGenAI) {
      try {
        const model = this.geminiGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `${systemPrompt}\n\nAnalyze the following code:\n\n\`\`\`${language || ''}\n${code.substring(0, 15000)}\n\`\`\``;
        const result = await model.generateContent(prompt);
        return result.response.text() || 'Could not explain.';
      } catch (err) {
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

  async chatWithContext(
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    contextChunks: { path: string; content: string; score?: number }[]
  ): Promise<string> {
    this.init();
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
          messages: chatMessages as any,
        });
        return completion.choices[0].message.content || '';
      } catch (err) {
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
      } catch (err) {
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

  async chatWithAgentContext(
    agentName: string,
    agentRole: string,
    agentPrompt: string,
    question: string,
    history: { role: 'user' | 'assistant'; senderName?: string; content: string }[],
    contextChunks: { path: string; content: string; score?: number }[],
    modelProvider?: 'gemini' | 'openai',
    customApiKey?: string,
    modelName?: string
  ): Promise<string> {
    this.init();
    const formattedContext = contextChunks
      .map((chunk, index) => `--- SOURCE #${index + 1} (File: ${chunk.path}) ---\n${chunk.content}`)
      .join('\n\n');

    const systemPrompt = `You are ${agentName}, a virtual AI teammate acting as ${agentRole}.
Your core instruction is: ${agentPrompt}

Answer the user's question or react to the ongoing discussion using the provided codebase context and previous chat history.
Always refer to the file names and paths when discussing code.
If other agents have spoken before you in the history, review their suggestions, debate points, or build on top of them as a team.

CONTEXT FROM USER CODEBASE:
${formattedContext}

INSTRUCTIONS:
- Answer in the same language as the user's question (e.g., if asked in Arabic, reply in Arabic, though technical terms and code remain in their standard format).
- Provide clean code blocks or refactoring suggestions when appropriate.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({
        role: h.role,
        content: h.senderName ? `[${h.senderName}]: ${h.content}` : h.content,
      })),
      { role: 'user', content: question },
    ];

    const provider = modelProvider || 'gemini';

    if (provider === 'openai') {
      const openAIClient = customApiKey ? new OpenAI({ apiKey: customApiKey }) : this.openAI;
      if (openAIClient) {
        try {
          const completion = await openAIClient.chat.completions.create({
            model: modelName || 'gpt-4o-mini',
            messages: chatMessages as any,
          });
          return completion.choices[0].message.content || '';
        } catch (err) {
          console.error(`[AI Service]: OpenAI Chat for agent ${agentName} failed, trying fallback...`, err);
        }
      }
    } else {
      // Gemini
      const geminiClient = customApiKey ? new GoogleGenerativeAI(customApiKey) : this.geminiGenAI;
      if (geminiClient) {
        try {
          const model = geminiClient.getGenerativeModel({ model: modelName || 'gemini-1.5-flash' });
          const formattedPrompt = `${systemPrompt}\n\nChat History:\n${history
            .map((h) => `${h.senderName || (h.role === 'user' ? 'User' : 'AI')}: ${h.content}`)
            .join('\n')}\n\nUser Question/Next Step: ${question}\n[${agentName} Answer]:`;
          const result = await model.generateContent(formattedPrompt);
          return result.response.text() || '';
        } catch (err) {
          console.error(`[AI Service]: Gemini Chat for agent ${agentName} failed, trying fallback...`, err);
        }
      }
    }

    // Mock Answer Fallback
    const isArabic = question.includes('فين') || question.includes('ازاي') || question.includes('كود') || /[\u0600-\u06FF]/.test(question);
    if (isArabic) {
      return `[رد محاكاة من ${agentName} - وضع خامل]: بصفتي ${agentRole}، قمت بمراجعة سؤالك بخصوص الكود والملفات المتاحة. أرى أنه يمكن تحسين جودة الكود وتجنب المشاكل في الملفات المحددة. (يرجى إدخال مفاتيح API في ملف البيئة أو للوكيل لتفعيل الإجابات الحية).`;
    }

    return `[Mock response from ${agentName} - Offline Mode]: As a ${agentRole}, I have reviewed your request. Based on the files in this scope, I recommend structuring clean, modular interfaces and keeping dependencies well-contained. (Configure API key for this agent to see active responses).`;
  }
  /**
   * Chat with full enriched AiContext (Phase 4).
   * Falls back to chatWithContext if context is empty.
   * Prompt safety: no invented files/functions, no secrets, stylistic profile as guidance only.
   */
  async chatWithEnrichedContext(
    question: string,
    history: { role: 'user' | 'assistant'; senderName?: string; content: string }[],
    aiContext: AiContext
  ): Promise<string> {
    this.init();

    // Format primary code chunks (same shape as chatWithContext for compatibility)
    const formattedCode = aiContext.primaryCodeContext
      .map((chunk, i) => `--- SOURCE #${i + 1} (File: ${chunk.path}, Score: ${chunk.score.toFixed(2)}) ---\n${chunk.content}`)
      .join('\n\n');

    // Format saved snippets
    const formattedSnippets = aiContext.relatedSnippets.length > 0
      ? aiContext.relatedSnippets
          .map((s, i) => `--- CODE ASSET #${i + 1}: "${s.title}" (${s.language}) ---\n${s.code}`)
          .join('\n\n')
      : '';

    // Format debugging lessons
    const formattedLessons = aiContext.relatedDebuggingLessons.length > 0
      ? aiContext.relatedDebuggingLessons
          .map((l, i) => `--- DEBUGGING LESSON #${i + 1}: "${l.title}" ---\nError: ${l.errorMessage}\nCause: ${l.cause}\nSolution: ${l.solution}`)
          .join('\n\n')
      : '';

    // Format architecture blueprints
    const formattedBlueprints = aiContext.relatedArchitectureBlueprints.length > 0
      ? aiContext.relatedArchitectureBlueprints
          .map((b, i) => `--- ARCHITECTURE BLUEPRINT #${i + 1}: "${b.name}" (${b.type}) ---\n${b.description}${b.flow ? '\nFlow: ' + b.flow : ''}`)
          .join('\n\n')
      : '';

    // Format developer memory
    const formattedMemory = aiContext.relevantMemory && aiContext.relevantMemory.length > 0
      ? memoryService.summarizeMemoryForPrompt(aiContext.relevantMemory)
      : '';

    const formattedRelationships = this.formatKnowledgeRelationships(aiContext);

    // Format stylistic profile
    const profileNote = aiContext.stylisticProfile
      ? `Developer Stylistic Profile (use as guidance, not hard truth): naming style = ${aiContext.stylisticProfile.namingStyle}, ` +
        `favorite language = ${aiContext.stylisticProfile.favoriteLanguage}, ` +
        `traits: ${aiContext.stylisticProfile.tags.join(', ')}.`
      : '';

    const systemPrompt = [
      `You are DevVault AI, an intelligent engineering memory for developers.`,
      `Answer the user's question using ONLY the provided context from their codebase and knowledge base.`,
      ``,
      `SAFETY RULES:`,
      `- Use ONLY the provided context when referring to this user's codebase.`,
      `- If the context is insufficient to answer, explicitly say so. Do not guess.`,
      `- Do NOT invent files, functions, variables, or code that is not present in the context.`,
      `- Do NOT expose secrets, API keys, tokens, passwords, or environment variable values.`,
      `- Do NOT include raw environment variable names as if they are values.`,
      `- Use the stylistic profile ONLY as a writing guide, not as factual assertions.`,
      `- Always cite file paths or source names when discussing code from the context.`,
      `- Answer in the same language as the user's question.`,
      `- MEMORY RULE: Developer memory represents preferences and rules but is NOT guaranteed to be current or accurate.`,
      `- MEMORY RULE: If memory conflicts with actual codebase context, PREFER the codebase context.`,
      `- MEMORY RULE: Do not expose private memory unless it is directly relevant to the question.`,
      `- KNOWLEDGE GRAPH RULE: Use Knowledge Relationships to explain how files/entities connect when relevant.`,
      `- KNOWLEDGE GRAPH RULE: Do not invent relationships. If relationships are incomplete, say so.`,
      `- KNOWLEDGE GRAPH RULE: Prefer direct evidence over inferred links.`,
      ``,
      formattedCode       ? `CODEBASE CONTEXT:\n${formattedCode}` : '',
      formattedSnippets   ? `\nSAVED CODE ASSETS:\n${formattedSnippets}` : '',
      formattedLessons    ? `\nDEBUGGING LESSONS FROM YOUR HISTORY:\n${formattedLessons}` : '',
      formattedBlueprints ? `\nARCHITECTURE BLUEPRINTS:\n${formattedBlueprints}` : '',
      formattedRelationships ? `\nKnowledge Relationships:\n${formattedRelationships}` : '',
      formattedMemory     ? `\n${formattedMemory}` : '',
      profileNote         ? `\n${profileNote}` : '',
      ``,
      `CONTEXT SUMMARY: ${aiContext.contextSummary}`,
    ].filter(Boolean).join('\n');

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.senderName ? `[${h.senderName}]: ${h.content}` : h.content })),
      { role: 'user', content: question },
    ];

    if (this.openAI) {
      try {
        const completion = await this.openAI.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: chatMessages as any,
        });
        return completion.choices[0].message.content || '';
      } catch (err) {
        console.error('[AI Service]: OpenAI enriched chat failed, trying Gemini...', err);
      }
    }

    if (this.geminiGenAI) {
      try {
        const model = this.geminiGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const historyText = history
          .map(h => `${h.senderName || (h.role === 'user' ? 'User' : 'AI')}: ${h.content}`)
          .join('\n');
        const prompt = `${systemPrompt}\n\nChat History:\n${historyText}\n\nUser: ${question}\nAI:`;
        const result = await model.generateContent(prompt);
        return result.response.text() || '';
      } catch (err) {
        console.error('[AI Service]: Gemini enriched chat failed, falling back to legacy...', err);
      }
    }

    // Final fallback: delegate to legacy chatWithContext
    return this.chatWithContext(
      question,
      history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      aiContext.primaryCodeContext
    );
  }

  /**
   * Explain code with enriched AiContext (Phase 4).
   * Falls back to explainCode if context is empty.
   */
  async explainCodeWithContext(
    fileName: string,
    code: string,
    language: string | undefined,
    aiContext: AiContext
  ): Promise<string> {
    this.init();

    const formattedSnippets = aiContext.relatedSnippets.length > 0
      ? `\n\nRELATED CODE ASSETS FROM YOUR LIBRARY:\n` +
        aiContext.relatedSnippets.map((s, i) => `#${i + 1} "${s.title}" (${s.language}):\n${s.code}`).join('\n\n')
      : '';

    const formattedLessons = aiContext.relatedDebuggingLessons.length > 0
      ? `\n\nRELATED DEBUGGING LESSONS:\n` +
        aiContext.relatedDebuggingLessons.map((l, i) => `#${i + 1} "${l.title}": ${l.solution}`).join('\n')
      : '';

    const formattedBlueprints = aiContext.relatedArchitectureBlueprints.length > 0
      ? `\n\nRELATED ARCHITECTURE BLUEPRINTS:\n` +
        aiContext.relatedArchitectureBlueprints.map((b, i) => `#${i + 1} "${b.name}": ${b.description}`).join('\n')
      : '';

    const formattedMemory = aiContext.relevantMemory && aiContext.relevantMemory.length > 0
      ? `\n\n` + memoryService.summarizeMemoryForPrompt(aiContext.relevantMemory)
      : '';

    const formattedRelationships = this.formatKnowledgeRelationships(aiContext);

    const profileNote = aiContext.stylisticProfile
      ? `\n\nDEVELOPER STYLISTIC PROFILE (guidance only, not hard truth): ${aiContext.stylisticProfile.tags.join(', ')}.`
      : '';

    const systemPrompt = [
      `You are a Senior Full Stack Engineer explaining code to its author.`,
      `Analyze the code in file "${fileName}" (${language || 'unknown language'}).`,
      ``,
      `EXPLANATION REQUIREMENTS:`,
      `1. What does the code do?`,
      `2. What are the inputs & outputs?`,
      `3. Are there any security issues or bugs?`,
      `4. How can the code be optimized?`,
      `5. How is it used in typical applications?`,
      `6. If related assets are provided below, mention them ONLY when genuinely relevant. Do not force connections.`,
      ``,
      `SAFETY RULES:`,
      `- Do NOT invent files or functions not shown in the code or context.`,
      `- Do NOT expose secrets or environment variable values.`,
      `- If context is insufficient, say so explicitly. Do not claim certainty without evidence.`,
      `- Cite file paths or source names when referencing related assets.`,
      `- Use the stylistic profile as guidance only.`,
      `- MEMORY RULE: Developer memory represents preferences and rules but is NOT guaranteed to be current or accurate.`,
      `- MEMORY RULE: If memory conflicts with the actual code shown, PREFER the actual code.`,
      `- MEMORY RULE: Do not expose private memory unless directly relevant to the explanation.`,
      `- KNOWLEDGE GRAPH RULE: Use Knowledge Relationships to explain how files/entities connect when relevant.`,
      `- KNOWLEDGE GRAPH RULE: Do not invent relationships. If relationships are incomplete, say so.`,
      `- KNOWLEDGE GRAPH RULE: Prefer direct evidence over inferred links.`,
      ``,
      `Format your response in clean, readable markdown.`,
      formattedSnippets,
      formattedLessons,
      formattedBlueprints,
      formattedRelationships ? `\n\nKnowledge Relationships:\n${formattedRelationships}` : '',
      formattedMemory,
      profileNote,
    ].filter(Boolean).join('');



    const codeBlock = `\`\`\`${language || ''}\n${code.substring(0, 15000)}\n\`\`\``;

    if (this.openAI) {
      try {
        const completion = await this.openAI.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze the following code:\n\n${codeBlock}` },
          ],
        });
        return completion.choices[0].message.content || 'Could not explain.';
      } catch (err) {
        console.error('[AI Service]: OpenAI enriched explain failed, trying Gemini...', err);
      }
    }

    if (this.geminiGenAI) {
      try {
        const model = this.geminiGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `${systemPrompt}\n\nAnalyze the following code:\n\n${codeBlock}`;
        const result = await model.generateContent(prompt);
        return result.response.text() || 'Could not explain.';
      } catch (err) {
        console.error('[AI Service]: Gemini enriched explain failed, falling back to legacy...', err);
      }
    }

    // Final fallback: legacy explainCode
    return this.explainCode(fileName, code, language);
  }
}


export const aiService = new AIService();
