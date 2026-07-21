/**
 * Memory Service
 *
 * Lightweight, durable developer memory layer backed by MongoDB only.
 * No external infrastructure required.
 *
 * Responsibilities:
 * - Store developer preferences, coding conventions, architecture decisions.
 * - Retrieve relevant memories for AI context enrichment.
 * - Deterministically extract memory candidates from chat messages.
 * - Track memory usage frequency.
 *
 * Safety rules:
 * - Never stores secrets, API keys, tokens, passwords, or .env values.
 * - Never throws — all public methods return safe defaults on failure.
 * - Content is hard-capped at 2000 chars before storage.
 * - Duplicate detection prevents memory bloat.
 */

import { Memory, MemoryType, MemoryScope, MemorySource } from '../models/Memory';
import { Types } from 'mongoose';

// ─── Secret-pattern guard ────────────────────────────────────────────────────
// These patterns indicate the content may contain a secret — reject it.
const SECRET_PATTERNS = [
  /\bpassword\s*[:=]\s*\S+/i,
  /\bsecret\s*[:=]\s*\S+/i,
  /\bapikey\s*[:=]\s*\S+/i,
  /\bapi_key\s*[:=]\s*\S+/i,
  /\btoken\s*[:=]\s*\S+/i,
  /\bbearer\s+[a-zA-Z0-9._\-]{20,}/i,
  /\bsk-[a-zA-Z0-9]{20,}/,           // OpenAI key prefix
  /\bAIza[a-zA-Z0-9_\-]{35,}/,       // Google API key prefix
  /process\.env\.\w+/,
  /\bprivate[_\s]?key\b/i,
];

function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

