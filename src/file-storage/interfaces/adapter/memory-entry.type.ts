export type MemoryEntry =
    | { kind: 'directory'; children: Map<string, MemoryEntry>; }
    | { kind: 'file'; data: Blob; lastModified: number; };
