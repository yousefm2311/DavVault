import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { GraphRelationship, knowledgeGraphService } from '../services/knowledge-graph.service';
import { KnowledgeNodeType, RelationshipType } from '../models/KnowledgeRelationship';
import {
  Activity,
  ChatSession,
  CodeEntity,
  ErrorSolution,
  File as DBFile,
  Memory,
  Project,
  ReusableSystem,
  Snippet,
} from '../models';

interface DisplayNode {
  displayName: string;
  displayType: string;
  displaySubtitle?: string;
  path?: string;
}

const NODE_TYPE_LABELS: Record<KnowledgeNodeType, string> = {
  codebase: 'Codebase',
  source_asset: 'Source asset',
  logical_entity: 'Logical entity',
  code_asset: 'Code asset',
  debugging_lesson: 'Debugging lesson',
  architecture_blueprint: 'Architecture blueprint',
  memory: 'Memory',
  chat_session: 'Chat session',
  activity: 'Activity',
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  contains: 'Contains',
  defines: 'Defines',
  imports: 'Imports',
  exports: 'Exports',
  calls: 'Calls',
  uses: 'Uses',
  depends_on: 'Depends on',
  extends: 'Extends',
  implements: 'Implements',
  similar_to: 'Similar to',
  solves: 'Solves',
  documents: 'Documents',
  mentioned_in: 'Mentioned in',
  generated_from: 'Generated from',
  related_to: 'Related to',
};

const fallbackNodeDisplay = (entityType: KnowledgeNodeType, entityId: string): DisplayNode => ({
  displayName: `${NODE_TYPE_LABELS[entityType] || entityType} ${entityId.slice(-8)}`,
  displayType: NODE_TYPE_LABELS[entityType] || entityType,
  displaySubtitle: 'Entity unavailable or deleted',
});