// ─── Deterministic trigger phrases ───────────────────────────────────────────
// Must appear at the start of a message or as a clear command phrase.
const MEMORY_TRIGGERS: { pattern: RegExp; type: MemoryType; scope: MemoryScope }[] = [
  { pattern: /\balways use\b/i,              type: 'preference',       scope: 'user' },
  { pattern: /\bdon'?t use\b/i,              type: 'preference',       scope: 'user' },
  { pattern: /\bprefer\b/i,                  type: 'preference',       scope: 'user' },
  { pattern: /\bfrom now on\b/i,             type: 'correction',       scope: 'user' },
  { pattern: /\bremember( that)?\b/i,        type: 'decision',         scope: 'user' },
  { pattern: /\bwe use\b/i,                  type: 'workspace_rule',   scope: 'workspace' },
  { pattern: /\bour standard is\b/i,         type: 'architecture_rule',scope: 'workspace' },
  { pattern: /\bour workspace (standard|rule|convention)\b/i, type: 'workspace_rule', scope: 'workspace' },
  { pattern: /\buse (?:the )?repository pattern\b/i, type: 'architecture_rule', scope: 'user' },
  { pattern: /\bnever use\b/i,               type: 'preference',       scope: 'user' },
  { pattern: /\bstop using\b/i,              type: 'correction',       scope: 'user' },
  { pattern: /\bour team (prefers?|uses?)\b/i, type: 'workspace_rule', scope: 'workspace' },
  { pattern: /\bcode style[: ]/i,            type: 'coding_style',     scope: 'user' },
];

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface CreateMemoryInput {
  userId: string;
  workspaceId?: string;
  projectId?: string;
  type: MemoryType;
  scope: MemoryScope;
  title: string;
  content: string;
  source: MemorySource;
  confidence?: number;
  tags?: string[];
}

export interface FindMemoryOptions {
  userId: string;
  workspaceId?: string;
  projectId?: string;
  types?: MemoryType[];
  limit?: number;
}

export interface ContextMemory {
  id: string;
  type: MemoryType;
  scope: MemoryScope;
  title: string;
  content: string;
  confidence: number;
  tags: string[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MemoryService {

  /**
   * Creates a new memory entry.
   * Safe: rejects secrets, truncates overlong content, deduplicates by title+userId.
   * Returns the created memory or null on failure/rejection.
   */
  async createMemory(input: CreateMemoryInput): Promise<ContextMemory | null> {
    try {
      // Guard: reject secret-containing content
      if (containsSecret(input.content) || containsSecret(input.title)) {
        console.warn('[MemoryService]: Rejected memory candidate — possible secret detected.');
        return null;
      }

      // Guard: hard cap content length
      const safeContent = input.content.substring(0, 2000).trim();
      const safeTitle   = input.title.substring(0, 200).trim();

      if (!safeContent || !safeTitle) return null;

      // Deduplication: skip if an active memory with the same title and userId already exists
      const existing = await Memory.findOne({
        userId:   new Types.ObjectId(input.userId),
        title:    safeTitle,
        isActive: true,
      }).lean();

      if (existing) {
        // Silently skip — not an error
        return null;
      }

      const doc = await Memory.create({
        userId:      new Types.ObjectId(input.userId),
        workspaceId: input.workspaceId ? new Types.ObjectId(input.workspaceId) : undefined,
        projectId:   input.projectId   ? new Types.ObjectId(input.projectId)   : undefined,
        type:        input.type,
        scope:       input.scope,
        title:       safeTitle,
        content:     safeContent,
        source:      input.source,
        confidence:  input.confidence ?? 0.7,
        tags:        input.tags || [],
        isActive:    true,
      });

      return {
        id:         doc._id.toString(),
        type:       doc.type,
        scope:      doc.scope,
        title:      doc.title,
        content:    doc.content,
        confidence: doc.confidence,
        tags:       doc.tags,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MemoryService]: createMemory failed — ${msg}`);
      return null;
    }
  }

  /**
   * Finds relevant active memories for a user/workspace/project.
   * Returns most recently updated memories, respecting the limit.
   * Safe: never throws.
   */
  async findRelevantMemory(options: FindMemoryOptions): Promise<ContextMemory[]> {
    try {
      const { userId, workspaceId, projectId, types, limit = 5 } = options;

      // Build scope filter: user-scoped always included.
      // Project and workspace memories included when the corresponding IDs are provided.
      const scopeConditions: any[] = [
        { userId: new Types.ObjectId(userId), scope: 'user' },
      ];
      if (projectId) {
        scopeConditions.push({ projectId: new Types.ObjectId(projectId), scope: 'project' });
      }
      if (workspaceId) {
        scopeConditions.push({ workspaceId: new Types.ObjectId(workspaceId), scope: 'workspace' });
      }

      const filter: any = {
        isActive: true,
        $or: scopeConditions,
      };
      if (types && types.length > 0) {
        filter.type = { $in: types };
      }

      const docs = await Memory.find(filter, 'type scope title content confidence tags')
        .sort({ usageCount: -1, updatedAt: -1 })
        .limit(limit)
        .lean();

      return docs.map((d: any) => ({
        id:         d._id.toString(),
        type:       d.type,
        scope:      d.scope,
        title:      d.title,
        content:    d.content,
        confidence: d.confidence,
        tags:       d.tags || [],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MemoryService]: findRelevantMemory failed — ${msg}`);
      return [];
    }
  }

  /**
   * Increments usageCount and updates lastUsedAt for each memory ID.
   * Fire-and-forget safe: any failure is swallowed.
   */
  async incrementUsage(memoryIds: string[]): Promise<void> {
    try {
      if (!memoryIds || memoryIds.length === 0) return;
      await Memory.updateMany(
        { _id: { $in: memoryIds.map((id) => new Types.ObjectId(id)) } },
        { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MemoryService]: incrementUsage failed — ${msg}`);
    }
  }

  /**
   * Deterministically extracts memory candidates from recent chat messages.
   * Only creates memories from explicit preference/rule/correction phrasing.
   * Does NOT use LLM — purely pattern-based for safety and predictability.
   * Safe: never throws.
   */
  async extractMemoryCandidatesFromChat(params: {
    userId: string;
    workspaceId?: string;
    projectId?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<void> {
    try {
      const { userId, workspaceId, projectId, messages } = params;

      // Only inspect user messages — never assistant messages
      const userMessages = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .filter((text) => text.length >= 10 && text.length <= 1000);

      for (const text of userMessages) {
        // Skip if text contains secret patterns
        if (containsSecret(text)) continue;

        // Check for trigger phrases
        for (const trigger of MEMORY_TRIGGERS) {
          if (!trigger.pattern.test(text)) continue;

          // Build a clean title from the message (first 80 chars)
          const title = text.length > 80 ? text.substring(0, 80).trim() + '…' : text.trim();

          await this.createMemory({
            userId,
            workspaceId,
            projectId,
            type:       trigger.type,
            scope:      trigger.scope,
            title,
            content:    text,
            source:     'chat',
            confidence: 0.75,
            tags:       ['auto-extracted'],
          });

          // Only extract one memory per message to avoid flooding
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MemoryService]: extractMemoryCandidatesFromChat failed — ${msg}`);
    }
  }

  /**
   * Formats memories into a compact string block for injection into AI prompts.
   * Safe: never throws, returns empty string on no memories.
   */
  summarizeMemoryForPrompt(memories: ContextMemory[]): string {
    if (!memories || memories.length === 0) return '';

    const lines = memories.map(
      (m) =>
        `[${m.type.replace(/_/g, ' ')} | ${m.scope} | confidence: ${(m.confidence * 100).toFixed(0)}%] ${m.title}: ${m.content}`
    );

    return `DEVELOPER MEMORY (user preferences and rules — treat as guidance, not guaranteed fact):\n${lines.join('\n')}`;
  }
}

export const memoryService = new MemoryService();
