/**
 * Knowledge Graph Service
 *
 * Manages directed, typed relationships between DevVault domain entities
 * stored in MongoDB only. No external graph databases required.
 *
 * Design principles:
 * - All public methods are safe — never throw. Failures return [] or false.
 * - Depth traversal is hard-capped (default 1, max 2) to prevent unbounded queries.
 * - Deduplication via compound unique index + upsert (updateOne with $setOnInsert).
 * - Graph building failures must NEVER break project indexing.
 * - No write is ever required for reads to work.
 */

import path from 'path';
import { Types } from 'mongoose';
import {
  KnowledgeRelationship,
  KnowledgeNodeType,
  RelationshipType,
  IRelationshipEvidence,
} from '../models/KnowledgeRelationship';
import { CodeEntity, File as DBFile, Project } from '../models';

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface CreateRelationshipInput {
  userId: string;
  workspaceId?: string;
  projectId?: string;
  sourceType: KnowledgeNodeType;
  sourceId: string;
  targetType: KnowledgeNodeType;
  targetId: string;
  relationshipType: RelationshipType;
  confidence?: number;
  evidence?: IRelationshipEvidence;
  metadata?: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  sourceType: KnowledgeNodeType;
  sourceId: string;
  targetType: KnowledgeNodeType;
  targetId: string;
  relationshipType: RelationshipType;
  confidence: number;
  evidence?: IRelationshipEvidence;
  metadata?: Record<string, any>;
}

// ─── Hard caps ────────────────────────────────────────────────────────────────
const MAX_DEPTH          = 2;
const DEFAULT_DEPTH      = 1;
const MAX_PER_NODE       = 50;   // max relationships per entity per direction
const MAX_NEIGHBORHOOD   = 200;  // max total results for neighborhood queries
const MAX_BATCH_UPSERT   = 500;  // max relationships to upsert in one batch

// ─── Service ──────────────────────────────────────────────────────────────────

class KnowledgeGraphService {

