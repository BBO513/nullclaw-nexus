# Testing NullClaw Nexus Frontend

## Overview
NullClaw Nexus is a SvelteKit frontend that communicates with a Zig-based gateway binary. Testing requires both services running.

## Local Setup

### Frontend
```bash
cd /home/ubuntu/repos/nullclaw-nexus
npm run dev -- --port 5175
```
Frontend runs at http://localhost:5175

### Gateway
```bash
/home/ubuntu/repos/nullclaw/zig-out/bin/nullclaw serve
```
Gateway runs at http://127.0.0.1:3000. If the binary doesn't exist, build it:
```bash
cd /home/ubuntu/repos/nullclaw
zig build -Doptimize=ReleaseSafe -Dtarget=x86_64-linux-musl
```

### Verify Both Running
```bash
curl -s http://localhost:5175/ -o /dev/null -w "%{http_code}"  # Should be 200
curl -s http://127.0.0.1:3000/health  # Should return JSON with status:healthy
```

## Svelte 5 Runes Compatibility

**Critical**: This project uses `runes={false}` in svelte.config.js but individual components may still be treated as runes mode by Svelte 5. Every `.svelte` component that uses plain `let` variable declarations for reactivity MUST include:
```svelte
<svelte:options runes={false} />
```
Without this, variables declared with `let` won't trigger re-renders when mutated. This was the root cause of the OfflineIndicator banner not updating.

## Testing Offline Banner

The OfflineIndicator component polls `/health` every 15 seconds.

1. Start both frontend and gateway
2. Verify no offline banner is shown
3. Kill the gateway process
4. Wait ~18 seconds for the next health check poll
5. Verify the full-width "Gateway Offline" banner appears at the top
6. Restart the gateway
7. Wait ~18 seconds for the next health check poll
8. Verify the banner disappears

## Testing Analytics Page (/analytics)

- Stats derive from `chat_messages` in localStorage
- Gateway performance (version, uptime) comes from `/status` endpoint with auth headers
- When gateway is offline, version and uptime should show '--' (not stale values)
- "Reset Data" clears the analytics snapshot but stats re-derive from chat_messages on next page load (intentional)

## Testing Tools Page (/tools)

- 8 default tools with enable/disable toggles
- State persists to localStorage under `nullclaw_tools`
- Category filters: Search, Compute, Data, System
- Verify toggle persistence by reloading the page

## Known Pre-existing Issues

- `npm run build` fails during prerendering due to missing `favicon.ico` — not caused by feature changes
- `npm run check` shows warnings about missing `node-fetch` types in test files — pre-existing
- Svelte 5 deprecation warnings in console (`non_reactive_update`) — cosmetic, from legacy patterns

## Key localStorage Keys

- `nullclaw_analytics` — analytics snapshot
- `chat_messages` — chat history (source of truth for message counts)
- `chat_session_id` — current session ID
- `gatewayConfig` — gateway URL, bearer token, provider, model
- `nullclaw_tools` — tool enable/disable states

## Devin Secrets Needed

No secrets required for local testing. The gateway runs without authentication by default.
