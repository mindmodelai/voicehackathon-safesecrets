---
inclusion: auto
---

# Git Branching Workflow for Spec Tasks

When executing tasks from `.kiro/specs/valentines-voice-ai/tasks.md`, follow this git workflow for every top-level task (e.g., Task 1, Task 2, etc.):

## Before Starting a Task

1. Ensure you are on `main` and it is up to date:
   ```
   git checkout main
   git pull origin main
   ```

2. Create a feature branch named after the task using kebab-case:
   - Task 1 → `task/1-project-scaffolding-and-shared-types`
   - Task 2 → `task/2-avatar-state-machine`
   - Task 3 → `task/3-checkpoint-ensure-tests-pass`
   - Task 4 → `task/4-backend-aws-adapters`
   - Task 5 → `task/5-custom-mastra-voice-provider-and-workflow`
   - Task 6 → `task/6-checkpoint-ensure-tests-pass`
   - Task 7 → `task/7-websocket-server`
   - Task 8 → `task/8-frontend-artifact-panel`
   - Task 9 → `task/9-frontend-avatar-and-main-layout`
   - Task 10 → `task/10-integration-and-wiring`
   - Task 11 → `task/11-final-checkpoint`

3. Commit sub-task work incrementally on the feature branch as you go.

## After Completing a Task

1. Commit all remaining changes on the feature branch and push:
   ```
   git add -A
   git commit -m "Task N: <task title>"
   git push origin <branch-name>
   ```

2. Switch to main, merge the feature branch (no fast-forward to preserve the merge commit for history), and push:
   ```
   git checkout main
   git merge --no-ff <branch-name> -m "Merge task/N-<name>: <task title>"
   git push origin main
   ```

3. Delete the feature branch locally and remotely:
   ```
   git branch -d <branch-name>
   git push origin --delete <branch-name>
   ```

This creates a merge commit on main for each task, giving you clear versioning history in `git log --oneline --graph`.

## Important Rules

- Never work directly on `main` during task execution.
- Each top-level task gets exactly one branch and one PR.
- Sub-tasks within a top-level task are committed on the same branch.
- Checkpoint tasks (3, 6, 11) still get their own branch — commit any test fixes there.
- If a merge fails for any reason, stop and ask the user before proceeding.
