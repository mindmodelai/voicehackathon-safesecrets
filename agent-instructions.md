# SafeSecrets — Editable Prompt & Config Files

These are the files that control how the AI agent behaves. Edit them directly to tune personality, prompts, and region config.

## System Instructions (AI Personality)
`backend/src/system-instructions.ts`
The core system prompt sent to Bedrock. Controls the agent's tone, behavior, and JSON output format.

## Prompt Builders (Per-Stage Prompts)
`backend/src/prompt-builders.ts`
Three functions that build the prompt for each conversation stage: COLLECT, COMPOSE, and REFINE.

## Workflow Constants (Region & Config)
`backend/src/workflow-constants.ts`
Default AWS region and other pipeline configuration values.
