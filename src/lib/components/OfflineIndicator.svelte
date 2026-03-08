<script lang="ts">
  import { onMount } from 'svelte';
  import { gatewayConfig } from '$lib/stores/gateway';
  import { GatewayAPI } from '$lib/api/gateway';

  let isOnline = true;
  let gatewayOnline = false;
  let checking = false;
  let statusText = '';
  let statusColor = '';

  async function checkGateway() {
    if (!isOnline) {
      gatewayOnline = false;
      updateStatus();
      return;
    }

    checking = true;
    updateStatus();
    
    const api = new GatewayAPI($gatewayConfig.url, $gatewayConfig.bearerToken);
    gatewayOnline = await api.checkHealth();
    checking = false;
    updateStatus();

    gatewayConfig.update(c => ({ ...c, connected: gatewayOnline }));
  }

  function updateStatus() {
    if (!isOnline) {
      statusText = 'No Internet';
      statusColor = 'bg-red-500';
    } else if (checking) {
      statusText = 'Checking...';
      statusColor = 'bg-yellow-500';
    } else if (!gatewayOnline) {
      statusText = 'Gateway Offline';
      statusColor = 'bg-red-500';
    } else {
      statusText = 'Connected';
      statusColor = 'bg-green-500';
    }
  }

  onMount(() => {
    isOnline = navigator.onLine;
    updateStatus();
    
    // Check gateway on mount
    checkGateway();

    // Check gateway every 30 seconds
    const interval = setInterval(checkGateway, 30000);

    // Listen for online/offline events
    const handleOnline = () => {
      isOnline = true;
      checkGateway();
    };

    const handleOffline = () => {
      isOnline = false;
      gatewayOnline = false;
      updateStatus();
      gatewayConfig.update(c => ({ ...c, connected: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });
</script>

{#if !isOnline || !gatewayOnline}
  <div class="fixed top-4 right-4 z-40 glass px-4 py-2 rounded-lg border-2 border-red-500/30 bg-red-500/10 animate-slide-down">
    <div class="flex items-center gap-2">
      <div class={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></div>
      <span class="text-sm font-semibold text-red-500">{statusText}</span>
      {#if !isOnline}
        <span class="text-xs text-gray-400 ml-2">Check your connection</span>
      {:else if !gatewayOnline}
        <button
          on:click={checkGateway}
          class="text-xs text-nebula-accent hover:text-nebula-primary ml-2"
        >
          Retry
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes slide-down {
    from {
      transform: translateY(-100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
</style>
