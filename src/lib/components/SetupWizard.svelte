<svelte:options runes={false} />

<script lang="ts">
  import { gatewayConfig, providers, ollamaModels, openaiModels, claudeModels } from '$lib/stores/gateway';
  import { license, activateLicense } from '$lib/stores/license';
  import { GatewayAPI } from '$lib/api/gateway';

  export let show = false;
  export let onClose: () => void = () => {};
  
  let currentStep = 1;
  let totalSteps = 5;
  
  // Step 2: Local vs Cloud
  let aiMode: 'local' | 'cloud' | '' = '';
  let detectingOllama = false;
  let ollamaDetected = false;
  let availableOllamaModels: string[] = [];
  let selectedProvider = '';
  
  // Step 3: Model + API key
  let selectedModel = '';
  let providerApiKey = '';
  let modelList: string[] = [];
  
  // Step 4: Gateway + Master Key
  let gatewayUrl = '';
  let checkingGateway = false;
  let gatewayConnected = false;
  let masterKey = '';
  let verifyingKey = false;
  let keyVerified = false;
  
  // Step 5: License (optional)
  let licenseKey = '';
  let activatingLicense = false;
  
  let error = '';
  let loading = false;
  let loadingMessage = '';

  // Initialize values when wizard opens
  $: if (show) {
    gatewayUrl = $gatewayConfig.url;
    selectedProvider = $gatewayConfig.provider;
    selectedModel = $gatewayConfig.model;
    updateModelList();
  }

  function updateModelList() {
    switch (selectedProvider) {
      case 'ollama':
        modelList = availableOllamaModels.length > 0 ? availableOllamaModels : ollamaModels;
        break;
      case 'openai':
        modelList = openaiModels;
        break;
      case 'anthropic':
        modelList = claudeModels;
        break;
      default:
        modelList = [];
    }
  }

  $: {
    selectedProvider;
    updateModelList();
  }

  const cloudProviders = providers.filter(p => p.id !== 'ollama');

  async function detectOllama() {
    detectingOllama = true;
    loading = true;
    loadingMessage = 'Detecting Ollama...';
    
    try {
      const api = new GatewayAPI();
      const models = await api.getOllamaModels();
      availableOllamaModels = models;
      ollamaDetected = models.length > 0;
      if (ollamaDetected) {
        selectedProvider = 'ollama';
        updateModelList();
      }
    } catch {
      ollamaDetected = false;
    } finally {
      detectingOllama = false;
      loading = false;
    }
  }

  function selectLocal() {
    aiMode = 'local';
    selectedProvider = 'ollama';
    updateModelList();
    detectOllama();
  }

  function selectCloud() {
    aiMode = 'cloud';
    selectedProvider = '';
  }

  async function checkGatewayAndKey() {
    checkingGateway = true;
    loading = true;
    loadingMessage = 'Connecting to gateway...';
    error = '';
    
    try {
      const api = new GatewayAPI(gatewayUrl);
      const healthy = await api.checkHealth();
      
      if (!healthy) {
        error = 'Could not connect to gateway. Make sure NullClaw is running.';
        gatewayConnected = false;
        return;
      }

      gatewayConnected = true;
      gatewayConfig.update(c => ({ ...c, url: gatewayUrl, connected: true }));

      if (masterKey.trim()) {
        loadingMessage = 'Verifying master key...';
        verifyingKey = true;
        
        const authedApi = new GatewayAPI(gatewayUrl, masterKey.trim());
        const status = await authedApi.getStatus();
        
        if (status) {
          gatewayConfig.update(c => ({
            ...c,
            bearerToken: masterKey.trim(),
            paired: true,
            connected: true
          }));
          keyVerified = true;
        } else {
          error = 'Gateway connected but master key is incorrect. Check your NULLCLAW_MASTER_KEY value.';
          keyVerified = false;
          return;
        }
      } else {
        keyVerified = true;
      }
    } catch (err) {
      error = 'Failed to connect to gateway. Check the URL and try again.';
      gatewayConnected = false;
    } finally {
      checkingGateway = false;
      verifyingKey = false;
      loading = false;
    }
  }

  function handleActivateLicense() {
    if (!licenseKey.trim()) return;

    activatingLicense = true;
    loading = true;
    loadingMessage = 'Activating license...';
    error = '';

    setTimeout(() => {
      const success = activateLicense(licenseKey.trim().toUpperCase());
      if (!success) {
        error = 'Invalid license key format';
      }
      activatingLicense = false;
      loading = false;
    }, 500);
  }

  function next() {
    error = '';
    if (currentStep >= totalSteps) return;
    
    if (currentStep === 2 && !aiMode) {
      error = 'Please choose local or cloud AI';
      return;
    }
    if (currentStep === 2 && aiMode === 'cloud' && !selectedProvider) {
      error = 'Please select a cloud provider';
      return;
    }
    if (currentStep === 3 && !selectedModel) {
      error = 'Please select a model';
      return;
    }
    if (currentStep === 4 && !gatewayConnected) {
      error = 'Please connect to gateway first';
      return;
    }
    if (currentStep === 4 && masterKey && !keyVerified) {
      error = 'Please verify your master key first';
      return;
    }
    currentStep++;
  }

  function back() {
    error = '';
    if (currentStep > 1) currentStep--;
  }

  function skip() {
    error = '';
    if (currentStep < totalSteps) {
      currentStep++;
    } else {
      finish();
    }
  }

  function finish() {
    gatewayConfig.update(c => ({
      ...c,
      provider: selectedProvider,
      model: selectedModel
    }));

    if (aiMode === 'cloud' && providerApiKey && $gatewayConfig.bearerToken) {
      const api = new GatewayAPI($gatewayConfig.url, $gatewayConfig.bearerToken);
      api.updateProvider({
        type: selectedProvider,
        base_url: getProviderBaseUrl(selectedProvider),
        model: selectedModel,
        api_key: providerApiKey
      }).catch(err => console.error('Failed to push provider config:', err));
    }
    
    localStorage.setItem('setup-wizard-completed', 'true');
    show = false;
  }

  function getProviderBaseUrl(provider: string): string {
    switch (provider) {
      case 'ollama': return 'http://localhost:11434';
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'groq': return 'https://api.groq.com/openai/v1';
      case 'together': return 'https://api.together.xyz/v1';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'deepseek': return 'https://api.deepseek.com/v1';
      case 'mistral': return 'https://api.mistral.ai/v1';
      default: return '';
    }
  }

  function close() {
    if (confirm('Are you sure you want to exit setup? You can run it again from Settings.')) {
      show = false;
    }
  }

  function needsApiKey(provider: string): boolean {
    return provider !== 'ollama' && provider !== '';
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-8 z-50">
    <div class="glass max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold">Setup Wizard</h1>
          <p class="text-gray-400 mt-1">Step {currentStep} of {totalSteps}</p>
        </div>
        <button on:click={close} class="text-gray-400 hover:text-white text-2xl">&times;</button>
      </div>

      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="h-2 bg-nebula-bg rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-nebula-primary to-nebula-accent transition-all duration-300"
            style="width: {(currentStep / totalSteps) * 100}%"></div>
        </div>
      </div>

      <!-- Loading Overlay -->
      {#if loading}
        <div class="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl z-10">
          <div class="text-center">
            <div class="text-4xl mb-4 animate-pulse">...</div>
            <p class="text-xl font-semibold">{loadingMessage}</p>
          </div>
        </div>
      {/if}

      <!-- Step Content -->
      <div class="min-h-[400px]">
        {#if currentStep === 1}
          <!-- Step 1: Welcome -->
          <div class="text-center py-12">
            <h2 class="text-4xl font-bold mb-4">Welcome to NullClaw Nexus</h2>
            <p class="text-xl text-gray-400 mb-8">Your private AI gateway. Let's get you set up.</p>
            <div class="max-w-2xl mx-auto text-left space-y-4">
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold text-nebula-primary">1</span>
                <div>
                  <h3 class="font-bold">Choose your AI</h3>
                  <p class="text-sm text-gray-400">Run locally with Ollama or use a cloud provider</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold text-nebula-primary">2</span>
                <div>
                  <h3 class="font-bold">Pick a model</h3>
                  <p class="text-sm text-gray-400">Select which AI model to chat with</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold text-nebula-primary">3</span>
                <div>
                  <h3 class="font-bold">Connect gateway</h3>
                  <p class="text-sm text-gray-400">Link the NullClaw gateway and enter your master key</p>
                </div>
              </div>
            </div>
          </div>

        {:else if currentStep === 2}
          <!-- Step 2: Local vs Cloud -->
          <div>
            <h2 class="text-2xl font-bold mb-4">How do you want to run AI?</h2>
            <p class="text-gray-400 mb-8">Choose between running AI locally on your machine (free, private) or using a cloud provider (faster, requires API key).</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button on:click={selectLocal}
                class="p-6 rounded-xl text-left transition-all border-2 {aiMode === 'local' ? 'border-green-500 bg-green-500/10' : 'border-transparent glass hover:bg-nebula-card'}">
                <div class="text-3xl mb-3">Local AI</div>
                <h3 class="text-xl font-bold mb-2">Run Locally</h3>
                <p class="text-sm text-gray-400 mb-3">Use Ollama for 100% private, offline AI. No API keys needed.</p>
                <div class="text-xs text-gray-500 space-y-1">
                  <p>Requires: Ollama installed</p>
                  <p>Models: Llama 3, Mistral, Phi, etc.</p>
                  <p>Cost: Free</p>
                </div>
                {#if aiMode === 'local' && ollamaDetected}
                  <div class="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p class="text-green-500 text-sm font-semibold">Ollama detected! {availableOllamaModels.length} model(s) found</p>
                  </div>
                {:else if aiMode === 'local' && !detectingOllama && !ollamaDetected}
                  <div class="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p class="text-yellow-500 text-sm">Ollama not detected. Install from ollama.com</p>
                  </div>
                {/if}
              </button>

              <button on:click={selectCloud}
                class="p-6 rounded-xl text-left transition-all border-2 {aiMode === 'cloud' ? 'border-nebula-primary bg-nebula-primary/10' : 'border-transparent glass hover:bg-nebula-card'}">
                <div class="text-3xl mb-3">Cloud AI</div>
                <h3 class="text-xl font-bold mb-2">Use Cloud Provider</h3>
                <p class="text-sm text-gray-400 mb-3">Connect to OpenAI, Anthropic, Groq, or 20+ other providers.</p>
                <div class="text-xs text-gray-500 space-y-1">
                  <p>Requires: API key from provider</p>
                  <p>Models: GPT-4o, Claude, etc.</p>
                  <p>Cost: Pay per use</p>
                </div>
              </button>
            </div>

            {#if aiMode === 'cloud'}
              <div class="mt-8">
                <h3 class="text-lg font-bold mb-4">Select Provider</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                  {#each cloudProviders as provider}
                    <button on:click={() => { selectedProvider = provider.id; updateModelList(); }}
                      class="p-3 rounded-lg text-left text-sm transition-all {selectedProvider === provider.id ? 'bg-nebula-primary border-2 border-nebula-primary' : 'glass hover:bg-nebula-card'}">
                      {provider.name}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

        {:else if currentStep === 3}
          <!-- Step 3: Model + API Key -->
          <div>
            <h2 class="text-2xl font-bold mb-4">
              {#if aiMode === 'local'}Select Model{:else}Model &amp; API Key{/if}
            </h2>
            <p class="text-gray-400 mb-6">
              {#if aiMode === 'local'}
                Choose which Ollama model to use. You can change this anytime in Settings.
              {:else}
                Select your model and enter your API key for {selectedProvider}.
              {/if}
            </p>

            {#if needsApiKey(selectedProvider)}
              <div class="mb-6">
                <label for="api-key" class="block text-sm text-gray-400 mb-2">API Key for {selectedProvider}</label>
                <input id="api-key" type="password" bind:value={providerApiKey} placeholder="sk-..."
                  class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary" />
                <p class="text-xs text-gray-500 mt-1">This key is sent to the gateway and never stored in the browser.</p>
              </div>
            {/if}

            <h3 class="text-sm font-semibold text-gray-400 mb-3">Model</h3>
            <div class="space-y-2 max-h-[350px] overflow-y-auto">
              {#each modelList as model}
                <button on:click={() => selectedModel = model}
                  class="w-full p-3 rounded-lg text-left transition-all font-mono text-sm {selectedModel === model ? 'bg-nebula-primary border-2 border-nebula-primary' : 'glass hover:bg-nebula-card'}">
                  {model}
                </button>
              {/each}
              {#if modelList.length === 0}
                <div class="text-center py-8 text-gray-500">
                  <p>No preset models for this provider.</p>
                  <p class="text-sm mt-2">Enter a custom model name:</p>
                  <input type="text" bind:value={selectedModel} placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
                    class="mt-2 w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary text-sm" />
                </div>
              {/if}
            </div>
          </div>

        {:else if currentStep === 4}
          <!-- Step 4: Gateway + Master Key -->
          <div>
            <h2 class="text-2xl font-bold mb-4">Connect to Gateway</h2>
            <p class="text-gray-400 mb-6">NullClaw routes all AI requests through a local gateway for privacy and control. Enter your gateway URL and master key.</p>

            <div class="mb-4">
              <label for="gateway-url" class="block text-sm text-gray-400 mb-2">Gateway URL</label>
              <input id="gateway-url" type="text" bind:value={gatewayUrl} placeholder="http://127.0.0.1:3000"
                class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary" />
            </div>

            <div class="mb-6">
              <label for="master-key" class="block text-sm text-gray-400 mb-2">Master Key</label>
              <input id="master-key" type="password" bind:value={masterKey}
                placeholder="The NULLCLAW_MASTER_KEY you used to start the gateway"
                class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary" />
              <p class="text-xs text-gray-500 mt-1">This is the NULLCLAW_MASTER_KEY env var you set when running nullclaw serve</p>
            </div>

            <button on:click={checkGatewayAndKey} disabled={checkingGateway || !gatewayUrl.trim()}
              class="w-full px-6 py-3 bg-nebula-primary hover:bg-nebula-primaryLight disabled:opacity-50 rounded-lg font-semibold mb-4">
              {checkingGateway ? 'Connecting...' : 'Connect &amp; Verify'}
            </button>

            {#if gatewayConnected && keyVerified}
              <div class="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p class="text-green-500 font-semibold">Gateway connected{masterKey.trim() ? ' and authenticated' : ''}!</p>
              </div>
            {:else if gatewayConnected && !keyVerified}
              <div class="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p class="text-yellow-500 font-semibold">Gateway connected but master key verification failed.</p>
              </div>
            {/if}
          </div>

        {:else if currentStep === 5}
          <!-- Step 5: License (Optional) + Finish -->
          <div>
            <div class="flex items-center gap-2 mb-4">
              <h2 class="text-2xl font-bold">Activate License</h2>
              <span class="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm rounded-full">Optional</span>
            </div>
            <p class="text-gray-400 mb-6">Have a pro license? Enter it now to unlock unlimited features. You can skip this and use the free tier or activate later from Settings.</p>

            <div class="mb-6">
              <label for="license-key" class="block text-sm text-gray-400 mb-2">License Key</label>
              <input id="license-key" type="text" bind:value={licenseKey} placeholder="NULLCLAW-XXXX-XXXX-XXXX"
                class="w-full glass px-4 py-3 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-nebula-primary" />
            </div>

            <button on:click={handleActivateLicense} disabled={activatingLicense || !licenseKey.trim()}
              class="w-full px-6 py-3 bg-gradient-to-r from-nebula-primary to-nebula-accent hover:opacity-90 disabled:opacity-50 rounded-lg font-semibold mb-6">
              {activatingLicense ? 'Activating...' : 'Activate License'}
            </button>

            <div class="grid grid-cols-2 gap-4">
              <div class="glass p-4 rounded-lg">
                <h3 class="font-bold mb-2 text-gray-400">Free Tier</h3>
                <ul class="text-sm space-y-1">
                  <li>3 agents max</li>
                  <li>5 memories max</li>
                  <li>All core features</li>
                </ul>
              </div>
              <div class="bg-gradient-to-br from-nebula-primary/20 to-nebula-accent/20 p-4 rounded-lg border-2 border-nebula-primary/30">
                <h3 class="font-bold mb-2 text-nebula-primary">Pro ($9.99)</h3>
                <ul class="text-sm space-y-1">
                  <li>Unlimited agents</li>
                  <li>Unlimited memories</li>
                  <li>Priority support</li>
                </ul>
              </div>
            </div>

            <p class="text-xs text-center text-gray-500 mt-4">Purchase at gumroad.com/nullclaw</p>
          </div>
        {/if}
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p class="text-red-500">{error}</p>
        </div>
      {/if}

      <!-- Navigation -->
      <div class="flex gap-4 mt-8">
        {#if currentStep > 1}
          <button on:click={back} disabled={loading}
            class="px-6 py-3 glass hover:bg-nebula-card disabled:opacity-50 rounded-lg font-semibold">Back</button>
        {/if}

        <div class="flex-1"></div>

        {#if currentStep === 5}
          <button on:click={skip} disabled={loading}
            class="px-6 py-3 glass hover:bg-nebula-card disabled:opacity-50 rounded-lg font-semibold">Skip</button>
          <button on:click={finish} disabled={loading}
            class="px-8 py-3 bg-gradient-to-r from-nebula-primary to-nebula-accent hover:opacity-90 disabled:opacity-50 rounded-lg font-semibold">Finish Setup</button>
        {:else if currentStep === 1}
          <button on:click={next}
            class="px-8 py-3 bg-nebula-primary hover:bg-nebula-primaryLight rounded-lg font-semibold">Get Started</button>
        {:else}
          <button on:click={next} disabled={loading}
            class="px-8 py-3 bg-nebula-primary hover:bg-nebula-primaryLight disabled:opacity-50 rounded-lg font-semibold">Next</button>
        {/if}
      </div>
    </div>
  </div>
{/if}
