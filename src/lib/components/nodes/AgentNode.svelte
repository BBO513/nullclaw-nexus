<svelte:options runes={false} />

<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  
  export let data: any;
  export let selected: boolean = false;
  export let id: string;

  function handleEdit() {
    console.log('🔘 Edit button clicked for agent node:', id);
    window.dispatchEvent(new CustomEvent('editAgentNode', { detail: { id, data } }));
  }
</script>

<div class="agent-node glass p-4 rounded-lg border-2 transition-all {selected ? 'border-nebula-primary shadow-lg shadow-nebula-primary/50' : 'border-nebula-primary/30'}">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-2xl">🤖</span>
    <div class="flex-1">
      <div class="font-bold text-sm">{data.label || data.name || 'Agent'}</div>
      <div class="text-xs text-gray-400">{data.role || 'worker'}</div>
    </div>
    <button 
      on:click|stopPropagation={handleEdit}
      class="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 rounded transition-all"
      title="Edit agent"
    >
      ✏️ Edit
    </button>
  </div>
  {#if data.model}
    <div class="text-xs text-nebula-primary/70 mt-1">Model: {data.model}</div>
  {/if}
  {#if data.tools && data.tools.length > 0}
    <div class="text-xs text-green-400 mt-1">🔧 {data.tools.length} tool{data.tools.length !== 1 ? 's' : ''}</div>
  {/if}
  {#if data.memory && data.memory.length > 0}
    <div class="text-xs text-blue-400 mt-1">💾 {data.memory.length} memor{data.memory.length !== 1 ? 'ies' : 'y'}</div>
  {/if}

  <Handle type="target" position={Position.Left} />
  <Handle type="source" position={Position.Right} />
</div>

<style>
  .agent-node {
    min-width: 200px;
    background: rgba(17, 17, 24, 0.95);
  }

  .agent-node:hover {
    border-color: rgba(124, 58, 237, 0.8);
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);
  }
</style>
