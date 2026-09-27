# A three-minute recruiter walkthrough

1. Open the landing page and choose **Explore the live demo**. Explain that it creates a private MongoDB workspace, not a shared global sandbox.
2. In Review, switch between Version 1 and Version 2. Move the comparison slider; the revised design displays the starting price.
3. Add a pinned comment and connect it to a requirement. Create its linked task.
4. Open Tasks. Move the task to In progress, then Done. Follow Evidence back to the exact comment and version.
5. Resolve feedback, approve the version and show the Activity record. Reopen a task to show approval invalidation.
6. Open Assistant. Draft a plan or triage feedback. Inspect citations and edit the proposal before applying it. State clearly whether local mode or a configured model is in use.
7. Upload your own image/PDF. Create a client review link and open it in a private browser session. Demonstrate that only one version is visible.
8. Reload the owner workspace to show persistence.

## Interview discussion points

- Why normalized percentage coordinates keep pins aligned as the canvas resizes.
- Why comments belong to a version instead of moving automatically to a revision.
- How compare-and-swap writes avoid lost updates without a distributed transaction.
- Why unknown evidence IDs are rejected even when model output is structurally valid.
- How guest capability links differ from authenticated owner sessions.
- Why a task completing does not automatically imply client approval.
- Why a local deterministic assistant is clearly labelled, and what an evaluation would need to establish before claiming AI quality improvements.

## Resume wording after reviewing the implementation

Built FrameFlow, a MERN design-review application linking versioned visual feedback to requirements, tasks and client approvals; implemented authenticated workspaces, restricted review links, real-time updates and evidence-cited assistant proposals.

Only add benchmarks or usage metrics after collecting them. Do not claim production customers, reduced review time, or model accuracy from this demo alone.
