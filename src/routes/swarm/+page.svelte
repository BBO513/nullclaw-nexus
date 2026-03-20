<svelte:options runes={false} />

<script lang="ts">
import { onMount } from 'svelte';
import { gatewayConfig } from '$lib/stores/gateway';
import { memories } from '$lib/stores/memories';
import {
swarmAgents,
swarmEdges,
createAgentNode,
createInputNode,
createOutputNode,
updateAgentStatus,
addToolToAgent,
removeToolFromAgent,
addMemoryToAgent,
removeMemoryFromAgent,
validateSwarm,
clearSwarm
}  from '$lib/stores/swarms';
import type { AgentNode, SwarmNode } from '$lib/stores/swarms';
import { GatewayAPI } from '$lib/api/gateway';

// Import custom node components
import InputNode from '$lib/components/nodes/InputNode.svelte';
import AgentNodeComponent from '$lib/components/nodes/AgentNode.svelte';
import OutputNode from '$lib/components/nodes/OutputNode.svelte';

// State management
let mounted = false;
let loaded = false;
let loadError: string | null = null;

// SvelteFlow components (dynamically loaded)
let SvelteFlow: any = null;
let Background: any = null;
let Controls: any = null;

// Custom node types for SvelteFlow
// Create node type wrappers that handle edit events
const createNodeWrapper = (Component: any) => {
  return class extends Component {
    constructor(options: any) {
      super(options);
      this.$on?.('edit', (e: any) => handleNodeEdit(e));
    }
  };
};

const nodeTypes = {
input: InputNode,
agent: AgentNodeComponent,
output: OutputNode,
default: AgentNodeComponent
};

// Local reactive copies for SvelteFlow
let nodes: any[] = [];
let edges: any[] = [];

// Subscribe to stores
$: nodes = $swarmAgents;
$: edges = $swarmEdges;

// Agent editor state
let showAgentEditor = false;
let editingAgent: SwarmNode | null = null;
let agentName = '';
let agentModel = '';
let agentSystemPrompt = '';
let agentTools: string[] = [];
let agentMemories: string[] = [];

// Input editor state
let showInputEditor = false;
let editingInput: SwarmNode | null = null;
let inputMessage = '';
let inputLabel = '';

// Available tools
const AVAILABLE_TOOLS = [
'web_search',
'file_read',
'file_write',
'code_execute',
'code_analyze',
'image_generate',
'image_analyze'
];

// Toast state
let toastMessage = '';
let toastType: 'success' | 'error' = 'success';
let showToast = false;

// Export modal state
let showExportModal = false;
let exportFormat: 'json' | 'yaml' = 'json';
let exporting = false;

// Execution state
let running = false;
let showExecutionPanel = false;
let showQuickStart = true;
let executionLog: Array<{
nodeId: string;
nodeName: string;
status: 'pending' | 'running' | 'done' | 'error';
message?: string;
output?: string;
timestamp: Date;
duration?: number;
}> = [];
let nodeOutputs = new Map<string, string>();

onMount(async () => {
  // Listen for edit events from node components
  window.addEventListener('editAgentNode', (e: any) => {
    const { id } = e.detail;
    const node = nodes.find((n: any) => n.id === id);
    if (node && node.type === 'agent') {
      editingAgent = node;
      agentName = node.data.name || '';
      agentModel = node.data.model || '';
      agentSystemPrompt = node.data.systemPrompt || '';
      agentTools = [...(node.data.tools || [])];
      agentMemories = [...(node.data.memory || [])];
      showAgentEditor = true;
      console.log('?? Opening agent editor for:', id);
    }
  });

  window.addEventListener('editInputNode', (e: any) => {
    const { id } = e.detail;
    const node = nodes.find((n: any) => n.id === id);
    if (node && node.type === 'input') {
      editingInput = node;
      inputLabel = node.data.label || '';
      inputMessage = node.data.initialMessage || '';
      showInputEditor = true;
      console.log('?? Opening input editor for:', id);
    }
  });
mounted = true;
// Initialize with default nodes if empty
if ($swarmAgents.length === 0) {
const input = createInputNode('User Input', { x: 100, y: 200 });
const agent = createAgentNode('Main Agent', 'llama3.1', { x: 400, y: 200 });
const output = createOutputNode('Final Output', { x: 700, y: 200 });
swarmAgents.set([input, agent, output]);
swarmEdges.set([
{ id: 'e1', source: input.id, target: agent.id, type: 'smoothstep' },
{ id: 'e2', source: agent.id, target: output.id, type: 'smoothstep' }
]);
}
// Load SvelteFlow components
try {
const module = await import('@xyflow/svelte');
SvelteFlow = module.SvelteFlow;
Background = module.Background;
Controls = module.Controls;
await import('@xyflow/svelte/dist/style.css');
loaded = true;
} catch (error) {
console.error('Failed to load SvelteFlow:', error);
loadError = error instanceof Error ? error.message : String(error);
loaded = true;
}
});