const resolveNodeDisplay = async (
  userId: string,
  entityType: KnowledgeNodeType,
  entityId: string
): Promise<DisplayNode> => {
  try {
    if (!Types.ObjectId.isValid(entityId)) {
      return fallbackNodeDisplay(entityType, entityId);
    }

    const _id = new Types.ObjectId(entityId);

    switch (entityType) {
      case 'codebase': {
        const project = await Project.findOne({ _id, userId }, 'name language framework').lean();
        if (!project) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (project as any).name || 'Untitled project',
          displayType: 'Codebase',
          displaySubtitle: [(project as any).language, (project as any).framework].filter(Boolean).join(' · ') || undefined,
        };
      }
      case 'source_asset': {
        const file = await DBFile.findOne({ _id, userId }, 'path fileName language extension').lean();
        if (!file) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (file as any).fileName || (file as any).path || 'Source file',
          displayType: 'Source asset',
          displaySubtitle: (file as any).path,
          path: (file as any).path,
        };
      }
      case 'logical_entity': {
        const entity = await CodeEntity.findById(_id, 'name type fileId').populate('fileId', 'path fileName').lean();
        if (!entity) return fallbackNodeDisplay(entityType, entityId);
        const fileRef = (entity as any).fileId;
        return {
          displayName: (entity as any).name || 'Code entity',
          displayType: (entity as any).type || 'Logical entity',
          displaySubtitle: fileRef?.path || fileRef?.fileName,
          path: fileRef?.path,
        };
      }
      case 'code_asset': {
        const snippet = await Snippet.findOne({ _id, userId }, 'title language').lean();
        if (!snippet) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (snippet as any).title || 'Code asset',
          displayType: 'Code asset',
          displaySubtitle: (snippet as any).language,
        };
      }
      case 'debugging_lesson': {
        const lesson = await ErrorSolution.findOne({ _id, userId }, 'title errorMessage').lean();
        if (!lesson) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (lesson as any).title || 'Debugging lesson',
          displayType: 'Debugging lesson',
          displaySubtitle: (lesson as any).errorMessage,
        };
      }
      case 'architecture_blueprint': {
        const system = await ReusableSystem.findOne({ _id, userId }, 'name type').lean();
        if (!system) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (system as any).name || 'Architecture blueprint',
          displayType: 'Architecture blueprint',
          displaySubtitle: (system as any).type,
        };
      }
      case 'memory': {
        const memory = await Memory.findOne({ _id, userId }, 'title type scope').lean();
        if (!memory) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (memory as any).title || 'Memory',
          displayType: 'Memory',
          displaySubtitle: [(memory as any).type, (memory as any).scope].filter(Boolean).join(' · ') || undefined,
        };
      }
      case 'chat_session': {
        const session = await ChatSession.findOne({ _id, userId }, 'title projectId').lean();
        if (!session) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (session as any).title || 'Chat session',
          displayType: 'Chat session',
          displaySubtitle: (session as any).projectId ? `Project ${(session as any).projectId.toString().slice(-8)}` : undefined,
        };
      }
      case 'activity': {
        const activity = await Activity.findOne({ _id, userId }, 'action entityType metadata').lean();
        if (!activity) return fallbackNodeDisplay(entityType, entityId);
        return {
          displayName: (activity as any).metadata?.title || (activity as any).metadata?.projectName || (activity as any).action || 'Activity',
          displayType: 'Activity',
          displaySubtitle: (activity as any).entityType,
        };
      }
      default:
        return fallbackNodeDisplay(entityType, entityId);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[KnowledgeGraphController]: display resolution failed safely — ${msg}`);
    return fallbackNodeDisplay(entityType, entityId);
  }
};

const enrichRelationships = async (userId: string, relationships: GraphRelationship[]) => {
  const cache = new Map<string, Promise<DisplayNode>>();
  const getDisplay = (entityType: KnowledgeNodeType, entityId: string) => {
    const key = `${entityType}:${entityId}`;
    if (!cache.has(key)) {
      cache.set(key, resolveNodeDisplay(userId, entityType, entityId));
    }
    return cache.get(key)!;
  };

  return Promise.all(relationships.map(async (relationship) => {
    const [source, target] = await Promise.all([
      getDisplay(relationship.sourceType, relationship.sourceId),
      getDisplay(relationship.targetType, relationship.targetId),
    ]);
    const displayType = RELATIONSHIP_LABELS[relationship.relationshipType] || relationship.relationshipType || 'Related to';

    return {
      ...relationship,
      displayName: `${source.displayName} ${displayType.toLowerCase()} ${target.displayName}`,
      displayType,
      displaySubtitle: `${source.displayType} → ${target.displayType}`,
      sourceDisplayName: source.displayName,
      targetDisplayName: target.displayName,
      sourcePath: source.path,
      targetPath: target.path,
      sourceDisplayType: source.displayType,
      targetDisplayType: target.displayType,
      sourceDisplaySubtitle: source.displaySubtitle,
      targetDisplaySubtitle: target.displaySubtitle,
    };
  }));
};

/**
 * GET /api/knowledge-graph/neighborhood
 *
 * Query params:
 *   entityType   - required
 *   entityId     - required
 *   depth        - optional, 1 or 2 (default 1, hard-capped at 2)
 *   relationshipTypes - optional, comma-separated
 */
export const getNeighborhood = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { entityType, entityId, depth, relationshipTypes } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required.' });
    }

    const safeDepth = Math.min(Math.max(parseInt((depth as string) || '1', 10), 1), 2);
    const rTypes: RelationshipType[] | undefined = relationshipTypes
      ? (relationshipTypes as string).split(',').map((t) => t.trim() as RelationshipType)
      : undefined;

    const neighborhood = await knowledgeGraphService.findNeighborhood({
      userId:     req.user.id,
      entityType: entityType as KnowledgeNodeType,
      entityId:   entityId as string,
      relationshipTypes: rTypes,
      depth:      safeDepth,
      limit:      50,
    });
    const [outgoing, incoming, entityDisplay] = await Promise.all([
      enrichRelationships(req.user.id, neighborhood.outgoing),
      enrichRelationships(req.user.id, neighborhood.incoming),
      resolveNodeDisplay(req.user.id, entityType as KnowledgeNodeType, entityId as string),
    ]);

    return res.status(200).json({
      entityType,
      entityId,
      displayName: entityDisplay.displayName,
      displayType: entityDisplay.displayType,
      displaySubtitle: entityDisplay.displaySubtitle,
      depth: safeDepth,
      outgoing,
      incoming,
      relationships: [...outgoing, ...incoming],
      total: outgoing.length + incoming.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/knowledge-graph/entity/:entityType/:entityId/relationships
 *
 * Returns incoming + outgoing for an entity.
 * Cross-user isolation: userId is always taken from the JWT — never from the query.
 */
export const getEntityRelationships = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { entityType, entityId } = req.params;
    const { relationshipTypes } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required.' });
    }

    const rTypes: RelationshipType[] | undefined = relationshipTypes
      ? (relationshipTypes as string).split(',').map((t) => t.trim() as RelationshipType)
      : undefined;

    const [rawOutgoing, rawIncoming] = await Promise.all([
      knowledgeGraphService.findOutgoing({
        userId:     req.user.id,
        sourceType: entityType as KnowledgeNodeType,
        sourceId:   entityId,
        relationshipTypes: rTypes,
        limit:      50,
      }),
      knowledgeGraphService.findIncoming({
        userId:     req.user.id,
        targetType: entityType as KnowledgeNodeType,
        targetId:   entityId,
        relationshipTypes: rTypes,
        limit:      50,
      }),
    ]);
    const [outgoing, incoming, entityDisplay] = await Promise.all([
      enrichRelationships(req.user.id, rawOutgoing),
      enrichRelationships(req.user.id, rawIncoming),
      resolveNodeDisplay(req.user.id, entityType as KnowledgeNodeType, entityId),
    ]);

    return res.status(200).json({
      entityType,
      entityId,
      displayName: entityDisplay.displayName,
      displayType: entityDisplay.displayType,
      displaySubtitle: entityDisplay.displaySubtitle,
      outgoing,
      incoming,
      total: outgoing.length + incoming.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
