import { writable } from 'svelte/store';

// Agent node interface
export interface AgentNode {
	id: string;
	type: 'agent';
	data: {
		name: string;
		model: string; // e.g., 'deepseek-coder:6.7b', 'llama3.1', 'gpt-4o'
		systemPrompt: string;
		tools: string[]; // e.g., ['web_search', 'file_read', 'code_execute']
		memory?: string[]; // Memory IDs to inject from memory vault
		status?: 'idle' | 'running' | 'completed' | 'error';
		lastOutput?: string; // Last execution output
		executionTime?: number; // Execution time in ms
		errorMessage?: string; // Error details if status is 'error'
	};
	position: { x: number; y: number };
}

// Input node interface
export interface InputNode {
	id: string;
	type: 'input';
	data: {
		name: string;
		label: string;
		initialMessage?: string;
		status?: 'idle' | 'running' | 'completed' | 'error';
	};
	position: { x: number; y: number };
}

// Output node interface
export interface OutputNode {
	id: string;
	type: 'output';
	data: {
		name: string;
		label: string;
		format?: 'text' | 'json' | 'markdown';
		status?: 'idle' | 'running' | 'completed' | 'error';
		result?: string;
	};
	position: { x: number; y: number };
}

// Union type for all node types
export type SwarmNode = AgentNode | InputNode | OutputNode;

// Edge/Connection interface
export interface SwarmEdge {
	id: string;
	source: string; // Source node ID
	target: string; // Target node ID
	type?: 'smoothstep' | 'straight' | 'step';
	label?: string;
	animated?: boolean;
}

// Complete swarm configuration
export interface SwarmConfig {
	id: string;
	name: string;
	description?: string;
	nodes: SwarmNode[];
	edges: SwarmEdge[];
	createdAt: Date;
	updatedAt: Date;
	version: string; // e.g., '1.0.0'
}

// Execution log entry
export interface ExecutionLogEntry {
	nodeId: string;
	nodeName: string;
	status: 'pending' | 'running' | 'done' | 'error';
	message?: string;
	timestamp: Date;
	duration?: number; // ms
}

// Swarm execution state
export interface SwarmExecution {
	swarmId: string;
	status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
	startedAt?: Date;
	completedAt?: Date;
	log: ExecutionLogEntry[];
	currentNodeId?: string;
}

// Load swarm agents from localStorage
function loadSwarmAgents(): SwarmNode[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const saved = localStorage.getItem('nullclaw_swarm_agents');
		if (!saved) return [];
		const parsed = JSON.parse(saved);
		return parsed.map((node: any) => ({
			...node,
			data: {
				...node.data,
				status: node.data.status || 'idle'
			}
		}));
	} catch (error) {
		console.error('Failed to load swarm agents from localStorage:', error);
		return [];
	}
}

// Load swarm edges from localStorage
function loadSwarmEdges(): SwarmEdge[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const saved = localStorage.getItem('nullclaw_swarm_edges');
		if (!saved) return [];
		return JSON.parse(saved);
	} catch (error) {
		console.error('Failed to load swarm edges from localStorage:', error);
		return [];
	}
}

// Load swarm configs from localStorage
function loadSwarmConfigs(): SwarmConfig[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const saved = localStorage.getItem('nullclaw_swarm_configs');
		if (!saved) return [];
		const parsed = JSON.parse(saved);
		return parsed.map((config: any) => ({
			...config,
			createdAt: new Date(config.createdAt),
			updatedAt: new Date(config.updatedAt)
		}));
	} catch (error) {
		console.error('Failed to load swarm configs from localStorage:', error);
		return [];
	}
}

// Swarm agents store (current working nodes)
export const swarmAgents = writable<SwarmNode[]>(loadSwarmAgents());

// Swarm edges store (current working connections)
export const swarmEdges = writable<SwarmEdge[]>(loadSwarmEdges());

// Swarm configs store (saved swarm templates)
export const swarmConfigs = writable<SwarmConfig[]>(loadSwarmConfigs());