// Execution Functions
async function runSwarm() {
if (running) return;
const validation = validateSwarm();
if (!validation.valid) {
showToastMessage(`❌ Cannot run: ${validation.errors.join(', ')}`, 'error');
return;
}
if (!$gatewayConfig.connected) {
showToastMessage('❌ Gateway not connected', 'error');
return;
}
running = true;
showExecutionPanel = true;
nodeOutputs.clear();
executionLog = $swarmAgents.map(node => ({
nodeId: node.id,
nodeName: node.data.name || node.data.label || node.id,
status: 'pending' as const,
timestamp: new Date()
}));

try {
const executionOrder = buildTopologicalOrder();
if (executionOrder.length === 0) {
showToastMessage('❌ No valid execution path', 'error');
running = false;
return;
}
const inputNodes = $swarmAgents.filter(n => n.type === 'input');
const initialMessage = inputNodes.length > 0 ? (inputNodes[0].data.initialMessage || 'Process this task') : 'Process this task';
for (const nodeId of executionOrder) {
const node = $swarmAgents.find(n => n.id === nodeId);
if (!node) continue;
await executeNode(node, initialMessage);
}
showToastMessage('✅ Swarm execution complete', 'success');
} catch (error) {
showToastMessage(`❌ Execution failed: ${error.message}`, 'error');
} finally {
running = false;
}
}

function buildTopologicalOrder(): string[] {
const inDegree = new Map<string, number>();
const adjList = new Map<string, string[]>();
for (const node of $swarmAgents) {
inDegree.set(node.id, 0);
adjList.set(node.id, []);
}
for (const edge of $swarmEdges) {
adjList.get(edge.source)?.push(edge.target);
inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
}
const queue: string[] = [];
for (const [nodeId, degree] of inDegree.entries()) {
if (degree === 0) queue.push(nodeId);
}
const order: string[] = [];
while (queue.length > 0) {
const nodeId = queue.shift()!;
order.push(nodeId);
const neighbors = adjList.get(nodeId) || [];
for (const neighbor of neighbors) {
const newDegree = (inDegree.get(neighbor) || 1) - 1;
inDegree.set(neighbor, newDegree);
if (newDegree === 0) queue.push(neighbor);
}
}
return order;
}

async function executeNode(node: SwarmNode, initialMessage: string) {
const startTime = Date.now();
executionLog = executionLog.map(entry => entry.nodeId === node.id ? { ...entry, status: 'running' as const, timestamp: new Date() } : entry);
updateAgentStatus(node.id, 'running');
try {
const parentEdges = $swarmEdges.filter(e => e.target === node.id);
let nodeInput = parentEdges.length === 0 ? initialMessage : (parentEdges.map(e => nodeOutputs.get(e.source)).filter((o): o is string => o !== undefined).join('\n\n---\n\n') || initialMessage);
let output = node.type === 'agent' ? await executeAgent(node, nodeInput) : node.type === 'input' ? nodeInput : `Final Output:\n\n${nodeInput}`;
nodeOutputs.set(node.id, output);
const duration = Date.now() - startTime;
executionLog = executionLog.map(entry => entry.nodeId === node.id ? { ...entry, status: 'done' as const, output: output.substring(0, 200), duration, message: `Completed in ${(duration / 1000).toFixed(2)}s` } : entry);
updateAgentStatus(node.id, 'completed');
} catch (error) {
const duration = Date.now() - startTime;
executionLog = executionLog.map(entry => entry.nodeId === node.id ? { ...entry, status: 'error' as const, message: error.message, duration } : entry);
updateAgentStatus(node.id, 'error', error.message);
throw error;
}
}

