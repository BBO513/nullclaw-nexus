<svelte:options runes={false} />

<script lang="ts">
  import { gatewayConfig } from '$lib/stores/gateway';
  import { GatewayAPI } from '$lib/api/gateway';

  export let show = false;
  export let onClose: () => void = () => {};
  
  let pairingCode = '';
  let masterKeyInput = '';
  let pairing = false;
  let error = '';
  let pairingMode: 'choose' | 'masterkey' | 'code' = 'choose';

  async function handleMasterKeyPair() {
    if (!masterKeyInput.trim()) {
      error = 'Please enter your master key';
      return;
    }

    pairing = true;
    error = '';

    // Step 1: Check gateway is reachable via /health (no auth required)
    const api = new GatewayAPI($gatewayConfig.url, masterKeyInput.trim());
    const healthy = await api.checkHealth();
    if (!healthy) {
      error = 'Cannot connect to gateway. Please check that NullClaw is running.';
      pairing = false;
      return;
    }

    // Step 2: Verify master key by calling /status with it as Bearer token
    const status = await api.getStatus();
    if (status) {
      // Master key is valid — store it as bearer token
      gatewayConfig.update(c => ({
        ...c,
        bearerToken: masterKeyInput.trim(),
        paired: true,
        connected: true
      }));
      
      masterKeyInput = '';
      show = false;
      pairing = false;
      alert('Paired successfully! Your master key is now stored.');
    } else {
      error = 'Invalid master key. Make sure it matches the NULLCLAW_MASTER_KEY used to start the gateway.';
      pairing = false;
    }
  }

  async function handlePair() {
    if (!pairingCode || pairingCode.length !== 6) {
      error = 'Please enter a valid 6-digit pairing code';
      return;
    }

    pairing = true;
    error = '';

    try {
      const api = new GatewayAPI($gatewayConfig.url);
      const result = await api.pair(pairingCode);

      if (result && result.token) {
        gatewayConfig.update(c => ({
          ...c,
          bearerToken: result.token,
          paired: true,
          connected: true
        }));
        
        show = false;
        pairingCode = '';
        alert('✅ Successfully paired with gateway!');
      } else {
        error = 'Invalid pairing code. Please check and try again.';
      }
    } catch (err) {
      error = 'Failed to connect to gateway. Please check that NullClaw is running.';
    } finally {
      pairing = false;
    }
  }

  function handleClose() {
    show = false;
    pairingCode = '';
    masterKeyInput = '';
    error = '';
    pairingMode = 'choose';
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
    <div class="glass max-w-md w-full p-8">
      <h2 class="text-2xl font-bold mb-4">Pair with Gateway</h2>
      
      {#if pairingMode === 'choose'}
        <p class="text-gray-400 mb-6">
          Choose your pairing method:
        </p>

        <div class="space-y-4 mb-6">
          <button
            on:click={() => { pairingMode = 'masterkey'; error = ''; }}
            class="w-full px-6 py-4 bg-nebula-primary hover:bg-nebula-primaryLight rounded-lg font-semibold text-left flex items-center gap-3"
          >
            <span class="text-2xl">🔑</span>
            <div>
              <div class="font-bold">Master Key Pairing</div>
              <div class="text-sm opacity-80">Enter your NULLCLAW_MASTER_KEY (recommended)</div>
            </div>
          </button>

          <button
            on:click={() => { pairingMode = 'code'; error = ''; }}
            class="w-full px-6 py-4 glass hover:bg-nebula-card rounded-lg font-semibold text-left flex items-center gap-3"
          >
            <span class="text-2xl">🔢</span>
            <div>
              <div class="font-bold">Manual Pairing</div>
              <div class="text-sm opacity-80">Enter 6-digit code from terminal</div>
            </div>
          </button>
        </div>

        <button
          on:click={handleClose}
          class="w-full px-6 py-3 glass hover:bg-nebula-card rounded-lg font-semibold"
        >
          Cancel
        </button>

      {:else if pairingMode === 'masterkey'}
        <p class="text-gray-400 mb-6">
          Enter the NULLCLAW_MASTER_KEY you used when starting the gateway.
        </p>

        <div class="mb-6">
          <label for="master-key-input" class="block text-sm text-gray-400 mb-2">Master Key</label>
          <input
            id="master-key-input"
            type="password"
            bind:value={masterKeyInput}
            placeholder="The NULLCLAW_MASTER_KEY from your gateway"
            disabled={pairing}
            class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary"
          />
          <p class="text-xs text-gray-500 mt-1">This is the env var you set when running: NULLCLAW_MASTER_KEY=yourkey nullclaw serve</p>
        </div>

        <div class="flex gap-4">
          <button
            on:click={() => { pairingMode = 'choose'; masterKeyInput = ''; error = ''; }}
            disabled={pairing}
            class="flex-1 px-6 py-3 glass hover:bg-nebula-card disabled:opacity-50 rounded-lg font-semibold"
          >
            Back
          </button>
          <button
            on:click={handleMasterKeyPair}
            disabled={pairing || !masterKeyInput.trim()}
            class="flex-1 px-6 py-3 bg-nebula-primary hover:bg-nebula-primaryLight disabled:opacity-50 rounded-lg font-semibold"
          >
            {pairing ? 'Verifying...' : 'Pair'}
          </button>
        </div>

      {:else if pairingMode === 'code'}
        <p class="text-gray-400 mb-6">
          Enter the 6-digit pairing code from your NullClaw gateway terminal.
        </p>

        <div class="mb-6">
          <p class="text-sm text-gray-400 mb-2">To get a pairing code:</p>
          <ol class="text-sm text-gray-400 list-decimal list-inside space-y-1">
            <li>Check your gateway terminal output</li>
            <li>Look for the 6-digit pairing code</li>
            <li>Enter it below within the expiration time</li>
          </ol>
        </div>

        <div class="mb-6">
          <label for="pairing-code" class="block text-sm text-gray-400 mb-2">Pairing Code</label>
          <input
            id="pairing-code"
            type="text"
            bind:value={pairingCode}
            placeholder="000000"
            maxlength="6"
            disabled={pairing}
            class="w-full glass px-4 py-3 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-nebula-primary"
          />
        </div>

        <div class="flex gap-4">
          <button
            on:click={() => { pairingMode = 'choose'; pairingCode = ''; error = ''; }}
            disabled={pairing}
            class="flex-1 px-6 py-3 glass hover:bg-nebula-card disabled:opacity-50 rounded-lg font-semibold"
          >
            Back
          </button>
          <button
            on:click={handlePair}
            disabled={pairing || pairingCode.length !== 6}
            class="flex-1 px-6 py-3 bg-nebula-primary hover:bg-nebula-primaryLight disabled:opacity-50 rounded-lg font-semibold"
          >
            {pairing ? 'Pairing...' : 'Pair Now'}
          </button>
        </div>
      {/if}

      {#if error}
        <div class="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p class="text-sm text-red-500">{error}</p>
        </div>
      {/if}
    </div>
  </div>
{/if}
