# AI Context Trace Debug Endpoint

The AI Context Trace endpoint lets developers inspect the sanitized context selected by the AI Context Builder for a chat or explain-code request.

It exists to debug why DevVault AI included, skipped, or ranked code context, memory, and Knowledge Graph relationships for a request without exposing full prompts or code contents.

Use it locally when:

- Chat or explain-code answers seem to miss relevant project context.
- Knowledge Graph relationships are expected but not appearing in AI context.
- Developer memory is expected but not selected.
- You need counts and labels for selected context sources while debugging backend behavior.

## Safety

This endpoint is for backend debugging only.

- It is disabled in production unless `AI_DEBUG_CONTEXT_TRACE=true` is explicitly set.
- Never expose it publicly.
- It requires normal authenticated API access.
- It returns sanitized metadata only.
- It must not be used to inspect another user's project or file context.
- It does not return full code contents, raw prompts, access tokens, API keys, passwords, or environment values.

## Environment

For local debugging, enable:

```bash
AI_DEBUG_CONTEXT_TRACE=true
```

The endpoint is still authenticated. Use your normal local authenticated API client or browser session.

## Endpoint

```http
POST /api/ai/debug/context-trace
```

## Chat Mode

```json
{
  "mode": "chat",
  "projectId": "PROJECT_ID",
  "message": "How does auth flow work?"
}
```

## Explain Mode

```json
{
  "mode": "explain",
  "projectId": "PROJECT_ID",
  "fileId": "FILE_ID",
  "message": "Explain this file"
}
```

## Sample Response Shape

The response includes safe metadata only:

```json
{
  "mode": "chat",
  "contextSummary": "Context includes: 3 code chunk(s), 2 developer memory record(s), 4 knowledge graph relationship(s).",
  "counts": {
    "codeChunks": 3,
    "searchResults": 2,
    "snippets": 1,
    "debuggingLessons": 0,
    "architectureBlueprints": 0,
    "memory": 2,
    "relationships": 4,
    "conversationMessages": 0
  },
  "selectedRelationships": [
    {
      "relationshipType": "imports",
      "sourceDisplayName": "auth.controller.ts",
      "targetDisplayName": "auth.service.ts",
      "sourcePath": "backend/src/controllers/auth.controller.ts",
      "targetPath": "backend/src/services/auth.service.ts",
      "confidence": 0.8,
      "evidenceReason": "Import path matched a known source file."
    }
  ],
  "selectedMemory": [
    {
      "type": "architecture_rule",
      "scope": "project",
      "title": "Auth flow convention",
      "confidence": 0.9
    }
  ],
  "warnings": []
}
```

Do not expect code contents, raw prompts, memory content, relationship snippets, tokens, passwords, API keys, or `process.env.*` values in this response.

## Troubleshooting

### 403 in Production

The endpoint is disabled in production unless `AI_DEBUG_CONTEXT_TRACE=true` is set. Confirm the environment variable is intentionally enabled for the environment you are debugging.

### 401 Unauthenticated

The endpoint requires an authenticated user. Use the same authenticated local API flow used by the main app.

### 404 Project or File

The project or file must belong to the authenticated user. A missing, deleted, invalid, or unauthorized `projectId` or `fileId` returns 404.

### Empty Relationships

The selected project or file may not have Knowledge Graph relationships yet, or the current request may not match any relevant relationships. Confirm project processing has completed and graph verification passes.

### Empty Memory

No matching developer memory may exist for the user/project, or existing memory may not be relevant to the request. Create safe memory entries through the normal memory flow and try again.
