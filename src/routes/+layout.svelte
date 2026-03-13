<script lang="ts">
	import '../app.css';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import SetupWizard from '$lib/components/SetupWizard.svelte';
	import { onMount } from 'svelte';
	import { gatewayConfig, autoDiscoverGateway } from '$lib/stores/gateway';
	import { isTauri, onGatewayStarted } from '$lib/tauri';
	import { get } from 'svelte/store';

	let showSetupWizard = false;

	onMount(async () => {
		// Unregister all service workers to prevent caching issues (not needed in Tauri)
		if (!isTauri() && 'serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (let registration of registrations) {
					registration.unregister();
					console.log('[PWA] Service Worker unregistered');
				}
			});
		}

		// Auto-discover gateway (tries multiple ports, works in both Tauri and browser)
		const discoveredUrl = await autoDiscoverGateway();
		if (discoveredUrl) {
			console.log('[Gateway] Connected to:', discoveredUrl);
		}

		// In Tauri, listen for gateway-started events from the sidecar
		if (isTauri()) {
			onGatewayStarted((url) => {
				console.log('[Tauri] Gateway sidecar started at:', url);
				gatewayConfig.update(c => ({ ...c, url, connected: true }));
			});
		}

		// Show setup wizard on first launch if not completed yet
		const setupCompleted = localStorage.getItem('setup-wizard-completed');
		const config = get(gatewayConfig);
		if (!setupCompleted && !config.bearerToken) {
			showSetupWizard = true;
			console.log('[Setup] First launch detected, showing setup wizard');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#7c3aed" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="NullClaw Nexus" />
</svelte:head>

<ErrorBoundary>
	<SetupWizard bind:show={showSetupWizard} />
	<OfflineIndicator />
	<InstallPrompt />
	<div class="dark min-h-screen">
		<slot />
	</div>
</ErrorBoundary>
