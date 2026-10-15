import type { Component, ShapeInput, VariableType } from './types';

/** Who made a batch: the person using this copy, or an AI request they accepted. */
export type Provenance = { kind: 'person' } | { kind: 'ai'; model: string; requestId: string };

/**
 * A reference is an ID the document has, or the key of a record an earlier
 * operation of the same batch adds. Templates are text: their `${...}` parts may
 * hold any variable key of the batch, and a part holding none stays as written.
 */
export interface AddVariable {
    op: 'addVariable';
    key: string;
    name: string;
    type: VariableType;
    value: unknown;
}

/** Adds a component copied from a library, which keeps its ID. */
export interface AddComponent {
    op: 'addComponent';
    component: Component;
}

/** Adds a shape on top of the others; its bindings, overrides and component are references. */
export interface AddShape {
    op: 'addShape';
    key: string;
    shape: ShapeInput;
}

export interface AddGroup {
    op: 'addGroup';
    name: string;
    rotation: number;
    shapes: string[];
}

export type Operation = AddVariable | AddComponent | AddShape | AddGroup;

export interface Batch {
    documentId: string;
    by: Provenance;
    operations: Operation[];
}

/** Whether a batch would apply, or why not: the operation, by its place in the batch, and the problem. */
export type OperationsCheck =
    | { valid: true }
    | { valid: false; operation?: number; problem: string };

/** The IDs of the records a batch added, by key, or why none of it was applied. */
export type BatchResult =
    | { applied: true; ids: Record<string, string> }
    | { applied: false; problem: string };
