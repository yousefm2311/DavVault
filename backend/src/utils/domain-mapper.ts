/**
 * Domain Terminology Mapping and Decorator Layer
 * Aligning legacy implementation objects with final business domain concepts.
 */

export const domainVocabulary = {
  Project: 'Codebase',
  File: 'SourceAsset',
  CodeEntity: 'LogicalEntity',
  Snippet: 'CodeAsset',
  ErrorSolution: 'DebuggingLesson',
  ReusableSystem: 'ArchitectureBlueprint',
  DeveloperDNA: 'StylisticProfile',
  Subscription: 'License',
  Activity: 'AuditEvent',
  Notification: 'Alert'
};

export const domainTypeMap = {
  codebase: 'codebase',
  source_asset: 'source_asset',
  logical_entity: 'logical_entity',
  code_asset: 'code_asset',
  debugging_lesson: 'debugging_lesson',
  architecture_blueprint: 'architecture_blueprint',
  stylistic_profile: 'stylistic_profile',
  license: 'license',
  audit_event: 'audit_event',
  alert: 'alert'
};

function objectIdBufferToHex(value: any): string | undefined {
  if (!value || typeof value !== 'object' || !('buffer' in value)) return undefined;

  const buffer = value.buffer;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer) && buffer.length === 12) {
    return buffer.toString('hex');
  }

  if (buffer && typeof buffer === 'object') {
    const bytes = Array.from({ length: 12 }, (_, index) => buffer[String(index)]);
    if (bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      return Buffer.from(bytes as number[]).toString('hex');
    }
  }

  return undefined;
}

function normalizeObjectIdLike(value: any): string | undefined {
  if (!value || typeof value !== 'object') return undefined;

  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }

  if (value._bsontype === 'ObjectId' && typeof value.toString === 'function') {
    return value.toString();
  }

  return objectIdBufferToHex(value);
}

/**
 * Recursively scans and decorates JSON response objects with non-breaking domainType fields.
 * Handles both Mongoose documents and plain objects from .lean() queries.
 */
export function decorateObject(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  const objectId = normalizeObjectIdLike(obj);
  if (objectId) {
    return objectId;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) {
    return obj.toString('base64');
  }

  if (Array.isArray(obj)) {
    return obj.map(item => decorateObject(item));
  }

  // If it's a Mongoose document, convert to plain JSON
  let plain: any;
  if (typeof obj.toObject === 'function') {
    plain = obj.toObject({ virtuals: true });
  } else {
    // Clone properties to avoid mutating original caches
    plain = { ...obj };
  }

  // Detect entity type based on structural properties and apply domainType
  if (plain._id || plain.id) {
    if (plain.healthScore !== undefined || (plain.name !== undefined && plain.userId !== undefined && plain.processingStatus !== undefined)) {
      plain.domainType = domainTypeMap.codebase;
    } else if (plain.path !== undefined && plain.extension !== undefined && plain.size !== undefined) {
      plain.domainType = domainTypeMap.source_asset;
    } else if (plain.startLine !== undefined && plain.endLine !== undefined && plain.code !== undefined && plain.type !== undefined) {
      plain.domainType = domainTypeMap.logical_entity;
    } else if (plain.code !== undefined && plain.language !== undefined && plain.title !== undefined && plain.tags !== undefined) {
      plain.domainType = domainTypeMap.code_asset;
    } else if (plain.errorMessage !== undefined && plain.cause !== undefined && plain.solution !== undefined && plain.solvedAt !== undefined) {
      plain.domainType = domainTypeMap.debugging_lesson;
    } else if (plain.setupSteps !== undefined && plain.flow !== undefined && plain.relatedFiles !== undefined) {
      plain.domainType = domainTypeMap.architecture_blueprint;
    } else if (plain.plan !== undefined && plain.limits !== undefined && plain.usage !== undefined) {
      plain.domainType = domainTypeMap.license;
    } else if (plain.action !== undefined && plain.entityType !== undefined && plain.userId !== undefined) {
      plain.domainType = domainTypeMap.audit_event;
    } else if (plain.title !== undefined && plain.message !== undefined && plain.isRead !== undefined && plain.type !== undefined) {
      plain.domainType = domainTypeMap.alert;
    } else if (plain.linesOfCode !== undefined && plain.namingStyle !== undefined && plain.frameworks !== undefined) {
      plain.domainType = domainTypeMap.stylistic_profile;
    }
  }

  // Recursively decorate nested child properties
  for (const key of Object.keys(plain)) {
    if (plain[key] && typeof plain[key] === 'object') {
      plain[key] = decorateObject(plain[key]);
    }
  }

  return plain;
}
