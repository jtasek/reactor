// Only the editor page shows variables, so these hooks load with it rather than
// with `hooks.ts`, which every page needs as it opens.
import { useRef } from 'react';
import type { Document, Shape, Variable } from './types';
import { useAppState } from './hooks';
import { bindableProperty, templateVariablesIds } from './variables';
import { boundVariable, templateProblems } from './editorVariables';

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

/**
 * How many shape properties and templates use each variable, by its id: those of
 * texts and of other text variables, including through the text variables they hold.
 */
export const useVariableUses = () => {
    return useAppState((state) => {
        const document = state.currentDocument;
        const { variables } = document;
        const uses: Record<string, number> = {};
        const use = (variableId: string) => {
            uses[variableId] = (uses[variableId] ?? 0) + 1;
        };

        Object.values(document.shapes).forEach((shape) => {
            Object.keys(shape.bindings ?? {}).forEach((key) => {
                const variable = trackedBoundVariable(shape, key, document);

                if (variable) {
                    use(variable.id);
                }
            });

            if (shape.type === 'text' && shape.template !== undefined) {
                templateVariablesIds(shape.template, variables).forEach(use);
            }
        });
        Object.values(variables).forEach((variable) => {
            if (variable.type === 'text') {
                templateVariablesIds(variable.values.default, variables).forEach(
                    (variableId) => variableId !== variable.id && use(variableId)
                );
            }
        });

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

/**
 * The names a selected text's template cannot fill in, as it names no variable or a
 * text variable leading back to itself; none unless one text is selected.
 */
export const useTextTemplateProblems = () => {
    return useAppState((state) => {
        const { selectedShapes, variables } = state.currentDocument;
        const [shape, ...others] = selectedShapes;

        return shape?.type === 'text' && shape.template !== undefined && others.length === 0
            ? templateProblems(shape.template, variables)
            : [];
    });
};
