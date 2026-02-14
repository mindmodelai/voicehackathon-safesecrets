---
inclusion: auto
---

# Project Organization Rules

## Root Directory

Keep the root directory tidy. Only essential project files belong in root (README.md, package.json, tsconfig.json, .env, .gitignore, etc.).

## Documentation Files

All generated markdown documentation, explanations, guides, notes, and reference files MUST be placed in the `agent-docs/` folder. Never place documentation markdown files in the project root or scattered across source directories.

Examples of files that go in `agent-docs/`:
- Architecture explanations
- Setup guides
- API documentation
- Decision records
- Troubleshooting notes
- Any `.md` file generated during implementation or vibe coding that isn't README.md

## Agent Scripts

All generated helper scripts (`.ps1`, `.sh`, `.bat`, `.cmd`) MUST be placed in the `agent-scripts/` folder. Never place utility or facilitator scripts in the project root.

Examples of files that go in `agent-scripts/`:
- PowerShell scripts (.ps1)
- Shell scripts (.sh)
- Batch files (.bat, .cmd)
- Any automation or helper scripts generated during task execution

## Summary

| File Type | Location |
|---|---|
| Documentation (.md) | `agent-docs/` |
| Helper scripts (.ps1, .sh, .bat) | `agent-scripts/` |
| Source code | `backend/` or `frontend/` |
| Spec files | `.kiro/specs/safesecrets/` |
| Steering files | `.kiro/steering/` |
