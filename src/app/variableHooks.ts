// Only the editor page shows variables, so these hooks load with it rather than
// with `hooks.ts`, which every page needs as it opens.
import { useRef } from 'react';
import type { Document, Shape, Variable } from './types';
import { useAppState } from './hooks';
import { bindableProperty, boundVariable } from './variables';

/**
 * `boundVariable` of a shape in the store, reading the property through the store
 * first, since `boundVariable` compares untracked copies: the component then renders
 * again when the property changes, as when a drag ends the binding.
 */
const trackedBoundVariable = (shape: Shape, key: string, document: Document) => {
    bindableProperty(key)?.read(shape, document);

    return boundVariable(shape, key, document);
};

/** The current document's variables, by name. */
export const useVariables = () => {
    return useAppState((state) => {
        const { variables, variablesIds } = state.currentDocument;

        return variablesIds.map((id) => variables[id]);
    });
};

/** How many shape properties follow each variable, by its id. */
export const useVariableUses = () => {
    return useAppState((state) => {
        const document = state.currentDocument;
        const uses: Record<string, number> = {};

        Object.values(document.shapes).forEach((shape) =>
            Object.keys(shape.bindings ?? {}).forEach((key) => {
                const variable = trackedBoundVariable(shape, key, document);

                if (variable) {
                    uses[variable.id] = (uses[variable.id] ?? 0) + 1;
                }
            })
        );

        return uses;
    });
};

/**
 * The variable every selected shape follows for a property, by property key. Like
 * the inspector's values, it is kept during a gesture and found again as it ends.
 */
export const useSelectedVariables = () => {
    const held = useRef<Record<string, Variable>>({});

    return useAppState((state) => {
        const document = state.currentDocument;

        if (state.events.pointer.gesture.kind !== 'idle') {
            return held.current;
        }

        const [first, ...others] = document.selectedShapes;
        const found = Object.keys(first?.bindings ?? {}).flatMap((key) => {
            const variable = trackedBoundVariable(first, key, document);

            return variable &&
                others.every(
                    (shape) => trackedBoundVariable(shape, key, document)?.id === variable.id
                )
                ? [[key, variable] as const]
                : [];
        });

        held.current = Object.fromEntries(found);

        return held.current;
    });
};