  /**
   * Creates or reactivates a single relationship (upsert; no duplicates).
   * Safe: never throws. Returns the relationship or null on failure.
   */
  async createRelationship(input: CreateRelationshipInput): Promise<GraphRelationship | null> {
    try {
      const filter = {
        userId:           new Types.ObjectId(input.userId),
        sourceType:       input.sourceType,
        sourceId:         new Types.ObjectId(input.sourceId),
        targetType:       input.targetType,
        targetId:         new Types.ObjectId(input.targetId),
        relationshipType: input.relationshipType,
      };

      const setOnInsert: any = {
        ...filter,
      };

      const set: any = {
        confidence:  input.confidence ?? 0.7,
        isActive:    true,
      };
      if (input.workspaceId) set.workspaceId = new Types.ObjectId(input.workspaceId);
      if (input.projectId)   set.projectId   = new Types.ObjectId(input.projectId);
      if (input.evidence)    set.evidence    = input.evidence;
      if (input.metadata)    set.metadata    = input.metadata;

      const result = await KnowledgeRelationship.findOneAndUpdate(
        filter,
        { $setOnInsert: setOnInsert, $set: set },
        { upsert: true, new: true, lean: true }
      ) as any;

      if (!result) return null;

      return {
        id:               result._id.toString(),
        sourceType:       result.sourceType,
        sourceId:         result.sourceId.toString(),
        targetType:       result.targetType,
        targetId:         result.targetId.toString(),
        relationshipType: result.relationshipType,
        confidence:       result.confidence,
        evidence:         result.evidence,
        metadata:         result.metadata,
      };
    } catch (err) {
      // Duplicate key error is expected for upserts — silently ignore
      if ((err as any).code === 11000) return null;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[KnowledgeGraphService]: createRelationship failed — ${msg}`);
      return null;
    }
  }

  /**
   * Batch upsert of multiple relationships.
   * Processes in chunks to avoid memory pressure. Safe: never throws.
   * Returns count of successfully upserted relationships.
   */
  async createRelationships(inputs: CreateRelationshipInput[]): Promise<number> {
    if (!inputs || inputs.length === 0) return 0;

    let created = 0;
    // Cap batch size
    const safeBatch = inputs.slice(0, MAX_BATCH_UPSERT);

    for (const input of safeBatch) {
      try {
        const result = await this.createRelationship(input);
        if (result) created++;
      } catch {
        // Individual failure is swallowed — batch continues
      }
    }
    return created;
  }

  /**
   * Fetches outgoing relationships from a source entity.
   * Safe: never throws, returns [] on failure.
   */
  async findOutgoing(options: {
    userId: string;
    sourceType: KnowledgeNodeType;
    sourceId: string;
    relationshipTypes?: RelationshipType[];
    limit?: number;
  }): Promise<GraphRelationship[]> {
    try {
      const { userId, sourceType, sourceId, relationshipTypes, limit = MAX_PER_NODE } = options;
      const safeLimit = Math.min(limit, MAX_PER_NODE);

      const filter: any = {
        userId:    new Types.ObjectId(userId),
        sourceType,
        sourceId:  new Types.ObjectId(sourceId),
        isActive:  true,
      };
      if (relationshipTypes && relationshipTypes.length > 0) {
        filter.relationshipType = { $in: relationshipTypes };
      }

      const docs = await KnowledgeRelationship
        .find(filter, 'sourceType sourceId targetType targetId relationshipType confidence evidence metadata')
        .limit(safeLimit)
        .lean();

      return docs.map((d: any) => this.toGraphRelationship(d));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[KnowledgeGraphService]: findOutgoing failed — ${msg}`);
      return [];
    }
  }

  /**
   * Fetches incoming relationships to a target entity.
   * Safe: never throws, returns [] on failure.
   */
  async findIncoming(options: {
    userId: string;
    targetType: KnowledgeNodeType;
    targetId: string;
    relationshipTypes?: RelationshipType[];
    limit?: number;
  }): Promise<GraphRelationship[]> {
    try {
      const { userId, targetType, targetId, relationshipTypes, limit = MAX_PER_NODE } = options;
      const safeLimit = Math.min(limit, MAX_PER_NODE);

      const filter: any = {
        userId:    new Types.ObjectId(userId),
        targetType,
        targetId:  new Types.ObjectId(targetId),
        isActive:  true,
      };
      if (relationshipTypes && relationshipTypes.length > 0) {
        filter.relationshipType = { $in: relationshipTypes };
      }

      const docs = await KnowledgeRelationship
        .find(filter, 'sourceType sourceId targetType targetId relationshipType confidence evidence metadata')
        .limit(safeLimit)
        .lean();

      return docs.map((d: any) => this.toGraphRelationship(d));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[KnowledgeGraphService]: findIncoming failed — ${msg}`);
      return [];
    }
  }

  /**
   * Returns the direct neighborhood (outgoing + incoming) of a given entity.
   * Depth 1 (default) = direct edges only.
   * Depth 2 = direct edges + one hop further from direct neighbors.
   * Depth is hard-capped at MAX_DEPTH=2. No unbounded traversal.
   *
   * Safe: never throws, returns { outgoing: [], incoming: [] } on failure.
   */
  async findNeighborhood(options: {
    userId: string;
    entityType: KnowledgeNodeType;
    entityId: string;
    relationshipTypes?: RelationshipType[];
    depth?: number;
    limit?: number;
  }): Promise<{ outgoing: GraphRelationship[]; incoming: GraphRelationship[] }> {
    try {
      const {
        userId,
        entityType,
        entityId,
        relationshipTypes,
        depth  = DEFAULT_DEPTH,
        limit  = MAX_PER_NODE,
      } = options;

      // Hard cap depth
      const safeDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
      const safeLimit = Math.min(limit, MAX_NEIGHBORHOOD);

      // Level 1 — direct neighbors
      const [outgoing, incoming] = await Promise.all([
        this.findOutgoing({ userId, sourceType: entityType, sourceId: entityId, relationshipTypes, limit: safeLimit }),
        this.findIncoming({ userId, targetType: entityType, targetId: entityId, relationshipTypes, limit: safeLimit }),
      ]);

      if (safeDepth < 2) {
        return { outgoing, incoming };
      }

      // Level 2 — neighbors of neighbors (capped)
      const level2Outgoing: GraphRelationship[] = [];
      const level2Incoming: GraphRelationship[] = [];

      const remainingLimit = Math.max(0, safeLimit - outgoing.length - incoming.length);
      if (remainingLimit === 0) return { outgoing, incoming };

      // Expand neighbors one hop further, with small per-neighbor caps.
      const outNeighborIds = outgoing.slice(0, 5).map(r => ({ type: r.targetType, id: r.targetId }));
      for (const neighbor of outNeighborIds) {
        const hop = await this.findOutgoing({
          userId,
          sourceType: neighbor.type,
          sourceId:   neighbor.id,
          relationshipTypes,
          limit: Math.min(5, remainingLimit),
        });
        level2Outgoing.push(...hop);
        if (level2Outgoing.length >= remainingLimit) break;
      }

      const inNeighborIds = incoming.slice(0, 5).map(r => ({ type: r.sourceType, id: r.sourceId }));
      for (const neighbor of inNeighborIds) {
        const hop = await this.findIncoming({
          userId,
          targetType: neighbor.type,
          targetId:   neighbor.id,
          relationshipTypes,
          limit: Math.min(5, remainingLimit),
        });
        level2Incoming.push(...hop);
        if (level2Outgoing.length + level2Incoming.length >= remainingLimit) break;
      }

      return {
        outgoing: this.dedupeRelationships([...outgoing, ...level2Outgoing]).slice(0, safeLimit),
        incoming: this.dedupeRelationships([...incoming, ...level2Incoming]).slice(0, safeLimit),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[KnowledgeGraphService]: findNeighborhood failed — ${msg}`);
      return { outgoing: [], incoming: [] };
    }
  }

  /**
   * Soft-deletes all relationships for a given project.
   * Used before re-indexing a project to avoid stale edges.
   * Safe: never throws.
   */
  async deactivateRelationshipsForProject(projectId: string): Promise<void> {
    try {
      await KnowledgeRelationship.updateMany(
        { projectId: new Types.ObjectId(projectId) },
        { $set: { isActive: false } }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[KnowledgeGraphService]: deactivateRelationshipsForProject failed — ${msg}`);
    }
  }

  /**
   * Builds the knowledge graph for all files and entities in a project.
   *
   * Relationships created:
   *   - codebase  --[contains]-->  source_asset    (project contains file)
   *   - source_asset --[defines]-->  logical_entity  (file defines code entity)
   *   - source_asset --[imports]-->  source_asset    (import path resolution)
   *   - logical_entity --[depends_on]--> logical_entity (dependency names matched)
   *
   * This method is designed to be called fire-and-forget from project processing.
   * Any failure is caught, logged, and swallowed. Project processing continues.
   *
   * Safe: never throws.
   */
  async buildRelationshipsForProject(projectId: string): Promise<void> {
    try {
      const project = await Project.findById(projectId, 'userId workspaceId _id').lean();
      if (!project) {
        console.warn(`[KnowledgeGraphService]: buildRelationshipsForProject — project not found: ${projectId}`);
        return;
      }
      const userId = (project as any).userId.toString();
      const workspaceId = (project as any).workspaceId?.toString();

      // Deactivate stale relationships first
      await this.deactivateRelationshipsForProject(projectId);

      // Load all files for this project (path only for import resolution)
      const files = await DBFile.find(
        { projectId: new Types.ObjectId(projectId) },
        '_id path content userId'
      ).lean();

      if (!files || files.length === 0) return;

      // Build a path → fileId lookup for import resolution
      const pathToFileId: Map<string, string> = new Map();
      for (const f of files) {
        pathToFileId.set(this.normalizePath((f as any).path), (f as any)._id.toString());
      }

      const resolveImport = (fromPath: string, importPath: string): string | undefined => {
        return this.resolveRelativeImport(fromPath, importPath, pathToFileId);
      };

      const relationshipsToCreate: CreateRelationshipInput[] = [];

      for (const file of files) {
        const fileId   = (file as any)._id.toString();
        const filePath = (file as any).path as string;

        // ── codebase --[contains]--> source_asset ────────────────────────────
        relationshipsToCreate.push({
          userId,
          workspaceId,
          projectId,
          sourceType:       'codebase',
          sourceId:         projectId,            // use projectId as the codebase node
          targetType:       'source_asset',
          targetId:         fileId,
          relationshipType: 'contains',
          confidence:       1.0,
          evidence: { reason: 'File is part of this project/codebase.' },
        });

        // ── source_asset --[imports]--> source_asset (lightweight path match) ─
        // We resolve import paths by checking if any known file path ends with
        // the import segment. This is heuristic and safe to fail silently.
        const fileContent = (file as any).content as string | undefined;
        if (fileContent) {
          const importMatches = fileContent.match(
            /(?:import\s+[^'"]*from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g
          ) || [];

          for (const importStatement of importMatches.slice(0, 20)) {
            // Extract the path from the import statement
            const pathMatch = importStatement.match(/['"]([^'"]+)['"]/);
            if (!pathMatch) continue;
            const importedPath = pathMatch[1];

            // Only resolve relative imports
            if (!importedPath.startsWith('.')) continue;

            const resolvedId = resolveImport(filePath, importedPath);

            if (resolvedId && resolvedId !== fileId) {
              relationshipsToCreate.push({
                userId,
                workspaceId,
                projectId,
                sourceType:       'source_asset',
                sourceId:         fileId,
                targetType:       'source_asset',
                targetId:         resolvedId,
                relationshipType: 'imports',
                confidence:       0.8,
                evidence: { filePath, snippet: importStatement.substring(0, 200) },
              });
            }
          }
        }
      }

      // Load all code entities for this project
      const entities = await CodeEntity.find(
        { projectId: new Types.ObjectId(projectId) },
        '_id fileId name type code startLine dependencies metadata'
      ).lean();

      // Build entity name → id map for dependency resolution
      const nameToEntityId: Map<string, string> = new Map();
      const fileIdToEntities: Map<string, any[]> = new Map();
      for (const e of entities) {
        nameToEntityId.set((e as any).name, (e as any)._id.toString());
        const entityFileId = (e as any).fileId?.toString();
        if (entityFileId) {
          const current = fileIdToEntities.get(entityFileId) || [];
          current.push(e);
          fileIdToEntities.set(entityFileId, current);
        }
      }

      for (const entity of entities) {
        const entityId = (entity as any)._id.toString();
        const fileId   = (entity as any).fileId.toString();
        const metadata = ((entity as any).metadata || {}) as Record<string, any>;

        // ── source_asset --[defines]--> logical_entity ────────────────────────
        if (fileId) {
          relationshipsToCreate.push({
            userId,
            workspaceId,
            projectId,
            sourceType:       'source_asset',
            sourceId:         fileId,
            targetType:       'logical_entity',
            targetId:         entityId,
            relationshipType: 'defines',
            confidence:       1.0,
            evidence: { reason: 'File contains this entity definition.' },
          });
        }

        // ── source_asset --[exports]--> logical_entity ───────────────────────
        if (metadata.exported === true) {
          relationshipsToCreate.push({
            userId,
            workspaceId,
            projectId,
            sourceType:       'source_asset',
            sourceId:         fileId,
            targetType:       'logical_entity',
            targetId:         entityId,
            relationshipType: 'exports',
            confidence:       0.9,
            evidence: {
              sourceLine: (entity as any).startLine,
              reason: 'Parser metadata marked this entity as exported.',
            },
          });
        }

        // ── logical_entity --[depends_on]--> logical_entity ───────────────────
        // Match dependency strings against known entity names (heuristic)
        const deps: string[] = (entity as any).dependencies || [];
        for (const dep of deps.slice(0, 10)) {
          const depEntityId = nameToEntityId.get(dep);
          if (depEntityId && depEntityId !== entityId) {
            relationshipsToCreate.push({
              userId,
              workspaceId,
              projectId,
              sourceType:       'logical_entity',
              sourceId:         entityId,
              targetType:       'logical_entity',
              targetId:         depEntityId,
              relationshipType: 'depends_on',
              confidence:       0.75,
              evidence: { reason: `Dependency name '${dep}' matched a known entity.` },
            });
            continue;
          }

          if (dep.startsWith('.') && fileId) {
            const sourceFile = files.find((f: any) => f._id.toString() === fileId) as any;
            const targetFileId = sourceFile ? resolveImport(sourceFile.path, dep) : undefined;
            if (targetFileId && targetFileId !== fileId) {
              relationshipsToCreate.push({
                userId,
                workspaceId,
                projectId,
                sourceType:       'logical_entity',
                sourceId:         entityId,
                targetType:       'source_asset',
                targetId:         targetFileId,
                relationshipType: 'imports',
                confidence:       0.7,
                evidence: { reason: `Entity imports relative dependency '${dep}'.` },
              });
            }
          }
        }

        // ── logical_entity --[calls]--> logical_entity ───────────────────────
        // For route entities, detect a handler identifier in route arguments and
        // link it if that handler exists as another extracted entity.
        if ((entity as any).type === 'route') {
          const handlerNames = this.extractRouteHandlerNames((entity as any).code || '');
          for (const handlerName of handlerNames) {
            const handlerEntityId = nameToEntityId.get(handlerName);
            if (handlerEntityId && handlerEntityId !== entityId) {
              relationshipsToCreate.push({
                userId,
                workspaceId,
                projectId,
                sourceType:       'logical_entity',
                sourceId:         entityId,
                targetType:       'logical_entity',
                targetId:         handlerEntityId,
                relationshipType: 'calls',
                confidence:       0.75,
                evidence: {
                  sourceLine: (entity as any).startLine,
                  reason: `Route metadata references handler '${handlerName}'.`,
                },
              });
            }
          }
        }

        // ── logical_entity --[imports]--> logical_entity ─────────────────────
        // If this entity imports another source file, link to exported entities
        // in the target source file when available.
        const imports: string[] = Array.isArray(metadata.imports) ? metadata.imports : [];
        const sourceFile = files.find((f: any) => f._id.toString() === fileId) as any;
        for (const importedPath of imports.slice(0, 10)) {
          if (!sourceFile || !importedPath.startsWith('.')) continue;
          const targetFileId = resolveImport(sourceFile.path, importedPath);
          if (!targetFileId) continue;

          const importedEntities = fileIdToEntities.get(targetFileId) || [];
          const exportedEntities = importedEntities.filter((target: any) => target.metadata?.exported === true);
          for (const targetEntity of exportedEntities.slice(0, 5)) {
            const targetEntityId = targetEntity._id.toString();
            if (targetEntityId === entityId) continue;
            relationshipsToCreate.push({
              userId,
              workspaceId,
              projectId,
              sourceType:       'logical_entity',
              sourceId:         entityId,
              targetType:       'logical_entity',
              targetId:         targetEntityId,
              relationshipType: 'imports',
              confidence:       0.7,
              evidence: { reason: `Entity imports source file '${importedPath}' with exported entities.` },
            });
          }
        }
      }

      // Batch upsert all relationships
      const created = await this.createRelationships(relationshipsToCreate);
      console.log(`[KnowledgeGraphService]: Built ${created} relationships for project ${projectId}.`);
    } catch (err) {
      // CRITICAL: must not throw — project processing must continue
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[KnowledgeGraphService]: buildRelationshipsForProject failed safely — ${msg}`);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private toGraphRelationship(d: any): GraphRelationship {
    return {
      id:               d._id.toString(),
      sourceType:       d.sourceType,
      sourceId:         d.sourceId.toString(),
      targetType:       d.targetType,
      targetId:         d.targetId.toString(),
      relationshipType: d.relationshipType,
      confidence:       d.confidence,
      evidence:         d.evidence,
      metadata:         d.metadata,
    };
  }

  private dedupeRelationships(relationships: GraphRelationship[]): GraphRelationship[] {
    const seen = new Set<string>();
    const deduped: GraphRelationship[] = [];
    for (const relationship of relationships) {
      const key = [
        relationship.sourceType,
        relationship.sourceId,
        relationship.targetType,
        relationship.targetId,
        relationship.relationshipType,
      ].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(relationship);
    }
    return deduped;
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private resolveRelativeImport(
    fromFilePath: string,
    importPath: string,
    pathToFileId: Map<string, string>
  ): string | undefined {
    const normalizedFrom = this.normalizePath(fromFilePath);
    const normalizedImport = importPath.replace(/\\/g, '/');
    const fromDir = path.posix.dirname(normalizedFrom);
    const base = this.normalizePath(path.posix.normalize(path.posix.join(fromDir, normalizedImport)));

    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.json`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
      `${base}/index.js`,
      `${base}/index.jsx`,
    ];

    for (const candidate of candidates) {
      const match = pathToFileId.get(candidate);
      if (match) return match;
    }

    return undefined;
  }

  private extractRouteHandlerNames(code: string): string[] {
    const handlerNames = new Set<string>();
    const routeCall = code.match(/\.(?:get|post|put|delete|patch)\s*\(([\s\S]*)\)/);
    if (!routeCall) return [];

    const args = routeCall[1].split(',');
    for (const arg of args.slice(1)) {
      const trimmed = arg.trim();
      const identifierMatch = trimmed.match(/^([A-Za-z_$][\w$]*)\b/);
      if (identifierMatch) handlerNames.add(identifierMatch[1]);
    }

    return Array.from(handlerNames).slice(0, 5);
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
