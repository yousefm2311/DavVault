# Reusable Library and Memory Scope Semantics

DevVault currently treats reusable source libraries as user-private records:

- Snippets are owned by `userId`. Optional `sourceProjectId` only links the snippet to a project for filtering after project access is validated.
- Error lessons are owned by `userId`. Optional `projectId` only links the lesson to a project for filtering after project access is validated.
- Reusable systems are global user-owned templates. They are not project-owned or workspace-shared.

The current models do not define a visibility field for snippets, error lessons, or reusable systems, so workspace sharing must not be inferred from workspace membership.

Developer Memory supports explicit scopes:

- `user`: readable and manageable only by the owner.
- `project`: readable when the requester has access to the referenced project.
- `workspace`: readable when the requester is a member of the referenced workspace.

Memory update and delete operations remain owner-only.
