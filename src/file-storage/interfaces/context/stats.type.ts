export type Stats =
    | {
        readonly kind: 'file';
        readonly size: number;
        readonly lastModified: number;
    }
    | {
        readonly kind: 'directory';
        readonly size: null;
        readonly lastModified: null;
    };
