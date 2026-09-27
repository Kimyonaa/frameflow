# Architecture and decisions

## Request path

React/Vite → Express → session and CSRF middleware → validated domain operation → MongoDB compare-and-swap write → Socket.IO invalidation → client reload.

Production Express serves the Vite build. Development Vite proxies `/api` and `/socket.io` to Express. MongoDB is required; there is no silent volatile-storage fallback.

## Data model

- User: name, optional unique email, scrypt password hash and salt, demo flag.
- Session: SHA-256 hash of a random session token, user ID, CSRF token and expiry. TTL cleanup plus explicit expiry checks.
- FrameWorkspace: owner ID, projects aggregate, and MongoDB revision (`__v`).
- Project inside workspace: brief, requirements, versions, annotations, tasks, proposals and activity.
- Asset: workspace/project ownership, MIME type, bytes, hash and dimensions. Maximum 10 MB.
- Share: hash of a random capability, workspace/project/version IDs and expiry. Revocation deletes it.

Project aggregates keep evidence relationships and approval decisions within one atomic update. Mutations reload and retry on a revision conflict, up to six attempts. IDs are generated before a retry where a returned identity must remain stable. Explicit bounds prevent unbounded growth inside the MongoDB document. Separate large assets avoid approaching MongoDB's document limit through version uploads.

## Traceability rules

1. A pin belongs to an existing version and, optionally, an existing requirement.
2. A linked task points to its originating comment. Creating it twice returns the existing task.
3. A comment cannot be resolved while its linked task is incomplete.
4. Version approval requires no open comments or unfinished linked tasks on that version, plus a current revision number.
5. Adding a comment, reopening feedback or reopening a linked task invalidates previous approval.
6. Each assistant source reference must exist. Proposals remain pending until explicit application; reapplying is a no-op.
7. Shared review links expose only their version. They cannot resolve feedback or modify internal tasks.

A requirement with zero linked tasks is shown as untracked rather than implicitly satisfied. Approval is an explicit reviewer's judgment of a version, not automated proof that every requirement is fulfilled.

## Authentication and boundaries

Random tokens in HttpOnly, SameSite cookies; scrypt passwords; session expiry; CSRF tokens for authenticated writes; origin checks; upload limits and content verification; workspace ownership checks on asset reads and project operations; socket authorization before room joining. Review links use high-entropy capabilities and have a smaller permission surface.

No claims of penetration testing or formal security certification are made. Before public hosting, add operational monitoring, backups, email verification/reset, retention policies and abuse controls appropriate to the deployment.

## Assistant design

The no-key assistant is a deterministic retrieval/extraction baseline. The optional OpenAI adapter uses structured output with evidence IDs and bounds request context. No model is granted tools or authority to mutate the database. The output schema and reference validation restrict structure, not semantic truth. Human review remains required.

This is not vector RAG: local retrieval uses word overlap and the provider receives selected project evidence. A semantic retrieval layer should be added only with retrieval evaluations showing that it improves results over this baseline.

## Scaling decisions

The current aggregate design is straightforward and testable for small studios. Larger projects would benefit from normalized collection boundaries, S3 object storage, background processing, per-project event streams, a worker queue, pagination and access roles beyond owner/client. These are documented future work, not installed-but-unused dependencies.
