export interface ReadStreamOptions
{
    start?: number;
    /** Inclusive end, unlike Blob.slice. Defaults to EOF. */
    end?: number;
}
