export interface StoragePath
{
    readonly segments: readonly string[];
    readonly path: string;
    readonly directory: boolean;
}
