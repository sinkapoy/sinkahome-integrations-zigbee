interface IZhmDatabaseEndpointEntry {
    profId: number;
    epId: number;
    devId: number;
    inClusterList: number[];
    outClusterList: number[];
    clusters: Record<string, {
        attributes?: Record<string, any>
    }>;
}

export interface IZhmDatabaseEntry {
    id: number;
    ieeeAddr: string;
    powerSource: string;
    modelId: string;
    endpoints?: Record<number, IZhmDatabaseEndpointEntry>;
}

export interface IZhmDatabase {
    entries: Record<number, IZhmDatabaseEntry>;
}