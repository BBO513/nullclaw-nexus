<svelte:options runes={false} />

<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  export let data: any;
  export let selected: boolean = false;
  export let id: string;

  function handleEdit() {
    console.log('🔘 Edit button clicked for input node:', id);
    window.dispatchEvent(new CustomEvent('editInputNode', { detail: { id, data } }));
  }
</script>

<div class="input-node glass p-4 rounded-lg border-2 transition-all {selected ? 'border-green-500 shadow-lg shadow-green-500/50' : 'border-green-500/30'}">
  <div class="flex items-center gap-2">
    <span class="text-2xl">📥</span>
    <div class="flex-1">
      <div class="font-bold text-sm">{data.label || 'Input'}</div>
      <div class="text-xs text-gray-400">{data.role || 'input'}</div>
      {#if data.initialMessage}
        <div class="text-xs text-green-400 mt-1 truncate" title={data.initialMessage}>
          "{data.initialMessage.substring(0, 30)}{data.initialMessage.length > 30 ? '...' : ''}"
        </div>
      {:else}
        <div class="text-xs text-red-400 mt-1">No message set</div>
      {/if}
    </div>
    <button 
      on:click|stopPropagation={handleEdit}
      class="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded transition-all"
      title="Edit input message"
    >
      ✏️ Edit
    </button>
  </div>

  <Handle type="source" position={Position.Right} />
</div>

<style>
  .input-node {
    min-width: 200px;
    background: rgba(17, 17, 24, 0.95);
  }

  .input-node:hover {
    border-color: rgba(34, 197, 94, 0.8);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
  }
</style>
