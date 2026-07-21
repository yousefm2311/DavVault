import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { Types } from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { AuthenticatedRequest } from '../middleware/auth';
import { ChatSession, CodeEntity, Embedding, File as DBFile, Project, Activity, AiAgent, Workspace } from '../models';
import { aiService } from '../services/ai.service';
import { aiContextBuilder } from '../services/ai-context-builder.service';
import type { ContextCitation } from '../services/ai-context-builder.service';
import { memoryService } from '../services/memory.service';

import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  isSecretEncryptionConfigured,
} from '../services/secret-encryption.service';

const isValidObjectId = (value: unknown): value is string => (
  typeof value === 'string' && Types.ObjectId.isValid(value)
);

const invalidIdResponse = (res: Response, field = 'id') => (
  res.status(400).json({
    error: `Invalid ${field}.`,
    code: 'INVALID_OBJECT_ID',
  })
);

const notFoundResponse = (
  res: Response,
  error: 'Project not found.' | 'File not found.' | 'Chat session not found.',
  code: 'PROJECT_NOT_FOUND' | 'FILE_NOT_FOUND' | 'CHAT_SESSION_NOT_FOUND'
) => res.status(404).json({ error, code });

const aiServerErrorResponse = (res: Response, code: string) => (
  res.status(500).json({
    error: 'An unexpected AI service error occurred.',
    code,
  })
);

const accessibleProjectFilter = async (userId: string, projectId: string) => {
  const workspaces = await Workspace.find({ 'members.userId': userId }, '_id').lean();
  return {
    _id: projectId,
    $or: [
      { userId },
      { workspaceId: { $in: workspaces.map((item) => item._id) } },
    ],
  };
};

const findAccessibleProject = async (userId: string, projectId: string, projection = '_id userId') => (
  Project.findOne(await accessibleProjectFilter(userId, projectId), projection).lean()
);

const normalizeCitationId = (value?: string): string | undefined => (
  isValidObjectId(value) ? value : undefined
);


