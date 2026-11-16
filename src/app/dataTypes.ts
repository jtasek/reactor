import type { Condition } from './expressions';
/** Stable IDs, rather than names, connect schema fields to record values. */
export type DataType = 'text' | 'number' | 'boolean' | 'choice' | 'reference';
export type DataValue = string | number | boolean | null;
/** Document-local bindings; the instance's component is the repeated item template. */
export interface DataList {
    entityId: string;
    /** Exposed component property ID → entity field ID. */
    fields: Record<string, string>;
    gap: number;
    /** Omitted repeats all records; record shows the record selected during navigation. */
    mode?: 'record';
}
interface Named {
    id: string;
    name: string;
}
export interface DataEntity extends Named {
    /** The text field that names a record wherever a reference shows it; else the first. */
    labelFieldId?: string;
}
/**
 * Choice values are one of `options`; reference values are a record ID of `targetEntityId`.
 * Both settings stay when the type changes, so changing it back loses nothing.
 */
export interface DataField extends Named {
    entityId: string;
    type: DataType;
    required: boolean;
    options?: string[];
    targetEntityId?: string;
}
export interface DataRecord {
    id: string;
    entityId: string;
    /** Rows show in this order; ties (from concurrent adds) fall back to the ID. */
    order: number;
    values: Record<string, DataValue>;
}
/**
 * A record of `entityId` is valid only while `check` holds, or when `when` is set and doesn't
 * hold. Forms refuse to save a record that breaks a rule and show `message` at `fieldId`, or
 * for the whole record without one. Field operands name fields of the same entity.
 */
export interface DataRule {
    id: string;
    entityId: string;
    when?: Condition;
    check: Condition;
    message: string;
    fieldId?: string;
    /** Rules show in this order. */
    order: number;
}