async function executeAgent(node: SwarmNode, input: string): Promise<string> {
if (node.type !== 'agent') return input;
const agentData = node.data as any;
const model = agentData.model || $gatewayConfig.model || 'llama3.1';
const systemPrompt = agentData.systemPrompt || `You are ${agentData.name}, an AI agent.`;
const messages: any[] = [{ role: 'system', content: systemPrompt }];
if (agentData.memory && agentData.memory.length > 0) {
const memoryContext = $memories.filter(m => agentData.memory.includes(m.id)).map(m => `[Memory: ${m.name}]\n${m.content}`).join('\n\n');
if (memoryContext) messages.push({ role: 'system', content: memoryContext });
}
messages.push({ role: 'user', content: input });
const response = await fetch(`${$gatewayConfig.url || 'http://127.0.0.1:3000'}/v1/chat/completions`, {
method: 'POST',
headers: { 'Content-Type': 'application/json', ...($gatewayConfig.bearerToken && { 'Authorization': `Bearer ${$gatewayConfig.bearerToken}` }) },
body: JSON.stringify({ model, messages, temperature: 0.7 }),
signal: AbortSignal.timeout(60000)
});
if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
const data = await response.json();
return data.choices?.[0]?.message?.content || 'No response';
}

function clearExecutionLog() {
executionLog = [];
nodeOutputs.clear();
showExecutionPanel = false;
for (const node of $swarmAgents) updateAgentStatus(node.id, 'idle');
}

// Add new agent node
function addAgent() {
const newAgent = createAgentNode(
'New Agent',
$gatewayConfig.model || 'llama3.1',
{ x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 }
);
swarmAgents.update(agents => [...agents, newAgent]);
showToastMessage('✅ Agent added', 'success');
}

// Add input node
function addInput() {
const newInput = createInputNode(
'New Input',
{ x: 50 + Math.random() * 100, y: 200 + Math.random() * 100 }
);
swarmAgents.update(agents => [...agents, newInput]);
showToastMessage('✅ Input node added', 'success');
}

// Add output node
function addOutput() {
const newOutput = createOutputNode(
'New Output',
{ x: 600 + Math.random() * 100, y: 200 + Math.random() * 100 }
);
swarmAgents.update(agents => [...agents, newOutput]);
showToastMessage('✅ Output node added', 'success');
}


// Click handler for opening editors
let lastClickTime = 0;
let lastClickedNodeId = '';


// Handle edit button click from node components
function handleNodeEdit(event: any) {
  const { id, data } = event.detail;
  const node = $swarmAgents.find(n => n.id === id);
  if (!node) return;
  
  console.log('?? Edit button clicked for node:', id, node.type);
  
  if (node.type === 'input') {
    editingInput = node;
    inputLabel = node.data.label || '';
    inputMessage = node.data.initialMessage || '';
    showInputEditor = true;
    console.log('?? Opening input editor');
  }
}

function handleNodeClick(event: any) {
  const node = event.detail?.node || event.detail;
  if (!node) return;
  
  const now = Date.now();
  const timeDiff = now - lastClickTime;
  
  // Double-click detection (within 300ms)
  if (timeDiff < 300 && lastClickedNodeId === node.id) {
    console.log('?? Double-click detected on node:', node.id, node.type);
    handleNodeDoubleClick(event);
  }
  
  lastClickTime = now;
  lastClickedNodeId = node.id;
}

// Handle node double-click to open editor
function handleNodeDoubleClick(event: any) {
  console.log('?? Double-click event:', event);
  const node = event.detail?.node || event.detail;
  console.log('?? Node:', node, 'Type:', node?.type);
if (!node) return;
  
if (node.type === 'agent') {
editingAgent = node;
agentName = node.data.name || '';
agentModel = node.data.model || '';
agentSystemPrompt = node.data.systemPrompt || '';
agentTools = [...(node.data.tools || [])];
agentMemories = [...(node.data.memory || [])];
showAgentEditor = true;
} else if (node.type === 'input') {
editingInput = node;
inputLabel = node.data.label || '';
inputMessage = node.data.initialMessage || '';
showInputEditor = true;
}
}

