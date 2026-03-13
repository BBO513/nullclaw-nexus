# Testing NullClaw Nexus Frontend

## Overview
NullClaw Nexus is a SvelteKit frontend for the NullClaw AI gateway. It uses Svelte 5 runes, SvelteFlow for the swarm canvas, and localStorage for persistence.

## Dev Server Setup
```bash
cd /home/ubuntu/repos/nullclaw-nexus
npm run dev -- --host 0.0.0.0 --port 5173
```
Note: Port 5173 may be in use; Vite will auto-increment (5174, 5175, etc). Check the terminal output for the actual port.

## Gateway Setup (for full end-to-end testing)
```bash
cd /home/ubuntu/repos/nullclaw
NULLCLAW_MASTER_KEY=test123 ./zig-out/bin/nullclaw serve
```
This starts the gateway on port 3000. The master key `test123` is used for Bearer token auth.
If the binary isn't built yet, run `zig build -Dtarget=x86_64-linux-musl` first (requires Zig 0.14.1).

## Navigation Paths
All pages are accessible from the home page at `/`:
- **Chat**: `/chat` — click the "Chat" card on home page
- **Memory**: `/memory` — click the "Memory" card on home page  
- **Swarm**: `/swarm` — click the "Swarm" card on home page
- **Settings**: `/settings` — click the "Settings" card on home page

## Testing the Setup Wizard
The wizard appears on first launch when `localStorage` has no `setup-wizard-completed` flag and no bearer token is configured.

### Triggering the Wizard
To simulate first launch, run in the browser console:
```javascript
localStorage.clear();
location.reload();
```
The wizard should appear as an overlay on the home page.

### 5-Step Wizard Flow
1. **Welcome** — Click "Get Started"
2. **AI Choice** — Select "Local AI" (Ollama) or "Cloud AI". Click "Next"
3. **Model Selection** — Select a model from the list (or type custom). Click "Next"
4. **Gateway + Key** — Gateway URL is pre-filled. Enter the master key (e.g. `test123`). Click "Connect & Verify" to test. Should show green "Gateway connected and authenticated!" message. Click "Next"
5. **License** — Click "Skip" to use free tier, or enter a license key

### Verifying Auth After Wizard
- Navigate to `/chat` and send a message
- Check browser console for NO `401 Unauthorized` errors — this confirms Bearer token is being sent correctly
- The chat request should go to `http://127.0.0.1:3000/v1/chat/completions` with the Bearer token header

### Testing Reset Setup
- Navigate to `/settings`
- Scroll down and click "Reset Setup" button
- The wizard should reappear at Step 1
- Settings page behind it should show "Not Paired" and "Disconnected"

## Testing Without a Gateway
Many features work without the NullClaw gateway running:
- Memory toggles (active/inactive) and localStorage persistence
- Swarm canvas node creation, editing, deletion
- Agent Library click-to-add
- Swarm Deploy (falls back to JSON download)
- Swarm Run (shows execution log with "Failed to fetch" for agent nodes, but UI flow works)
- Setup wizard Steps 1-3 (AI choice, model selection)

Features that require a running gateway:
- Chat message sending and streaming responses
- Setup wizard Step 4 (gateway verification)
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
- `gatewayConfig` — Gateway connection settings (includes bearerToken)
- `setup-wizard-completed` — Flag set to `'true'` after wizard completion

## Browser Automation Limitations
- **SvelteFlow double-click**: The `on:nodedoubleclick` event in SvelteFlow cannot be triggered via browser automation tools (sequential clicks or DOM `dblclick` events don't fire SvelteFlow's internal event). This feature requires manual testing.
- **File drag-drop**: The memory page upload zone requires actual file drag-drop which is difficult to automate. Use console injection instead.
- **Blob downloads**: Deploy fallback triggers a blob URL download that may not be captured by automation tools, but the toast message confirms it worked.
- **Wizard button clicks**: Some wizard button clicks may timeout but still succeed (the page advances). Check the HTML output after a timeout to verify if the step actually advanced.

## Lint/Type Check
The project does not have a `lint` npm script. Use:
```bash
npm run check
```
This runs `svelte-check`. Pre-existing warnings (a11y, deprecated `on:click` in Svelte 5) are expected and unrelated to new changes.

## Svelte 5 Gotchas
- **Runes mode reactivity**: The project has `runes: true` in `svelte.config.js`. In runes mode, plain `let` variables are NOT reactive — you MUST use `$state()` for any variable that should trigger re-renders when changed. This is critical for layout-level state like `showSetupWizard`.
- **Cross-mode binding**: `+layout.svelte` uses runes mode (`$state`), but some components like `SetupWizard.svelte` use `<svelte:options runes={false} />` (legacy mode). `bind:show` works across modes — `$state()` in parent binds correctly to `export let show` in legacy child.
- `{@const}` tags must be inside block tags (`{#if}`, `{#each}`, etc.), not directly inside HTML elements like `<header>`
- Some pages (swarm) use legacy `on:click` syntax which generates deprecation warnings but still works

## Devin Secrets Needed
No secrets are needed for basic frontend testing. For full end-to-end testing with actual LLM responses, the NullClaw gateway must be running locally on port 3000 with Ollama or a cloud provider configured.
