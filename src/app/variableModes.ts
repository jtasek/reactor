import { readPackageIdentity } from './packageIdentity';
import type { Document, VariableContext, VariableDimension } from './types';

/** Used only when reading documents created before user-defined dimensions. */
export const legacyTheme = (): VariableDimension => ({
    id: 'theme',
    name: 'Theme',
    order: 0,
    defaultModeId: 'light',
    modes: {
        light: { id: 'light', name: 'Light', order: 0 },
        dark: { id: 'dark', name: 'Dark', order: 1 }
    }
});

export const ordered = <T extends { id: string; order: number }>(items: Record<string, T>): T[] =>
    Object.values(items).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/**
 * The modes values resolve in: each dimension's selected mode, unless it is the default,
 * whose colors are the base values. Missing or deleted selections use the default locally,
 * without repairing shared data.
 */
export function variableContext(
    document: Pick<Document, 'dimensions'>,
    selected: VariableContext = {}
): VariableContext {
    return Object.fromEntries(
        Object.values(document.dimensions).flatMap((dimension) => {
            const modeId = selected[dimension.id];
            return dimension.modes[modeId] && modeId !== dimension.defaultModeId
                ? [[dimension.id, modeId]]
                : [];
        })
    );
}

/** Validate at every persistence/import boundary, without trusting property names. */
export function readDimension(value: unknown): VariableDimension {
    if (!value || typeof value !== 'object') {
        throw new Error('Invalid dimension');
    }
    const d = value as Record<string, unknown>;
    const name = (v: unknown) => {
        if (typeof v !== 'string' || !v.trim() || v.length > 200) {
            throw new Error('Invalid name');
        }

        return v.trim();
    };
    const id = (v: unknown) => {
        const result = name(v);
        if (['default', '__proto__', 'constructor', 'prototype'].includes(result)) {
            throw new Error('Invalid mode ID');
        }

        return result;
    };
    const order = (v: unknown) => {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new Error('Invalid order');
        }

        return v;
    };
    if (!d.modes || typeof d.modes !== 'object' || Array.isArray(d.modes)) {
        throw new Error('Invalid modes');
    }
    const modes = Object.fromEntries(
        Object.entries(d.modes).map(([key, raw]) => {
            if (!raw || typeof raw !== 'object') {
                throw new Error('Invalid mode');
            }
            const mode = raw as Record<string, unknown>;
            if (id(mode.id) !== key) {
                throw new Error('Invalid mode ID');
            }
            if (
                mode.minWidth !== undefined &&
                (typeof mode.minWidth !== 'number' ||
                    !Number.isFinite(mode.minWidth) ||
                    mode.minWidth < 0)
            ) {
                throw new Error('Minimum widths must be finite, non-negative numbers.');
            }

            return [
                key,
                {
                    id: key,
                    name: name(mode.name),
                    order: order(mode.order),
                    ...(mode.minWidth === undefined ? {} : { minWidth: mode.minWidth as number })
                }
            ];
        })
    );
    if (!Object.keys(modes).length || Object.keys(modes).length > 100) {
        throw new Error('A dimension needs modes');
    }
    const defaultModeId = id(d.defaultModeId);
    if (!modes[defaultModeId]) {
        throw new Error('Invalid default mode');
    }
    if (new Set(Object.values(modes).map((mode) => mode.name)).size !== Object.keys(modes).length) {
        throw new Error('Mode names must be unique');
    }
    if (d.selection !== undefined && d.selection !== 'width') {
        throw new Error('Invalid mode selection.');
    }
    const widths = Object.values(modes).flatMap((mode) =>
        mode.minWidth === undefined ? [] : [mode.minWidth]
    );
    if (new Set(widths).size !== widths.length) {
        throw new Error('Each mode must have a different minimum width.');
    }

    return {
        id: id(d.id),
        name: name(d.name),
        order: order(d.order),
        defaultModeId,
        modes,
        ...(d.selection === 'width' ? { selection: 'width' as const } : {}),
        ...(d.source === undefined ? {} : { source: readPackageIdentity(d.source) })
    };
}