// Current swarm execution state
export const swarmExecution = writable<SwarmExecution>({
	swarmId: '',
	status: 'idle',
	log: []
});

// Persist agents to localStorage on changes
swarmAgents.subscribe(value => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem('nullclaw_swarm_agents', JSON.stringify(value));
		} catch (error) {
			console.error('Failed to save swarm agents to localStorage:', error);
		}
	}
});

// Persist edges to localStorage on changes
swarmEdges.subscribe(value => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem('nullclaw_swarm_edges', JSON.stringify(value));
		} catch (error) {
			console.error('Failed to save swarm edges to localStorage:', error);
		}
	}
});

// Persist configs to localStorage on changes
swarmConfigs.subscribe(value => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem('nullclaw_swarm_configs', JSON.stringify(value));
		} catch (error) {
			console.error('Failed to save swarm configs to localStorage:', error);
		}
	}
});

// Helper functions

/**
 * Create a new agent node with default values
 */
export function createAgentNode(
	name: string,
	model: string,
	position: { x: number; y: number }
): AgentNode {
	return {
		id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		type: 'agent',
		data: {
			name,
			model,
			systemPrompt: `You are ${name}, an AI agent specialized in your assigned role.`,
			tools: [],
			memory: [],
			status: 'idle'
		},
		position
	};
}

/**
 * Create a new input node
 */
export function createInputNode(
	name: string,
	position: { x: number; y: number }
): InputNode {
	return {
		id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		type: 'input',
		data: {
			name,
			label: name,
			status: 'idle'
		},
		position
	};
}

/**
 * Create a new output node
 */
export function createOutputNode(
	name: string,
	position: { x: number; y: number }
): OutputNode {
	return {
		id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		type: 'output',
		data: {
			name,
			label: name,
			format: 'text',
			status: 'idle'
		},
		position
	};
}

/**
 * Update agent node status
 */
export function updateAgentStatus(
	nodeId: string,
	status: 'idle' | 'running' | 'completed' | 'error',
	errorMessage?: string
) {
	swarmAgents.update(agents =>
		agents.map(agent => {
			if (agent.id === nodeId && agent.type === 'agent') {
				return {
					...agent,
					data: {
						...agent.data,
						status,
						errorMessage: status === 'error' ? errorMessage : undefined
					}
				};
			}
			return agent;
		})
	);
}

/**
 * Update agent output after execution
 */
export function updateAgentOutput(
	nodeId: string,
	output: string,
	executionTime: number
) {
	swarmAgents.update(agents =>
		agents.map(agent => {
			if (agent.id === nodeId && agent.type === 'agent') {
				return {
					...agent,
					data: {
						...agent.data,
						lastOutput: output,
						executionTime,
						status: 'completed'
					}
				};
			}
			return agent;
		})
	);
}

/**
 * Reset all agent statuses to idle
 */
export function resetAllAgentStatuses() {
	swarmAgents.update(agents =>
		agents.map(agent => ({
			...agent,
			data: {
				...agent.data,
				status: 'idle',
				lastOutput: undefined,
				executionTime: undefined,
				errorMessage: undefined
			}
		}))
	);
}

/**
 * Add a tool to an agent
 */
export function addToolToAgent(nodeId: string, tool: string) {
	swarmAgents.update(agents =>
		agents.map(agent => {
			if (agent.id === nodeId && agent.type === 'agent') {
				const tools = agent.data.tools || [];
				if (!tools.includes(tool)) {
					return {
						...agent,
						data: {
							...agent.data,
							tools: [...tools, tool]
						}
					};
				}
			}
			return agent;
		})
	);
}

/**
 * Remove a tool from an agent
 */
export function removeToolFromAgent(nodeId: string, tool: string) {
	swarmAgents.update(agents =>
		agents.map(agent => {
			if (agent.id === nodeId && agent.type === 'agent') {
				return {
					...agent,
					data: {
						...agent.data,
						tools: (agent.data.tools || []).filter(t => t !== tool)
					}
				};
			}
			return agent;
		})
	);
}

/**
 * Add memory to an agent
 */