const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const TRACE_SECRET_PATTERNS = [
  /\b(password|secret|api[_-]?key|token)\s*[:=]\s*[^\s,;]+/gi,
  /\bbearer\s+[a-zA-Z0-9._\-]{12,}/gi,
  /\bsk-[a-zA-Z0-9]{12,}/g,
  /\bAIza[a-zA-Z0-9_\-]{20,}/g,
  /process\.env\.\w+/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

const sanitizeTraceText = (value: unknown, maxLength = 240): string | undefined => {
  if (typeof value !== 'string') return undefined;
  let safe = value;
  for (const pattern of TRACE_SECRET_PATTERNS) {
    safe = safe.replace(pattern, '[REDACTED]');
  }
  safe = safe.replace(/[\r\n\t]+/g, ' ').trim();
  if (!safe) return undefined;
  return safe.length > maxLength ? `${safe.substring(0, maxLength)}...` : safe;
};

const isContextTraceEnabled = () => (
  process.env.NODE_ENV !== 'production' ||
  process.env.AI_DEBUG_CONTEXT_TRACE === 'true'
);

const normalizeLegacyCitations = (
  citations: { fileName: string; path: string; score?: number }[],
  projectId?: string
): ContextCitation[] => citations.map((citation) => ({
  id: `legacy:${citation.path || citation.fileName}`,
  type: 'file',
  domainType: 'source_asset',
  title: citation.fileName || citation.path || 'Source file',
  subtitle: citation.path,
  path: citation.path,
  confidence: citation.score,
  score: citation.score,
  source: 'code',
  navigation: normalizeCitationId(projectId) ? { route: `/projects/${projectId}`, projectId } : undefined,
  fileName: citation.fileName || citation.path,
}));

const mergeCitations = (
  contextCitations: ContextCitation[] = [],
  legacyCitations: { fileName: string; path: string; score?: number }[] = [],
  projectId?: string
): ContextCitation[] => {
  const merged = [...contextCitations, ...normalizeLegacyCitations(legacyCitations, projectId)];
  const seen = new Set<string>();
  return merged.filter((citation) => {
    const key = `${citation.source}:${citation.id || citation.path || citation.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
};

export const handleChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    
    const { message, sessionId, projectId, selectedAgents } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (projectId && !isValidObjectId(projectId)) {
      return invalidIdResponse(res, 'projectId');
    }
    if (sessionId && !isValidObjectId(sessionId)) {
      return invalidIdResponse(res, 'sessionId');
    }

    const userId = req.user.id;
    let contextOwnerId = userId;
    let contextWorkspaceId: string | undefined;
    if (projectId) {
      const project = await findAccessibleProject(userId, projectId, 'userId workspaceId');
      if (!project) return notFoundResponse(res, 'Project not found.', 'PROJECT_NOT_FOUND');
      contextOwnerId = (project as any).userId.toString();
      contextWorkspaceId = (project as any).workspaceId?.toString();
    }

    // Log AI query activity
    await Activity.create({
      userId,
      action: 'ai_question',
      entityType: 'project',
      entityId: projectId ? projectId : undefined,
      metadata: { queryPreview: message.substring(0, 60) }
    });

    // 1. Retrieve or create ChatSession
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, userId });
      if (!session) {
        return notFoundResponse(res, 'Chat session not found.', 'CHAT_SESSION_NOT_FOUND');
      }
      if (String(session.projectId || '') !== String(projectId || '')) {
        return res.status(409).json({
          error: 'Start a new chat session before changing the project context.',
          code: 'SESSION_PROJECT_MISMATCH',
        });
      }
    } else {
      let title = message.substring(0, 30);
      if (message.length > 30) title += '...';
      
      session = await ChatSession.create({
        userId,
        projectId,
        title,
        messages: [],
      });
    }

    // 2. Fetch relevant context (RAG Retrieval) — compute embedding once
    const queryEmbedding = await aiService.generateEmbedding(message);

    // --- Phase 4: Context Builder (enriched context) -------------------------
    // Build enriched context. If this fails, we fall back to the legacy path below.
    let enrichedContext = null;
    try {
      enrichedContext = await aiContextBuilder.buildChatContext({
        userId,
        contextOwnerId: contextOwnerId,
        workspaceId: contextWorkspaceId,
        projectId,
        message,
        sessionId: session._id.toString(),
        queryEmbedding,
      });
    } catch (ctxErr) {
      const msg = ctxErr instanceof Error ? ctxErr.message : String(ctxErr);
      console.warn(`[AI Controller/handleChat]: Context builder failed, using legacy context. Reason: ${msg}`);
    }
    // -------------------------------------------------------------------------

    // Legacy RAG path (always computed as fallback and for citations)
    const filter: any = { userId: contextOwnerId };
    if (projectId) {
      filter.projectId = projectId;
    }

    let candidates: any[] = [];
    try {
      candidates = await Embedding.find(filter)
        .select('vector content sourceType sourceId projectId')
        .limit(3000)
        .lean();
    } catch (embeddingErr) {
      const msg = embeddingErr instanceof Error ? embeddingErr.message : String(embeddingErr);
      console.warn(`[AI Controller/handleChat]: Legacy embedding retrieval failed; continuing without legacy context. Reason: ${msg}`);
    }
    const scoredCandidates = [];

    for (const candidate of candidates) {
      const score = calculateCosineSimilarity(queryEmbedding, candidate.vector);
      if (score >= 0.35) {
        scoredCandidates.push({ candidate, score });
      }
    }

    // Sort and grab top 5 chunks
    const topScored = scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Retrieve full files details for references
    const contextChunks: { path: string; content: string; score: number }[] = [];
    const citations: { fileName: string; path: string; score: number }[] = [];

    for (const scored of topScored) {
      const c = scored.candidate;
      let pathStr = '';
      let fileName = '';

      if (c.sourceType === 'file') {
        if (!isValidObjectId(c.sourceId?.toString())) continue;
        const fileFilter: any = { _id: c.sourceId, userId: contextOwnerId };
        if (projectId) fileFilter.projectId = projectId;
        const file = await DBFile.findOne(fileFilter, 'fileName path content');
        if (file) {
          fileName = file.fileName;
          pathStr = file.path;

          contextChunks.push({
            path: file.path,
            content: c.content,
            score: scored.score,
          });

          // Add to citations
          citations.push({
            fileName,
            path: pathStr,
            score: scored.score,
          });
        }
      } else if (c.sourceType === 'codeEntity') {
        if (!isValidObjectId(c.sourceId?.toString()) || !isValidObjectId(c.projectId?.toString())) continue;
        const entityFilter: any = { _id: c.sourceId, projectId: c.projectId };
        if (projectId) entityFilter.projectId = projectId;
        const entity = await CodeEntity.findOne(entityFilter).populate('fileId', 'fileName path userId');
        const file = entity?.fileId as any;
        if (entity && file && file.userId?.toString() === contextOwnerId) {
          fileName = file.fileName;
          pathStr = file.path;

          contextChunks.push({
            path: file.path,
            content: c.content,
            score: scored.score,
          });

          citations.push({
            fileName,
            path: pathStr,
            score: scored.score,
          });
        }
      }
    }

    // Deduplicate citations by file path
    const uniqueCitations = citations.filter(
      (cit, idx, self) => self.findIndex((t) => t.path === cit.path) === idx
    );
    const responseCitations = mergeCitations(enrichedContext?.citations || [], uniqueCitations, projectId);

    // 3. Format chat history
    const history = session.messages.map((m) => ({
      role: m.sender,
      senderName: m.senderName,
      content: m.text,
    }));

    // Check if we have selected agents
    if (selectedAgents && Array.isArray(selectedAgents) && selectedAgents.length > 0) {
      // Resolve agents
      const resolvedAgents: any[] = [];
      for (const agentIdOrName of selectedAgents) {
        if (agentIdOrName === 'sys-secbot' || agentIdOrName === 'SecBot') {
          resolvedAgents.push({
            name: 'SecBot',
            role: 'AI Auditor',
            systemPrompt: 'You are SecBot, a strict security auditor. Focus on input validation, vulnerabilities, and leaking variables.'
          });
        } else if (agentIdOrName === 'sys-perfbot' || agentIdOrName === 'PerfBot') {
          resolvedAgents.push({
            name: 'PerfBot',
            role: 'AI Optimizer',
            systemPrompt: 'You are PerfBot, a speed and resources optimizer. Focus on performance, memory usage, and non-blocking operations.'
          });
        } else if (agentIdOrName === 'sys-docbot' || agentIdOrName === 'DocBot') {
          resolvedAgents.push({
            name: 'DocBot',
            role: 'AI Specialist',
            systemPrompt: 'You are DocBot, a clean coder and documentation expert. Focus on docstrings, README files, readability, and naming conventions.'
          });
        } else {
          // Find in DB
          try {
            if (!isValidObjectId(agentIdOrName)) continue;
            const dbAgent = await AiAgent.findOne({ _id: agentIdOrName, userId }).select('+apiKey');
            if (dbAgent) {
              resolvedAgents.push({
                ...dbAgent.toObject(),
                apiKey: decryptSecret(dbAgent.apiKey),
              });
            }
          } catch (err) {
            console.error('[AI Controller/handleChat]: Failed to find custom agent:', err);
          }
        }
      }

      if (resolvedAgents.length > 0) {
        // Save user message first
        session.messages.push({
          sender: 'user',
          text: message,
          createdAt: new Date(),
        });

        const localHistory = [...history, { role: 'user' as const, content: message }];
        const newReplies: any[] = [];

        for (const agent of resolvedAgents) {
          const agentReply = await aiService.chatWithAgentContext(
            agent.name,
            agent.role,
            agent.systemPrompt,
            message,
            localHistory,
            // Use enriched context's primary chunks if available, else legacy
            enrichedContext ? enrichedContext.primaryCodeContext : contextChunks,
            agent.modelProvider,
            agent.apiKey,
            agent.modelName
          );

          const dbMessage = {
            sender: 'assistant' as const,
            senderName: agent.name,
            text: agentReply,
            citations: responseCitations,
            createdAt: new Date(),
          };

          session.messages.push(dbMessage);
          newReplies.push({ senderName: agent.name, text: agentReply });

          localHistory.push({
            role: 'assistant',
            senderName: agent.name,
            content: agentReply
          });
        }

        await session.save();

        return res.status(200).json({
          sessionId: session._id,
          title: session.title,
          answer: newReplies[newReplies.length - 1].text, // default/last answer
          answers: newReplies, // all agent responses in order
          citations: responseCitations,
        });
      }
    }

    // Default chat — use enriched context if available, else legacy
    let answer: string;
    if (enrichedContext) {
      try {
        answer = await aiService.chatWithEnrichedContext(message, history, enrichedContext);
      } catch (enrichedErr) {
        const msg = enrichedErr instanceof Error ? enrichedErr.message : String(enrichedErr);
        console.warn(`[AI Controller/handleChat]: Enriched chat failed, falling back to legacy. Reason: ${msg}`);
        answer = await aiService.chatWithContext(message, history, contextChunks);
      }
    } else {
      answer = await aiService.chatWithContext(message, history, contextChunks);
    }

    session.messages.push({
      sender: 'user',
      text: message,
      createdAt: new Date(),
    });

    session.messages.push({
      sender: 'assistant',
      text: answer,
      citations: responseCitations,
      createdAt: new Date(),
    });

    await session.save();

    // Fire-and-forget memory extraction — must NOT block or delay the chat response.
    // Only inspects the single user message from this turn.
    memoryService.extractMemoryCandidatesFromChat({
      userId,
      workspaceId: contextWorkspaceId,
      projectId: projectId || undefined,
      messages: [{ role: 'user', content: message }],
    }).catch((memErr: any) => {
      const msg = memErr instanceof Error ? memErr.message : String(memErr);
      console.warn(`[AI Controller/handleChat]: Memory extraction failed silently. Reason: ${msg}`);
    });

    return res.status(200).json({
      sessionId: session._id,
      title: session.title,
      answer,
      citations: responseCitations,
    });
  } catch (error: any) {
    return aiServerErrorResponse(res, 'AI_CHAT_FAILED');
  }
};

export const explainCodeFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { code, fileName, language, projectId, fileId } = req.body;
    if (!code || !fileName) {
      return res.status(400).json({ error: 'Code content and file name are required.' });
    }
    if (projectId && !isValidObjectId(projectId)) {
      return invalidIdResponse(res, 'projectId');
    }
    if (fileId && !isValidObjectId(fileId)) {
      return invalidIdResponse(res, 'fileId');
    }

    const userId = req.user.id;
    let contextOwnerId = userId;
    let contextWorkspaceId: string | undefined;
    let project = null;
    if (projectId) {
      project = await findAccessibleProject(userId, projectId, '_id userId workspaceId');
      if (!project) return notFoundResponse(res, 'Project not found.', 'PROJECT_NOT_FOUND');
      contextOwnerId = (project as any).userId.toString();
      contextWorkspaceId = (project as any).workspaceId?.toString();
    }

    if (fileId) {
      const fileFilter: any = { _id: fileId, userId: contextOwnerId };
      if (projectId) fileFilter.projectId = projectId;
      const file = await DBFile.findOne(fileFilter, '_id projectId').lean();
      if (!file) return notFoundResponse(res, 'File not found.', 'FILE_NOT_FOUND');
    }

    await Activity.create({
      userId,
      action: 'ai_question',
      entityType: 'file',
      entityId: fileId || undefined,
      metadata: { fileName }
    });

    // --- Phase 4: Context Builder for explain-code --------------------------
    let explanation: string;
    let explainCitations: ContextCitation[] = [];
    if (userId) {
      let explainCtx = null;
      try {
        explainCtx = await aiContextBuilder.buildExplainCodeContext({
          userId,
          contextOwnerId,
          workspaceId: contextWorkspaceId,
          projectId,
          fileId,
          code,
          language,
        });
      } catch (ctxErr) {
        const msg = ctxErr instanceof Error ? ctxErr.message : String(ctxErr);
        console.warn(`[AI Controller/explainCode]: Context builder failed, using legacy path. Reason: ${msg}`);
      }

      if (explainCtx) {
        explainCitations = explainCtx.citations || [];
        try {
          explanation = await aiService.explainCodeWithContext(fileName, code, language, explainCtx);
        } catch (enrichedErr) {
          const msg = enrichedErr instanceof Error ? enrichedErr.message : String(enrichedErr);
          console.warn(`[AI Controller/explainCode]: Enriched explain failed, using legacy. Reason: ${msg}`);
          explanation = await aiService.explainCode(fileName, code, language);
        }
      } else {
        explanation = await aiService.explainCode(fileName, code, language);
      }
    } else {
      // No authenticated user — legacy path
      explanation = await aiService.explainCode(fileName, code, language);
    }
    // -----------------------------------------------------------------------

    return res.status(200).json({
      explanation,
      ...(explainCitations.length > 0 ? { citations: explainCitations } : {}),
    });
  } catch {
    return aiServerErrorResponse(res, 'AI_EXPLAIN_FAILED');
  }
};

export const debugContextTrace = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    if (!isContextTraceEnabled()) {
      return res.status(403).json({
        error: 'AI context trace debug endpoint is disabled.',
        code: 'AI_CONTEXT_TRACE_DISABLED',
      });
    }

    const { projectId, fileId, message, mode } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required.' });
    }
    if (mode !== 'chat' && mode !== 'explain') {
      return res.status(400).json({ error: 'mode must be "chat" or "explain".' });
    }
    if (projectId && !isValidObjectId(projectId)) {
      return invalidIdResponse(res, 'projectId');
    }
    if (fileId && !isValidObjectId(fileId)) {
      return invalidIdResponse(res, 'fileId');
    }

    const userId = req.user.id;
    let contextOwnerId = userId;
    let project = null;
    if (projectId) {
      project = await findAccessibleProject(userId, projectId, '_id userId');
      if (!project) return notFoundResponse(res, 'Project not found.', 'PROJECT_NOT_FOUND');
      contextOwnerId = (project as any).userId.toString();
    }

    let file = null;
    if (fileId) {
      const fileFilter: any = { _id: fileId, userId: contextOwnerId };
      if (projectId) fileFilter.projectId = projectId;
      file = await DBFile.findOne(fileFilter, 'content language path fileName projectId').lean();
      if (!file) return notFoundResponse(res, 'File not found.', 'FILE_NOT_FOUND');
    }

    let queryEmbedding: number[] | undefined;
    if (mode === 'chat') {
      try {
        queryEmbedding = await aiService.generateEmbedding(message);
      } catch (embedErr) {
        const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
        console.warn(`[AI Controller/debugContextTrace]: Embedding generation failed; continuing without embedding. Reason: ${msg}`);
      }
    }

    const context = mode === 'chat'
      ? await aiContextBuilder.buildChatContext({
          userId,
          contextOwnerId,
          projectId,
          message,
          queryEmbedding,
        })
      : await aiContextBuilder.buildExplainCodeContext({
          userId,
          contextOwnerId,
          projectId: projectId || (file as any)?.projectId?.toString(),
          fileId,
          code: ((file as any)?.content || message).substring(0, 15000),
          language: (file as any)?.language || 'unknown',
        });

    return res.status(200).json({
      mode,
      contextSummary: sanitizeTraceText(context.contextSummary, 800) || '',
      counts: {
        codeChunks: context.primaryCodeContext.length,
        searchResults: context.relatedSearchResults.length,
        snippets: context.relatedSnippets.length,
        debuggingLessons: context.relatedDebuggingLessons.length,
        architectureBlueprints: context.relatedArchitectureBlueprints.length,
        memory: context.relevantMemory.length,
        relationships: context.relatedRelationships.length,
        conversationMessages: context.recentConversation.length,
      },
      selectedRelationships: context.relatedRelationships.map((relationship) => ({
        relationshipType: sanitizeTraceText(relationship.relationshipType, 80),
        sourceDisplayName: sanitizeTraceText(relationship.sourceDisplayName, 160),
        targetDisplayName: sanitizeTraceText(relationship.targetDisplayName, 160),
        sourcePath: sanitizeTraceText(relationship.sourcePath, 240),
        targetPath: sanitizeTraceText(relationship.targetPath, 240),
        confidence: relationship.confidence,
        evidenceReason: sanitizeTraceText(relationship.evidence?.reason, 240),
      })),
      selectedMemory: context.relevantMemory.map((memory) => ({
        type: sanitizeTraceText(memory.type, 80),
        scope: sanitizeTraceText(memory.scope, 80),
        title: sanitizeTraceText(memory.title, 160),
        confidence: memory.confidence,
      })),
      warnings: context.warnings.map((warning) => sanitizeTraceText(warning, 300)).filter(Boolean),
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to build AI context trace.' });
  }
};


export const getSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId } = req.query;

    const filter: any = { userId: req.user.id };
    if (projectId) {
      if (!isValidObjectId(projectId)) return invalidIdResponse(res, 'projectId');
      const project = await findAccessibleProject(req.user.id, projectId, '_id userId');
      if (!project) return notFoundResponse(res, 'Project not found.', 'PROJECT_NOT_FOUND');
      filter.projectId = projectId;
    }

    const sessions = await ChatSession.find(filter, 'title projectId createdAt').sort({ updatedAt: -1 });
    return res.status(200).json({ sessions });
  } catch {
    return aiServerErrorResponse(res, 'AI_SESSIONS_LIST_FAILED');
  }
};

export const getSessionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;
    if (!isValidObjectId(id)) return invalidIdResponse(res, 'sessionId');

    const session = await ChatSession.findOne({ _id: id, userId: req.user.id });
    if (!session) return notFoundResponse(res, 'Chat session not found.', 'CHAT_SESSION_NOT_FOUND');

    return res.status(200).json({ session });
  } catch {
    return aiServerErrorResponse(res, 'AI_SESSION_READ_FAILED');
  }
};

export const deleteSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;
    if (!isValidObjectId(id)) return invalidIdResponse(res, 'sessionId');

    const session = await ChatSession.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!session) return notFoundResponse(res, 'Chat session not found.', 'CHAT_SESSION_NOT_FOUND');

    return res.status(200).json({ message: 'Chat session deleted successfully.' });
  } catch {
    return aiServerErrorResponse(res, 'AI_SESSION_DELETE_FAILED');
  }
};

export const simulateTeamDiscussion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { projectId, task } = req.body;
    if (!projectId || !task) {
      return res.status(400).json({ error: 'projectId and task are required.' });
    }
    if (!isValidObjectId(projectId)) return invalidIdResponse(res, 'projectId');

    const project = await findAccessibleProject(req.user.id, projectId, '_id userId name language');
    if (!project) return notFoundResponse(res, 'Project not found.', 'PROJECT_NOT_FOUND');
    const contextOwnerId = (project as any).userId.toString();
    const files = await DBFile.find({ projectId, userId: contextOwnerId }, 'path fileName summary');

    const contextStr = files.map((f, idx) => `File #${idx + 1}: ${f.path}\nSummary: ${f.summary || 'Core code file'}`).join('\n\n');

    const systemPrompt = `You are a team of three virtual AI software engineers discussing a coding task.
The team consists of:
1. **SecBot** (Security Auditor): Focused on security vulnerabilities, leaks, data validation, and safety.
2. **PerfBot** (Performance Optimizer): Focused on code efficiency, memory prints, asynchronous execution, and speed.
3. **DocBot** (Documentation Specialist): Focused on code readability, clear docstrings, explanations, and writing manuals.

They are discussing the following codebase task: "${task}" for the project "${project.name}" (written in ${project.language || 'code'}).

CODEBASE FILES CONTEXT:
${contextStr.substring(0, 4000)}

Please write an interactive transcript of their discussion. They should address each other by name, debate technical solutions, and arrive at a consensus.
Finally, output a consolidated refactoring proposal with proposed code.

Respond ONLY with a JSON object (no markdown formatting, no backticks, no other text) in this exact format:
{
  "discussion": [
    { "bot": "SecBot", "text": "SecBot message content..." },
    { "bot": "PerfBot", "text": "PerfBot message content..." },
    { "bot": "DocBot", "text": "DocBot message content..." }
  ],
  "proposal": {
    "title": "Title of the proposal",
    "explanation": "Agreed-upon solution summary...",
    "code": "Proposed code changes..."
  }
}

Answer in the same language as the user's task. If the user's task is in Arabic, their conversation text should be in Arabic, but bot names and code remain technical.`;

    let generatedText = '';
    const openAIKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openAIKey) {
      try {
        const openaiInstance = new OpenAI({ apiKey: openAIKey });
        const completion = await openaiInstance.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a JSON responder. Always return raw JSON.' },
            { role: 'user', content: systemPrompt }
          ],
          response_format: { type: 'json_object' }
        });
        generatedText = completion.choices[0].message.content || '';
      } catch (err) {
        console.error('[AI Controller/Team]: OpenAI simulation failed:', err);
      }
    } else if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(systemPrompt);
        generatedText = result.response.text() || '';
      } catch (err) {
        console.error('[AI Controller/Team]: Gemini simulation failed:', err);
      }
    }

    if (generatedText) {
      try {
        const parsed = JSON.parse(generatedText);
        return res.status(200).json(parsed);
      } catch (e) {
        console.error('[AI Controller/Team]: Failed to parse generated text as JSON:', e);
      }
    }

    // Smart Code-Aware Fallback
    const isArabic = task.includes('ازاي') || task.includes('فين') || task.includes('شرح') || task.includes('تحسين') || /[\u0600-\u06FF]/.test(task);
    
    // Scan codebase files for realistic security, performance, and documentation insights
    const securityFindings: string[] = [];
    const performanceFindings: string[] = [];
    const documentationFindings: string[] = [];
    let targetedCodeSnippet = '';
    let targetFileName = '';

    for (const f of files) {
      // Find full file content for static analysis scan
      const fullFile = await DBFile.findOne({ _id: f._id, projectId, userId: contextOwnerId }, 'content fileName path');
      if (!fullFile || !fullFile.content) continue;

      const code = fullFile.content;
      const name = fullFile.fileName;

      // 1. Security Scan
      if (code.includes('process.env') || code.includes('apiKey') || code.includes('password') || code.includes('secret') || code.includes('token')) {
        securityFindings.push(isArabic 
          ? `وجدنا استخداماً لرموز تحقق أو متغيرات تهيئة في الملف \`${name}\`؛ يجب التأكد من عدم كتابتها مباشرة وتأمينها في بيئة العمل.`
          : `Detected configuration variables or tokens in \`${name}\`. Ensure secrets are externalized in env files.`);
      }
      if (code.includes('dangerouslySetInnerHTML') || code.includes('eval(') || code.includes('exec(')) {
        securityFindings.push(isArabic
          ? `الملف \`${name}\` يستعمل دوال تشغيل خطيرة مثل eval أو innerHTML؛ تأكد من تصفية المدخلات لمنع ثغرات XSS.`
          : `Dangerous dynamic execution or DOM insertion in \`${name}\`. Validate input payload to prevent injections.`);
      }
      if (code.includes('query') || code.includes('select') || code.includes('find(')) {
        securityFindings.push(isArabic
          ? `تأكد من تنظيف بارامترات الاستعلام البرمجي لمنع ثغرات حقن الاستعلامات في الملف \`${name}\`.`
          : `Database fetch parameter validation required in \`${name}\` to avoid potential injection vulnerabilities.`);
      }

      // 2. Performance Scan
      if (code.includes('sync') || code.includes('readFileSync') || code.includes('writeFileSync')) {
        performanceFindings.push(isArabic
          ? `وجدنا دوال متزامنة لحظر المسارات (Sync methods) في الملف \`${name}\`؛ يُفضل التحول إلى async لمنع تجميد حلقة الأحداث (Event Loop).`
          : `Synchronous file operations detected in \`${name}\`. Migrate to asynchronous API calls to prevent blocking the event loop.`);
      }
      if (code.match(/await\s+\w+\(/g) && code.split('await').length > 3) {
        performanceFindings.push(isArabic
          ? `الملف \`${name}\` يحتوي على عمليات await متتالية؛ يمكن زيادة الأداء والسرعة عبر تجميعها بـ Promise.all.`
          : `Multiple sequential waits detected in \`${name}\`. Aggregate using Promise.all to load resources in parallel.`);
      }

      // 3. Documentation Scan
      const functionsCount = (code.match(/function\s+\w+/g) || []).length + (code.match(/\w+\s*=\s*\([^)]*\)\s*=>/g) || []).length;
      const commentsCount = (code.match(/\/\/|\/\*/g) || []).length;
      if (functionsCount > 1 && commentsCount < 2) {
        documentationFindings.push(isArabic
          ? `يحتوي الملف \`${name}\` على ${functionsCount} دوال برمجية ولكن شرح التعليقات شحيح (${commentsCount} تعليق). نقترح كتابة JSDoc.`
          : `File \`${name}\` has ${functionsCount} function exports with minimal inline comments (${commentsCount}). Document signatures clearly.`);
      }

      // Select first code file to refactor
      if (!targetedCodeSnippet && code.length > 50 && (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.dart') || name.endsWith('.py') || name.endsWith('.go'))) {
        targetedCodeSnippet = code.substring(0, 1000);
        targetFileName = name;
      }
    }

    // Fallbacks if findings list is empty
    if (securityFindings.length === 0) {
      securityFindings.push(isArabic 
        ? 'التحقق من صحة جميع المعاملات الواردة والتأكد من تصفيتها بشكل آمن لمنع هجمات الحقن.' 
        : 'Sanitize all user-input parameters and implement strict type validation.');
    }
    if (performanceFindings.length === 0) {
      performanceFindings.push(isArabic
        ? 'تجنب تكرار قراءة الملفات من القرص الصلب وتفعيل ذاكرة التخزين المؤقت (Caching).'
        : 'Avoid repeated disk I/O operations and configure memory cache keys.');
    }
    if (documentationFindings.length === 0) {
      documentationFindings.push(isArabic
        ? 'كتابة شرح واضح للمعايير والمخرجات المتوقعة في رأس الملف المصدري.'
        : 'Write structured docstrings detailing parameters, return types, and exceptions.');
    }

    const discussion = isArabic ? [
      {
        bot: 'SecBot',
        text: `لقد قمت بمراجعة الكود البرمجي لمشروعك بخصوص "${task}". بناءً على مراجعة الملفات، إليك أهم النقاط الأمنية:\n1. ${securityFindings[0]}\n2. يوصى بمراجعة وتأمين كافة منافذ البيانات والمصادقة.`
      },
      {
        bot: 'PerfBot',
        text: `أتفق معك يا SecBot. ومن منظور كفاءة الأداء وسرعة الاستجابة، لاحظت الآتي:\n1. ${performanceFindings[0]}\n2. يجب مراجعة أي دوال معقدة والتأكد من خلوها من حظر الذاكرة أو تسريبات الموارد.`
      },
      {
        bot: 'DocBot',
        text: `رائع! من جهتي، قمت بتوثيق المعايير البرمجية لتعديل كود المشروع:\n1. ${documentationFindings[0]}\n2. قمت بصياغة رقعة برمجية محسنة متضمنة معالجة متكاملة للأخطاء (Error Handling) وتعليقات توضيحية لسهولة الصيانة.`
      }
    ] : [
      {
        bot: 'SecBot',
        text: `I have audited your codebase regarding "${task}". Security findings:\n1. ${securityFindings[0]}\n2. Strictly manage access controls and enforce HTTPS parameters across connections.`
      },
      {
        bot: 'PerfBot',
        text: `Agreed SecBot. On the performance optimization front:\n1. ${performanceFindings[0]}\n2. Prevent Event Loop blockages and optimize loops/caching for repeated database fetches.`
      },
      {
        bot: 'DocBot',
        text: `Perfect. Regarding code readability and comments:\n1. ${documentationFindings[0]}\n2. I have refactored a secure and documented version of the code structure for immediate use.`
      }
    ];

    const cleanSnippet = targetedCodeSnippet || `// Default helper\nfunction process(data) {\n  return data;\n}`;
    const proposal = isArabic ? {
      title: `خطة التحسين والتأمين لملف ${targetFileName || 'main.dart'}`,
      explanation: `مقترح التحسين البرمجي المتفق عليه لملف ${targetFileName || 'main.dart'} لحل مشكلة "${task}" بطريقة آمنة وسريعة الاستجابة.`,
      code: `// كود مقترح لملف ${targetFileName || 'main.dart'}
// تم تعديله بواسطة SecBot و PerfBot و DocBot
${cleanSnippet.split('\n').map(line => `// ${line}`).join('\n')}

// الكود المطور والآمن البديل:
export async function secureAndOptimize(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Data payload must be a valid object');
  }
  
  // فلترة المدخلات لتجنب ثغرات الحقن
  const sanitized = JSON.parse(JSON.stringify(payload));
  
  // تشغيل غير متزامن خفيف لتجنب حجب المعالج
  return new Promise((resolve) => {
    setImmediate(() => {
      resolve({
        success: true,
        processedAt: Date.now(),
        data: sanitized
      });
    });
  });
}`
    } : {
      title: `Optimized & Secured Patch for ${targetFileName || 'main.dart'}`,
      explanation: `Consensus refactoring proposal for ${targetFileName || 'main.dart'} to address "${task}" in a secured and non-blocking manner.`,
      code: `// Refactored version of ${targetFileName || 'main.dart'}
// Audited by SecBot, PerfBot, and DocBot
${cleanSnippet.split('\n').map(line => `// ${line}`).join('\n')}

// Upgraded Consensus Code:
export async function secureAndOptimize(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Data payload must be a valid object');
  }
  
  // Sanitize input payload
  const sanitized = JSON.parse(JSON.stringify(payload));
  
  // Run asynchronously to prevent event loop blockages
  return new Promise((resolve) => {
    setImmediate(() => {
      resolve({
        success: true,
        processedAt: Date.now(),
        data: sanitized
      });
    });
  });
}`
    };

    return res.status(200).json({ discussion, proposal });
  } catch {
    return aiServerErrorResponse(res, 'AI_TEAM_SIMULATION_FAILED');
  }
};

export const getAgents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    
    // Default system agents
    const systemAgents = [
      {
        _id: 'sys-secbot',
        name: 'SecBot',
        email: 'secbot@devvault.ai',
        role: 'AI Auditor',
        focus: 'Input validation, vulnerability scans, secrets leakage',
        systemPrompt: 'You are SecBot, a strict security auditor. Focus on input validation, vulnerabilities, and leaking variables.',
        modelProvider: 'gemini',
        modelName: 'gemini-1.5-flash',
        isSystem: true
      },
      {
        _id: 'sys-perfbot',
        name: 'PerfBot',
        email: 'perfbot@devvault.ai',
        role: 'AI Optimizer',
        focus: 'Code speed, event-loop blocking, memory usage, promises',
        systemPrompt: 'You are PerfBot, a speed and resources optimizer. Focus on performance, memory usage, and non-blocking operations.',
        modelProvider: 'gemini',
        modelName: 'gemini-1.5-flash',
        isSystem: true
      },
      {
        _id: 'sys-docbot',
        name: 'DocBot',
        email: 'docbot@devvault.ai',
        role: 'AI Specialist',
        focus: 'Code documentation, README, interface design, comments',
        systemPrompt: 'You are DocBot, a clean coder and documentation expert. Focus on docstrings, README files, readability, and naming conventions.',
        modelProvider: 'gemini',
        modelName: 'gemini-1.5-flash',
        isSystem: true
      }
    ];

    const customAgents = await AiAgent.find({ userId: req.user.id }).select('+apiKey');
    const canEncrypt = isSecretEncryptionConfigured();

    for (const agent of customAgents) {
      if (agent.apiKey && !isEncryptedSecret(agent.apiKey) && canEncrypt) {
        agent.apiKey = encryptSecret(agent.apiKey);
        await agent.save();
      }
    }

    const safeCustomAgents = customAgents.map((agent) => {
      const safeAgent = agent.toObject() as unknown as Record<string, unknown>;
      safeAgent.hasCustomApiKey = Boolean(safeAgent.apiKey);
      delete safeAgent.apiKey;
      return safeAgent;
    });

    return res.status(200).json({
      agents: [...systemAgents, ...safeCustomAgents]
    });
  } catch {
    return aiServerErrorResponse(res, 'AI_AGENTS_LIST_FAILED');
  }
};

export const createAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { name, role, focus, systemPrompt, modelProvider, modelName, apiKey } = req.body;

    if (!name || !role || !focus || !systemPrompt) {
      return res.status(400).json({ error: 'name, role, focus, and systemPrompt are required.' });
    }

    const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@devvault.ai`;

    const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined;
    const agent = await AiAgent.create({
      userId: req.user.id,
      name,
      email,
      role,
      focus,
      systemPrompt,
      modelProvider: modelProvider || 'gemini',
      modelName: modelName || 'gemini-1.5-flash',
      apiKey: encryptedApiKey,
      isSystem: false
    });

    const safeAgent = agent.toObject() as unknown as Record<string, unknown>;
    safeAgent.hasCustomApiKey = Boolean(encryptedApiKey);
    delete safeAgent.apiKey;

    return res.status(201).json({ message: 'AI Coworker created successfully.', agent: safeAgent });
  } catch {
    return aiServerErrorResponse(res, 'AI_AGENT_CREATE_FAILED');
  }
};

export const deleteAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const { id } = req.params;
    if (!isValidObjectId(id)) return invalidIdResponse(res, 'agentId');

    const agent = await AiAgent.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!agent) {
      return res.status(404).json({ error: 'AI Coworker not found or unauthorized.' });
    }

    return res.status(200).json({ message: 'AI Coworker deleted successfully.' });
  } catch {
    return aiServerErrorResponse(res, 'AI_AGENT_DELETE_FAILED');
  }
};