// Save agent changes
function saveAgentChanges() {
if (!editingAgent) return;
swarmAgents.update(agents =>
agents.map(agent => {
if (agent.id === editingAgent.id && agent.type === 'agent') {
return {
...agent,
data: {
...agent.data,
name: agentName,
model: agentModel,
systemPrompt: agentSystemPrompt,
tools: agentTools,
memory: agentMemories
}
};
}
return agent;
})
);
showAgentEditor = false;
editingAgent = null;
showToastMessage('✅ Agent updated', 'success');
}

// Save input changes
function saveInputChanges() {
if (!editingInput) return;
  
swarmAgents.update(agents =>
agents.map(agent => {
if (agent.id === editingInput.id && agent.type === 'input') {
return {
...agent,
data: {
...agent.data,
label: inputLabel,
initialMessage: inputMessage
}
};
}
return agent;
})
);
  
showInputEditor = false;
editingInput = null;
showToastMessage('✅ Input updated', 'success');
}

// Delete agent
function deleteAgent() {
if (!editingAgent || !confirm('Delete this agent?')) return;
swarmAgents.update(agents => agents.filter(a => a.id !== editingAgent.id));
swarmEdges.update(edges => edges.filter(e =>
e.source !== editingAgent.id && e.target !== editingAgent.id
));
showAgentEditor = false;
editingAgent = null;
showToastMessage('✅ Agent deleted', 'success');
}

// Toggle tool selection
function toggleTool(tool: string) {
if (agentTools.includes(tool)) {
agentTools = agentTools.filter(t => t !== tool);
} else {
agentTools = [...agentTools, tool];
}
}

// Toggle memory selection
function toggleMemory(memoryId: string) {
if (agentMemories.includes(memoryId)) {
agentMemories = agentMemories.filter(m => m !== memoryId);
} else {
agentMemories = [...agentMemories, memoryId];
}
}

// Handle new connection
function handleConnect(event: any) {
const connection = event.detail;
const newEdge = {
id: `e-${connection.source}-${connection.target}`,
source: connection.source,
target: connection.target,
type: 'smoothstep'
};
swarmEdges.update(edges => [...edges, newEdge]);
showToastMessage('✅ Connection created', 'success');
}

// Handle node drag stop
function handleNodeDragStop(event: any) {
swarmAgents.update(agents => [...agents]);
}

// Clear canvas
function clearCanvas() {
if (confirm('Clear all nodes and connections?')) {
clearSwarm();
showToastMessage('✅ Canvas cleared', 'success');
}
}

// Validate swarm
function validateAndShowErrors() {
const result = validateSwarm();
if (!result.valid) {
showToastMessage(`❌ Validation failed:\n${result.errors.join('\n')}`, 'error');
} else {
showToastMessage('✅ Swarm is valid', 'success');
}
}

// Export config
function exportConfig() {
showExportModal = true;
}

