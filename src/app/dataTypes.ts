/** Stable IDs, rather than names, connect schema fields to record values. */
export type DataType = 'text' | 'number' | 'boolean';
export type DataValue = string | number | boolean | null;
export interface DataEntity {
    id: string;
    name: string;
}
export interface DataField extends DataEntity {
    entityId: string;
    type: DataType;
    required: boolean;
}
export interface DataRecord {
    id: string;
    entityId: string;
    /** Rows show in this order; ties (from concurrent adds) fall back to the ID. */
    order: number;
    values: Record<string, DataValue>;
}
