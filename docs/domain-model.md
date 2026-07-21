# DEVVAULT AI: DOMAIN TERMINOLOGY & ARCHITECTURE MAPPING

> [!WARNING]
> **SAFETY & CLEANUP WARNINGS:**
> * Legacy database collections and Mongoose models remain completely unchanged.
> * New terminology terms are domain aliases only.
> * **NO DESTRUCTIVE RENAMING** of files, collections, databases, or variables is allowed at this phase.

This document registers the transition from system database schemas to domain-driven business entities.

## 1. Domain Vocabulary Mapping

| Old Database / UI Concept | New Business Domain Concept | Rationale for Terminology Transition |
| :--- | :--- | :--- |
| **Project** | **Codebase** | "Project" is a generic team tracker term. "Codebase" accurately represents the engineering asset being indexed, scanned, and stored. |
| **File** | **SourceAsset** | "File" is a disk storage format. "SourceAsset" highlights its status as an analyzed developer asset. |
| **CodeEntity** | **LogicalEntity** | "CodeEntity" is a technical label. "LogicalEntity" correctly identifies functional modules, routers, or classes. |
| **Snippet** | **CodeAsset** | "Snippet" implies minor helper fragments. "CodeAsset" represents reusable coding properties. |
| **ErrorSolution** | **DebuggingLesson** | "ErrorSolution" sounds like a singular fix. "DebuggingLesson" captures the root causes and resolved diffs. |
| **ReusableSystem** | **ArchitectureBlueprint** | "ReusableSystem" is confusing. "ArchitectureBlueprint" identifies scalable templates, configuration setups, and dependencies. |
| **DeveloperDNA** | **StylisticProfile** | "DeveloperDNA" is a metaphorical scoring metric. "StylisticProfile" defines coding style and naming formats. |
| **Subscription** | **License** | "Subscription" relates to credit cards and billing pipelines. "License" governs usage caps, storage boundaries, and active quotas. |
| **Activity** | **AuditEvent** | "Activity" represents general interactions. "AuditEvent" represents chronological audit actions. |
| **Notification** | **Alert** | "Notification" represents standard status logs. "Alert" represents notifications that require developer attention. |

---

## 2. Backward Compatibility Guardrails

1. **Database Schema Preservation:**
   * **DO NOT RENAME DATABASE COLLECTIONS YET.** The mongoose models (`Project`, `File`, `CodeEntity`, `Snippet`, `ErrorSolution`, `ReusableSystem`, `Workspace`, `Subscription`, `Activity`, `Notification`, `User`) must keep their original filenames and schema collection names in this phase to prevent data corruption.
   * Use the global Express API response decorator `decorateObject` in `backend/src/utils/domain-mapper.ts` to append `domainType` fields to responses dynamically.

2. **API Endpoint Dual Support:**
   * Traditional `/api/projects/*` endpoint routers remain fully supported.
   * New alias routes `/api/codebases/*` are mounted on the same router handler, ensuring that both client requests resolve identically.

3. **UI Localization Labels:**
   * User interface strings are aligned inside the central `LanguageContext.tsx` translation dictionary.
   * If a label change would create usability issues, add subtitle tags to preserve clarity.

---

## 3. Rules for Future Development

1. **Creating new models:** Add a matching mapping entry in `backend/src/utils/domain-mapper.ts` to automatically attach a `domainType` property when returning documents.
2. **Writing API controllers:** Use the legacy mongoose schemas inside backend code, but reference new domain terms in client docs, user-facing markdown templates, and response metadata.
3. **Frontend routes:** Any new frontend components should refer to Codebases, Code Assets, and Debugging Lessons.
