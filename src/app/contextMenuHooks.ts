// Only the editor's context menu reads these, so they load with it rather than with
// `hooks.ts`, which every page needs as it opens.
import { useAppState } from './hooks';
import type { ObjectType } from 'src/ui/components/ObjectTypeSymbol';

export interface MenuTarget {
    name: string;
    type: ObjectType;
    ids: string[];
    rename?: { kind: 'component' | 'group' | 'shape'; id: string; readOnly: boolean };
}

/** What the context menu acts on: the canvas, or the selection with its groups' shapes. */
export const useContextMenuTarget = () =>
    useAppState((state): MenuTarget => {
        const document = state.currentDocument;
        const ids = document.selectedShapesIds;
        const moveIds = [
            ...new Set([
                ...ids,
                ...document.selectedGroupsIds.flatMap((id) => document.groups[id].shapesIds)
            ])
        ];
        const selectedComponent = state.selectedComponent;
        const component = selectedComponent && document.components[selectedComponent.componentId];
        const groupId = document.selectedGroupsIds[0];
        const group = groupId && document.groups[groupId];
        const shape = ids.length === 1 ? document.shapes[ids[0]] : null;

        if (state.ui.contextMenu.target === 'canvas') {
            return { name: 'Canvas', type: 'surface', ids: [] };
        }
        if (component) {
            return {
                name: component.name,
                type: 'component',
                ids: moveIds,
                rename: {
                    kind: 'component',
                    id: component.id,
                    readOnly: Boolean(component.library || component.locked || document.locked)
                }
            };
        }
        if (
            group &&
            document.selectedGroupsIds.length === 1 &&
            ids.every((id) => group.shapesIds.includes(id))
        ) {
            return {
                name: group.name,
                type: 'group',
                ids: moveIds,
                rename: { kind: 'group', id: group.id, readOnly: group.locked || document.locked }
            };
        }
        if (shape) {
            return {
                name: shape.name,
                type: shape.type,
                ids: moveIds,
                rename: { kind: 'shape', id: shape.id, readOnly: document.locked }
            };
        }

        return { name: `${ids.length} selected`, type: 'selection', ids: moveIds };
    });

/** The document's layers in their order, by id and name. */
export const useLayerChoices = () =>
    useAppState((state) => {
        const { layers, layersIds } = state.currentDocument;

        return layersIds.map((id) => ({ id, name: layers[id].name }));
    });

/** Whether the selection may move to another layer: editable, and no component's shapes. */
export const useCanMoveSelectionToLayer = () =>
    useAppState((state) => {
        const { componentMembersIds, editableSelectedShapesIds, selectedShapesIds } =
            state.currentDocument;

        return (
            editableSelectedShapesIds.length > 0 &&
            selectedShapesIds.every((id) => !componentMembersIds.has(id))
        );
    });
