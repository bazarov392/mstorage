import type { MemoryEntry } from './memory-entry.type';

export interface MemoryParent
{
    children: Map<string, MemoryEntry>;
    name: string;
}