export function addMemoryToAgent(nodeId: string, memoryId: string) {
	swarmAgents.update(agents =>
		agents.map(agent => {
			if (agent.id === nodeId && agent.type === 'agent') {
				const memory = agent.data.memory || [];
				if (!memory.includes(memoryId)) {
					return {
						...agent,
						data: {
							...agent.data,
							memory: [...memory, memoryId]
						}
					};
				}
			}
			return agent;
		})
	);
}

/**
 * Remove memory from an agent
 */
export function removeMemoryFromAgent(nodeId: string, memoryId: string) {
	swarmAgents.update(agents =>
		agents.map(agent => {
			if (agent.id === nodeId && agent.type === 'agent') {
				return {
					...agent,
					data: {
						...agent.data,
						memory: (agent.data.memory || []).filter(m => m !== memoryId)
					}
				};
			}
			return agent;
		})
	);
}

/**
 * Save current swarm as a config template
 */
export function saveSwarmConfig(name: string, description?: string) {
	let nodes: SwarmNode[] = [];
	let edges: SwarmEdge[] = [];

	swarmAgents.subscribe(value => (nodes = value))();
	swarmEdges.subscribe(value => (edges = value))();

	const config: SwarmConfig = {
		id: `swarm-${Date.now()}`,
		name,
		description,
		nodes,
		edges,
		createdAt: new Date(),
		updatedAt: new Date(),
		version: '1.0.0'
	};

	swarmConfigs.update(configs => [...configs, config]);
	return config;
}

/**
 * Load a swarm config
 */
export function loadSwarmConfig(configId: string) {
	let config: SwarmConfig | undefined;

	swarmConfigs.subscribe(configs => {
		config = configs.find(c => c.id === configId);
	})();

	if (config) {
		swarmAgents.set(config.nodes);
		swarmEdges.set(config.edges);
		return true;
	}

	return false;
}

/**
 * Delete a swarm config
 */
export function deleteSwarmConfig(configId: string) {
	swarmConfigs.update(configs => configs.filter(c => c.id !== configId));
}

/**
 * Clear current swarm (reset to empty)
 */
export function clearSwarm() {
	swarmAgents.set([]);
	swarmEdges.set([]);
	resetAllAgentStatuses();
}

/**
 * Get agent by ID
 */
export function getAgentById(nodeId: string): SwarmNode | undefined {
	let agent: SwarmNode | undefined;
	swarmAgents.subscribe(agents => {
		agent = agents.find(a => a.id === nodeId);
	})();
	return agent;
}

/**
 * Validate swarm configuration
 */
export function validateSwarm(): { valid: boolean; errors: string[] } {
	let nodes: SwarmNode[] = [];
	let edges: SwarmEdge[] = [];

	swarmAgents.subscribe(value => (nodes = value))();
	swarmEdges.subscribe(value => (edges = value))();

	const errors: string[] = [];

	// Check for at least one input node
	const inputNodes = nodes.filter(n => n.type === 'input');
	if (inputNodes.length === 0) {
		errors.push('Swarm must have at least one input node');
	}

	// Check for at least one output node
	const outputNodes = nodes.filter(n => n.type === 'output');
	if (outputNodes.length === 0) {
		errors.push('Swarm must have at least one output node');
	}

	// Check for disconnected nodes
	const connectedNodeIds = new Set<string>();
	edges.forEach(edge => {
		connectedNodeIds.add(edge.source);
		connectedNodeIds.add(edge.target);
	});

	const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
	if (disconnectedNodes.length > 0 && nodes.length > 1) {
		errors.push(`${disconnectedNodes.length} disconnected node(s) found`);
	}

	// Check for cycles (simple check - can be enhanced)
	const hasIncomingEdge = new Set<string>();
	edges.forEach(edge => hasIncomingEdge.add(edge.target));
	const startNodes = nodes.filter(n => !hasIncomingEdge.has(n.id));
	if (startNodes.length === 0 && nodes.length > 0) {
		errors.push('Potential cycle detected - no starting nodes found');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
