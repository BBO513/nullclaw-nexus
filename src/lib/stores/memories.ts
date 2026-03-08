import { writable } from 'svelte/store';

export interface Memory {
  id: string;
  name: string;
  content: string;
  type: 'prompt' | 'knowledge' | 'context';
  size: number;
  createdAt: Date;
  relevance?: number;
}

export const memories = writable<Memory[]>([]);
