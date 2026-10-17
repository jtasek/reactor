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

/**
 * Changes a variable the document has: its name, its value, or both. A text
 * variable's value is a template, as when added.
 */
export interface UpdateVariable {
    op: 'updateVariable';
    variable: string;
    name?: string;
    value?: unknown;
}

/** Deletes a variable; what followed it keeps its value, as deleting it in the editor does. */
export interface DeleteVariable {
    op: 'deleteVariable';
    variable: string;
}

/**
 * Changes fields of a shape the document has, each as `addShape` takes it; a
 * property explicitly set stops following its variable, even for the same value,
 * unless `changes.bindings` explicitly binds it again. Its type cannot change.
 */
export interface UpdateShape {
    op: 'updateShape';
    shape: string;
    changes: Partial<ShapeInput>;
}

/** Deletes shapes the document has, and the groups this empties. */
export interface DeleteShapes {
    op: 'deleteShapes';
    shapes: string[];
}

/** Deletes a group the document has, keeping its shapes. */
export interface DeleteGroup {
    op: 'deleteGroup';
    group: string;
}

/**
 * Operations that change or delete a record name one the document has, not a
 * key, and each record changes in one operation of a batch at most. Nothing else
 * of the batch may refer to a record it deletes.
 */
export type Operation =
    | AddVariable
    | AddComponent
    | AddShape
    | AddGroup
    | UpdateVariable
    | DeleteVariable
    | UpdateShape
    | DeleteShapes
    | DeleteGroup;

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
