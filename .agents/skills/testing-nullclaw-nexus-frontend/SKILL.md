# Testing NullClaw Nexus Frontend

## Overview
NullClaw Nexus is a SvelteKit frontend for the NullClaw AI gateway. It uses Svelte 5 runes, SvelteFlow for the swarm canvas, and localStorage for persistence.

## Dev Server Setup
```bash
cd /home/ubuntu/repos/nullclaw-nexus
npm run dev -- --host 0.0.0.0 --port 5173
```
Note: Port 5173 may be in use; Vite will auto-increment (5174, 5175, etc). Check the terminal output for the actual port.

## Navigation Paths
All pages are accessible from the home page at `/`:
- **Chat**: `/chat` — click the "Chat" card on home page
- **Memory**: `/memory` — click the "Memory" card on home page  
- **Swarm**: `/swarm` — click the "Swarm" card on home page
- **Settings**: `/settings` — click the "Settings" card on home page

## Testing Without a Gateway
Many features work without the NullClaw gateway running:
- Memory toggles (active/inactive) and localStorage persistence
- Swarm canvas node creation, editing, deletion
- Agent Library click-to-add
- Swarm Deploy (falls back to JSON download)
- Swarm Run (shows execution log with "Failed to fetch" for agent nodes, but UI flow works)

Features that require a running gateway:
- Chat message sending and streaming responses
- Swarm Run with actual LLM responses
- Memory injection visible in chat responses

## Adding Test Data via Console
Memories can be seeded via browser console since the drag-drop upload is hard to automate:
```javascript
localStorage.setItem('nullclaw_memories', JSON.stringify([
  { id: 'test-1', name: 'Test Knowledge', content: 'Some test content here.', type: 'knowledge', size: 30, createdAt: new Date().toISOString(), active: false },
  { id: 'test-2', name: 'System Prompt', content: 'You are a helpful assistant.', type: 'prompt', size: 28, createdAt: new Date().toISOString(), active: false }
]));
location.reload();
```

## Key localStorage Keys
- `nullclaw_memories` — Memory store (array of Memory objects with `active` boolean)
- `swarm_nodes` — Swarm canvas nodes
- `swarm_edges` — Swarm canvas edges
- `gatewayConfig` — Gateway connection settings

## Browser Automation Limitations
- **SvelteFlow double-click**: The `on:nodedoubleclick` event in SvelteFlow cannot be triggered via browser automation tools (sequential clicks or DOM `dblclick` events don't fire SvelteFlow's internal event). This feature requires manual testing.
- **File drag-drop**: The memory page upload zone requires actual file drag-drop which is difficult to automate. Use console injection instead.
- **Blob downloads**: Deploy fallback triggers a blob URL download that may not be captured by automation tools, but the toast message confirms it worked.

## Lint/Type Check
The project does not have a `lint` npm script. Use:
```bash
npm run check
```
This runs `svelte-check`. Pre-existing warnings (a11y, deprecated `on:click` in Svelte 5) are expected and unrelated to new changes.

## Svelte 5 Gotchas
- `{@const}` tags must be inside block tags (`{#if}`, `{#each}`, etc.), not directly inside HTML elements like `<header>`
- The project uses `runes: true` in svelte.config.js — use `$state()`, `$derived()` etc.
- Some pages (swarm) use legacy `on:click` syntax which generates deprecation warnings but still works

## Devin Secrets Needed
No secrets are needed for basic frontend testing. For full end-to-end testing with actual LLM responses, the NullClaw gateway must be running locally on port 3000 with Ollama or a cloud provider configured.