function downloadConfig() {
exporting = true;
try {
const config = {
agents: {
swarm: $swarmAgents.map(node => ({
id: node.id,
type: node.type,
name: node.data.name || node.data.label,
...(node.type === 'agent' && {
model: node.data.model,
systemPrompt: node.data.systemPrompt,
tools: node.data.tools,
memory: node.data.memory
}),
position: node.position
})),
connections: $swarmEdges.map(edge => ({
from: edge.source,
to: edge.target,
type: 'delegate'
}))
}
};
const content = exportFormat === 'json'
? JSON.stringify(config, null, 2)
: jsonToYaml(config);
const blob = new Blob([content], {
type: exportFormat === 'json' ? 'application/json' : 'text/yaml'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `nullclaw-swarm.${exportFormat}`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
showToastMessage(`✅ Config exported`, 'success');
showExportModal = false;
} catch (error) {
showToastMessage(`❌ Export failed: ${error.message}`, 'error');
} finally {
exporting = false;
}
}

function jsonToYaml(obj: any, indent = 0): string {
const spaces = '  '.repeat(indent);
let yaml = '';
for (const [key, value] of Object.entries(obj)) {
if (value === null || value === undefined) {
yaml += `${spaces}${key}: null\n`;
} else if (typeof value === 'object' && !Array.isArray(value)) {
yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
} else if (Array.isArray(value)) {
yaml += `${spaces}${key}:\n`;
value.forEach(item => {
if (typeof item === 'object') {
yaml += `${spaces}  -\n${jsonToYaml(item, indent + 2).replace(/^/gm, '  ')}`;
} else {
yaml += `${spaces}  - ${item}\n`;
}
});
} else if (typeof value === 'string') {
yaml += `${spaces}${key}: "${value}"\n`;
} else {
yaml += `${spaces}${key}: ${value}\n`;
}
}
return yaml;
}

function showToastMessage(message: string, type: 'success' | 'error') {
toastMessage = message;
toastType = type;
showToast = true;
setTimeout(() => {
showToast = false;
}, 4000);
}
</script>

{#if !mounted}
<div class="min-h-screen flex items-center justify-center">
<div class="text-center">
<div class="text-4xl mb-4">⏳</div>
<p class="text-gray-400">Initializing...</p>
</div>
</div>
{:else if !loaded}
<div class="min-h-screen flex items-center justify-center">
<div class="text-center">
<div class="text-6xl mb-4 animate-spin">🔄</div>
<p class="text-gray-400 font-semibold">Loading Swarm Canvas...</p>
</div>
</div>
{:else}
<div class="min-h-screen flex flex-col">
<header class="glass border-b border-nebula-primary/20 p-4">
<div class="max-w-7xl mx-auto flex items-center justify-between">
<div class="flex items-center gap-4">
<a href="/" class="glass px-4 py-2 rounded-lg hover:bg-nebula-primary/20 transition-all flex items-center gap-2">
<span class="text-xl">←</span>
<span>Back</span>
</a>
<h1 class="text-2xl font-bold">Swarm Forge</h1>
<span class="text-sm text-gray-400">{nodes.length} nodes, {edges.length} connections</span>
</div>
<div class="flex gap-2">
<button on:click={addInput} title="Add an Input node" class="px-4 py-2 glass hover:bg-green-500/20 rounded-lg border border-green-500/30 hover:border-green-500/60 transition-all">📥 Input</button>
<button on:click={addAgent} title="Add an Agent node" class="px-4 py-2 bg-nebula-primary hover:bg-nebula-primaryLight rounded-lg font-semibold">🤖 Add Agent</button>
<button on:click={addOutput} title="Add an Output node" class="px-4 py-2 glass hover:bg-blue-500/20 rounded-lg border border-blue-500/30 hover:border-blue-500/60 transition-all">📤 Output</button>
<button on:click={validateAndShowErrors} title="Validate" class="px-4 py-2 glass hover:bg-nebula-accent/20 rounded-lg border border-nebula-accent/30 hover:border-nebula-accent/60 transition-all">✓ Validate</button>
<button on:click={runSwarm} disabled={running} class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold">{running ? '⏳ Running...' : '▶ Run Swarm'}</button>
<button on:click={() => showExecutionPanel = !showExecutionPanel} title="Toggle log" class="px-4 py-2 glass hover:bg-nebula-accent/20 rounded-lg border border-nebula-accent/30 hover:border-nebula-accent/60 transition-all">{showExecutionPanel ? '📋 Hide Log' : '📋 Show Log'}</button>
<button on:click={exportConfig} title="Export" class="px-4 py-2 glass hover:bg-nebula-card rounded-lg border border-nebula-primary/30 hover:border-nebula-primary/60 transition-all">💾 Export</button>
<button on:click={clearCanvas} title="Clear" class="px-4 py-2 glass hover:bg-red-500/20 rounded-lg text-red-400 border border-red-500/30 hover:border-red-500/60 transition-all">🗑️ Clear</button>
<button on:click={() => showQuickStart = !showQuickStart} title="Help" class="px-4 py-2 glass hover:bg-nebula-accent/20 rounded-lg border border-nebula-accent/30 hover:border-nebula-accent/60 transition-all flex items-center gap-1"><span class="text-lg">❓</span> Help</button>
</div>
</div>
</header>

<div class="flex-1 relative min-h-[600px]">
{#if SvelteFlow && Background && Controls}
<div class="absolute inset-0 glass">
<SvelteFlow {nodes} {edges} {nodeTypes} fitView={true} nodesDraggable={true} nodesConnectable={true} elementsSelectable={true} nodesDblClickable={false} on:nodedragstop={handleNodeDragStop} on:connect={handleConnect} on:nodeclick={handleNodeClick} on:nodedoubleclick={handleNodeDoubleClick}>
<Background /><Controls />
</SvelteFlow>
</div>
{#if nodes.length === 0}
<div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
<div class="text-center">
<div class="text-6xl mb-4">🔄</div>
<p class="text-xl text-gray-300 font-semibold">Start by adding an Input node</p>
<p class="text-sm text-gray-400 mt-2">Then connect it to an Agent, and finally to an Output</p>
<p class="text-xs text-gray-500 mt-4">💡 Tip: Drag from a node's edge to create connections</p>
</div>
</div>
{/if}
{:else if loadError}
<div class="absolute inset-0 glass flex items-center justify-center">
<div class="text-center text-red-400">
<div class="text-6xl mb-4">❌</div>
<h2 class="text-2xl font-bold mb-2">Failed to Load Canvas</h2>
<p class="text-sm">{loadError}</p>
</div>
</div>
{/if}
</div>

<div class="absolute right-4 top-24 w-64 glass p-4 rounded-xl">
<h3 class="font-bold mb-3">Quick Help</h3>
<div class="text-sm text-gray-400 space-y-2">
<p>• <span class="text-nebula-accent">Double-click</span> agent to edit</p>
<p>• <span class="text-nebula-accent">Double-click</span> input to edit its message</p>
<p>• <span class="text-nebula-accent">Drag</span> from node edge to connect</p>
<p>• <span class="text-nebula-accent">Select & Delete</span> to remove</p>
<p>• <span class="text-nebula-accent">Scroll</span> to zoom</p>
<p>• <span class="text-green-500">Run Swarm</span> executes the workflow</p>
</div>
</div>

{#if showExecutionPanel}
<div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-3/4 max-h-80 overflow-y-auto glass border border-nebula-primary/20 rounded-xl p-4 z-10">
<div class="flex justify-between items-center mb-3"><h3 class="font-bold text-nebula-accent">Execution Log</h3><button on:click={() => showExecutionPanel = false} title="Close" class="text-gray-400 hover:text-white">✕</button></div>
{#if executionLog.length === 0}<p class="text-gray-400 text-sm text-center py-4">No executions yet. Click "Run Swarm" to start.</p>
{:else}
<div class="space-y-3">{#each executionLog as entry (entry.timestamp)}<div class="border-l-4 p-3 rounded-lg text-sm" class:border-green-500={entry.status==='done'} class:border-yellow-500={entry.status==='running'} class:border-red-500={entry.status==='error'} class:border-gray-500={entry.status==='pending'}>
<div class="flex justify-between"><span class="font-semibold">{entry.nodeName}</span><span class="text-xs text-gray-400">{entry.timestamp.toLocaleTimeString()}</span></div>
{#if entry.message}<p class="text-gray-300 mt-1">{entry.message}</p>{/if}
{#if entry.output}<pre class="mt-2 text-xs bg-black/30 p-2 rounded max-h-24 overflow-auto">{entry.output}</pre>{/if}
{#if entry.duration}<p class="text-xs text-gray-400 mt-1">⏱ {entry.duration}ms</p>{/if}
</div>{/each}</div>
{/if}
</div>
{/if}
</div>

{#if showAgentEditor && editingAgent}
<div class="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
<div class="glass max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-xl">
<div class="p-6 border-b border-nebula-primary/20 sticky top-0 glass"><h2 class="text-2xl font-bold">Edit Agent</h2><p class="text-sm text-gray-400 mt-1">Configure agent properties, tools, and memory</p></div>
<div class="p-6 space-y-6">
<div class="space-y-4"><div><label class="block text-sm text-gray-400 mb-2">Agent Name</label><input type="text" bind:value={agentName} class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary" placeholder="e.g., Code Reviewer, Research Assistant"/></div>
<div><label class="block text-sm text-gray-400 mb-2">Model</label><input type="text" bind:value={agentModel} class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary" placeholder="e.g., deepseek-coder:6.7b, llama3.1, gpt-4o"/><p class="text-xs text-gray-500 mt-1">Examples: llama3.1, deepseek-coder:6.7b, anthropic/claude-sonnet-4, openai/gpt-4o</p></div>
<div><label class="block text-sm text-gray-400 mb-2">System Prompt</label><textarea bind:value={agentSystemPrompt} rows="4" class="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-nebula-primary font-mono text-sm" placeholder="You are a helpful AI assistant specialized in..."></textarea><p class="text-xs text-gray-500 mt-1">Define the agent's role, expertise, and behavior</p></div></div>
<div><label class="block text-sm text-gray-400 mb-3">Tools</label><div class="grid grid-cols-2 gap-3">{#each AVAILABLE_TOOLS as tool}<button on:click={() => toggleTool(tool)} class={`p-3 rounded-lg border-2 transition-all text-left ${agentTools.includes(tool) ? 'border-nebula-accent bg-nebula-accent/20' : 'border-nebula-primary/20 glass hover:border-nebula-primary/40'}`}><div class="flex items-center gap-2"><span class="text-lg">{agentTools.includes(tool) ? '✓' : '○'}</span><span class="font-semibold text-sm">{tool}</span></div></button>{/each}</div><p class="text-xs text-gray-500 mt-2">Selected: {agentTools.length} tool{agentTools.length !== 1 ? 's' : ''}</p></div>
<div><label class="block text-sm text-gray-400 mb-3">Memory Vault</label>{#if $memories.length > 0}<div class="space-y-2 max-h-48 overflow-y-auto">{#each $memories as memory}<button on:click={() => toggleMemory(memory.id)} class={`w-full p-3 rounded-lg border-2 transition-all text-left ${agentMemories.includes(memory.id) ? 'border-nebula-accent bg-nebula-accent/20' : 'border-nebula-primary/20 glass hover:border-nebula-primary/40'}`}><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="text-lg">{agentMemories.includes(memory.id) ? '✓' : '○'}</span><div><div class="font-semibold text-sm">{memory.name}</div><div class="text-xs text-gray-400">{memory.type} • {(memory.size / 1024).toFixed(1)} KB</div></div></div></div></button>{/each}</div><p class="text-xs text-gray-500 mt-2">Selected: {agentMemories.length} memor{agentMemories.length !== 1 ? 'ies' : 'y'}</p>{:else}<div class="glass p-4 rounded-lg text-center text-gray-400 text-sm"><p>No memories in vault</p><p class="text-xs mt-1">Upload memories in Memory Vault to inject them into agents</p></div>{/if}</div>
<div class="glass p-4 rounded-lg"><div class="text-xs text-gray-400 space-y-1"><p><span class="text-nebula-accent">ID:</span> {editingAgent.id}</p><p><span class="text-nebula-accent">Type:</span> {editingAgent.type}</p><p><span class="text-nebula-accent">Position:</span> ({editingAgent.position.x.toFixed(0)}, {editingAgent.position.y.toFixed(0)})</p></div></div>
</div>
<div class="p-6 border-t border-nebula-primary/20 flex gap-3 sticky bottom-0 glass"><button on:click={() => { showAgentEditor = false; editingAgent = null; }} class="flex-1 px-4 py-3 glass hover:bg-nebula-card rounded-lg">Cancel</button><button on:click={deleteAgent} class="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold">Delete</button><button on:click={saveAgentChanges} class="flex-1 px-4 py-3 bg-nebula-primary hover:bg-nebula-primaryLight rounded-lg font-semibold">Save Changes</button></div>
</div></div>
{/if}

{#if showInputEditor && editingInput}
<div class="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
<div class="glass max-w-md w-full p-6 rounded-xl">
<div class="flex items-center gap-3 mb-6"><div class="text-2xl">📥</div><h2 class="text-xl font-bold text-nebula-secondary">Edit Input Node</h2></div>
<div class="space-y-4">
<div><label class="block text-sm font-medium text-gray-300 mb-2">Label</label><input type="text" bind:value={inputLabel} placeholder="e.g., User Input" class="w-full px-3 py-2 glass rounded-lg border border-nebula-primary/30 focus:border-nebula-accent focus:outline-none"/></div>
<div><label class="block text-sm font-medium text-gray-300 mb-2">Initial Message</label><textarea bind:value={inputMessage} placeholder="Enter the initial message or prompt..." rows="4" class="w-full px-3 py-2 glass rounded-lg border border-nebula-primary/30 focus:border-nebula-accent focus:outline-none resize-none"></textarea><p class="text-xs text-gray-400 mt-1">This message will be sent to connected agents when the swarm runs.</p></div>
</div>
<div class="flex gap-3 mt-6"><button on:click={() => { showInputEditor = false; editingInput = null; }} class="flex-1 px-4 py-3 glass hover:bg-nebula-card rounded-lg">Cancel</button><button on:click={saveInputChanges} class="flex-1 px-4 py-3 bg-nebula-accent hover:bg-nebula-accent/80 rounded-lg font-medium">Save Changes</button></div>
</div></div>
{/if}

{#if showExportModal}
<div class="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
<div class="glass max-w-2xl w-full p-8 rounded-xl"><h2 class="text-2xl font-bold mb-4">Export Swarm Configuration</h2><p class="text-gray-400 mb-6">Export your swarm configuration as a file.</p>
<div class="mb-6"><label class="block text-sm text-gray-400 mb-2">Export Format</label><div class="flex gap-4"><label class="flex items-center gap-2 cursor-pointer"><input type="radio" bind:group={exportFormat} value="json" class="w-4 h-4"/><span>JSON</span></label><label class="flex items-center gap-2 cursor-pointer"><input type="radio" bind:group={exportFormat} value="yaml" class="w-4 h-4"/><span>YAML</span></label></div></div>
<div class="grid grid-cols-3 gap-4 mb-6"><div class="glass p-4 rounded-lg"><div class="text-2xl font-bold text-nebula-primary">{nodes.length}</div><div class="text-sm text-gray-400">Nodes</div></div><div class="glass p-4 rounded-lg"><div class="text-2xl font-bold text-nebula-accent">{edges.length}</div><div class="text-sm text-gray-400">Connections</div></div><div class="glass p-4 rounded-lg"><div class="text-2xl font-bold text-nebula-secondary">{nodes.filter(n => n.type === 'agent').length}</div><div class="text-sm text-gray-400">Agents</div></div></div>
<div class="flex gap-3"><button on:click={() => showExportModal = false} class="flex-1 px-4 py-3 glass hover:bg-nebula-card rounded-lg" disabled={exporting}>Cancel</button><button on:click={downloadConfig} disabled={exporting} class="flex-1 px-4 py-3 bg-nebula-primary hover:bg-nebula-primaryLight disabled:opacity-50 rounded-lg font-semibold">{exporting ? 'Exporting...' : 'Download File'}</button></div>
</div></div>
{/if}

{#if showToast}
<div class="fixed bottom-8 right-8 z-50 animate-slide-up">
<div class={`glass px-6 py-4 rounded-lg border-2 ${toastType === 'success' ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'} min-w-[300px]`}>
<p class={`font-semibold ${toastType === 'success' ? 'text-green-500' : 'text-red-500'}`}>{toastMessage}</p>
</div></div>
{/if}
{/if}

<style>
:global(.svelte-flow) { background: transparent !important; }
:global(.svelte-flow__node) { background: rgba(17, 17, 24, 0.9) !important; border: 2px solid rgba(124, 58, 237, 0.3) !important; border-radius: 12px !important; color: #e0e0ff !important; padding: 12px !important; }
:global(.svelte-flow__node:hover) { border-color: rgba(124, 58, 237, 0.8) !important; box-shadow: 0 0 20px rgba(124, 58, 237, 0.5) !important; }
:global(.svelte-flow__edge-path) { stroke: rgba(124, 58, 237, 0.6) !important; stroke-width: 2px !important; }
:global(.svelte-flow__controls) { left: 50% !important; bottom: 12px !important; transform: translateX(-50%) !important; display: flex !important; flex-direction: row !important; gap: 4px !important; background: rgba(17, 17, 24, 0.9) !important; border: 1px solid rgba(124, 58, 237, 0.3) !important; border-radius: 8px !important; padding: 4px !important; }
:global(.svelte-flow__controls button) { background: transparent !important; border: none !important; color: #a78bfa !important; fill: #a78bfa !important; }
:global(.svelte-flow__controls button:hover) { background: rgba(124, 58, 237, 0.2) !important; border-radius: 4px !important; }
@keyframes slide-up { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.animate-slide-up { animation: slide-up 0.3s ease-out; }
:global(.svelte-flow__handle) { width: 12px !important; height: 12px !important; background: #7c3aed !important; border: 2px solid #00f0ff !important; transition: all 0.2s ease !important; }
:global(.svelte-flow__handle:hover) { transform: scale(1.5) !important; background: #00f0ff !important; border-color: #7c3aed !important; box-shadow: 0 0 12px rgba(0, 240, 255, 0.6) !important; }
:global(.svelte-flow__handle-connecting) { background: #00f0ff !important; animation: pulse 1s infinite !important; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>

