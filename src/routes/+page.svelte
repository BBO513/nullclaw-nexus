<script lang="ts">
  import { onMount } from 'svelte';
  import { gatewayConfig } from '$lib/stores/gateway';
  import { GatewayAPI } from '$lib/api/gateway';
  import PairingModal from '$lib/components/PairingModal.svelte';
  import LicenseModal from '$lib/components/LicenseModal.svelte';
  import LaneMonitoring from '$lib/components/LaneMonitoring.svelte';

  let connected = false;
  let checking = true;
  let showPairing = false;
  let showLicenseModal = false;

  function closePairing() {
    showPairing = false;
  }

  function closeLicense() {
    showLicenseModal = false;
  }

  onMount(async () => {
    // Always show dashboard immediately
    checking = false;

    // Check gateway health in background
    const api = new GatewayAPI($gatewayConfig.url, $gatewayConfig.bearerToken);
    connected = await api.checkHealth();
    gatewayConfig.update(c => ({ ...c, connected }));
  });
</script>

<PairingModal show={showPairing} onClose={closePairing} />
<LicenseModal show={showLicenseModal} onClose={closeLicense} />

<div class="min-h-screen p-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <header class="mb-12">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-5xl font-bold bg-gradient-to-r from-nebula-primary via-nebula-accent to-nebula-secondary bg-clip-text text-transparent">
            NullClaw Nexus
          </h1>
          <p class="text-nebula-primaryLight mt-2">Ultra-lightweight AI Agent Control Center</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="glass px-4 py-2 flex items-center gap-2">
            <div class={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span class="text-sm">{checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <div class="glass p-6 cursor-pointer hover:scale-105 hover:shadow-neon transition-all" title="Compiled binary size - ultra-lightweight">
        <div class="text-nebula-accent text-3xl font-bold">3.47 MB</div>
        <div class="text-sm text-gray-400 mt-1">Binary Size</div>
      </div>
      <div class="glass p-6 cursor-pointer hover:scale-105 hover:shadow-neon transition-all" title="Peak memory during operation">
        <div class="text-nebula-primary text-3xl font-bold">~1 MB</div>
        <div class="text-sm text-gray-400 mt-1">RAM Usage</div>
      </div>
      <div class="glass p-6 cursor-pointer hover:scale-105 hover:shadow-neon transition-all" title="Cold start time">
        <div class="text-nebula-secondary text-3xl font-bold">&lt;2 ms</div>
        <div class="text-sm text-gray-400 mt-1">Boot Time</div>
      </div>
      <a href="/settings" class="glass p-6 cursor-pointer hover:scale-105 hover:shadow-neon transition-all">
        <div class="text-nebula-accent text-3xl font-bold">22+</div>
        <div class="text-sm text-gray-400 mt-1">LLM Providers</div>
      </a>
    </div>

    <!-- Lane Queue Monitoring -->
    <div class="mb-12">
      <h2 class="text-2xl font-bold mb-4">Execution Lane Monitoring</h2>
      <p class="text-gray-400 mb-6">Monitor gateway queue status and agent execution lanes for real-time visibility into processing delays.</p>
      <LaneMonitoring />
    </div>

    <!-- Main Navigation Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <a href="/chat" class="glass p-8 hover:border-nebula-primary hover:shadow-neon hover:scale-105 transition-all cursor-pointer group">
        <div class="text-4xl mb-4">💬</div>
        <h3 class="text-2xl font-bold mb-2 group-hover:text-nebula-accent">Live Chat</h3>
        <p class="text-gray-400">Interact with AI agents in real-time with streaming responses</p>
      </a>

      <a href="/swarm" class="glass p-8 hover:border-nebula-primary hover:shadow-neon hover:scale-105 transition-all cursor-pointer group">
        <div class="text-4xl mb-4">🕸️</div>
        <h3 class="text-2xl font-bold mb-2 group-hover:text-nebula-accent">Swarm Forge</h3>
        <p class="text-gray-400">Visual canvas for orchestrating multi-agent swarms</p>
      </a>

      <a href="/memory" class="glass p-8 hover:border-nebula-primary hover:shadow-neon hover:scale-105 transition-all cursor-pointer group">
        <div class="text-4xl mb-4">🧠</div>
        <h3 class="text-2xl font-bold mb-2 group-hover:text-nebula-accent">Memory Vault</h3>
        <p class="text-gray-400">Upload, edit, and inject prompts & knowledge files</p>
      </a>

      <a href="/settings" class="glass p-8 hover:border-nebula-primary hover:shadow-neon hover:scale-105 transition-all cursor-pointer group">
        <div class="text-4xl mb-4">⚙️</div>
        <h3 class="text-2xl font-bold mb-2 group-hover:text-nebula-accent">Settings</h3>
        <p class="text-gray-400">Configure LLM providers and system preferences</p>
      </a>

      <a href="/tools" class="glass p-8 hover:border-nebula-primary hover:shadow-neon hover:scale-105 transition-all cursor-pointer group">
        <div class="text-4xl mb-4">🔧</div>
        <h3 class="text-2xl font-bold mb-2 group-hover:text-nebula-accent">Tool Library</h3>
        <p class="text-gray-400">Manage and approve tool calls (Coming Soon)</p>
      </a>

      <a href="/analytics" class="glass p-8 hover:border-nebula-primary hover:shadow-neon hover:scale-105 transition-all cursor-pointer group">
        <div class="text-4xl mb-4">📊</div>
        <h3 class="text-2xl font-bold mb-2 group-hover:text-nebula-accent">Analytics</h3>
        <p class="text-gray-400">Monitor agent performance and usage (Coming Soon)</p>
      </a>
    </div>

    <!-- Footer Info -->
    <div class="mt-12 text-center text-gray-500 text-sm">
      <p>Powered by NullClaw • Built with SvelteKit & Tailwind</p>
      <p class="mt-1">
        <a href="https://github.com/nullclaw/nullclaw" target="_blank" class="hover:text-nebula-accent">
          GitHub Repository
        </a>
      </p>
    </div>
  </div>
</div>

<style>
  a {
    transition: all 0.3s ease;
  }
</style>
