import React, { FC, ReactNode } from 'react';
import { useActions, useAppState, useEditingComponentId, useSourceSelected } from 'src/app/hooks';
import { canAddShapesToComponent } from 'src/app/actions/components';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { hideAction, lockAction } from '../ItemMenu';
import { ExplorerItem } from './ExplorerItem';

interface Props {
    componentId: string;
    shapesIds: string[];
    children?: ReactNode;
}

/** One component definition, with its editable source shapes below it. */
export const SourceItem: FC<Props> = ({ componentId, shapesIds, children }) => {
    const component = useAppState((state) => state.currentDocument.components[componentId]);
    const selected = useSourceSelected(componentId);
    const editing = useEditingComponentId() === componentId;
    const selectedShapesIds = useAppState((state) => state.currentDocument.selectedShapesIds);
    const canAddSelection = useAppState((state) =>
        canAddShapesToComponent(state.currentDocument, componentId, selectedShapesIds)
    );
    const {
        selectComponentSource,
        editComponentSource,
        chooseComponentToPlace,
        updateComponent,
        addShapesToComponent,
        removeShapesFromComponent
    } = useActions();
    const documentLocked = useAppState((state) => state.currentDocument.locked);
    const readOnly = Boolean(component.library || component.locked || documentLocked);
    const canRemoveSelection =
        !readOnly && selectedShapesIds.some((id) => component.shapesIds.includes(id));

    return (
        <ExplorerItem
            kind="component"
            name={component.name}
            icon={<ObjectTypeSymbol type="component" />}
            collapseId={shapesIds.length > 0 ? `component:${componentId}` : undefined}
            selected={selected}
            active={editing}
            visible={component.visible}
            onClick={() => selectComponentSource(componentId)}
            onDoubleClick={() => editComponentSource(componentId)}
            menuActions={[
                {
                    id: 'insert',
                    label: 'Place instance',
                    icon: { group: 'content', name: 'add_box', size: 16 },
                    onRun: () => chooseComponentToPlace(componentId)
                },
                {
                    ...hideAction(!component.visible, () =>
                        updateComponent({ id: componentId, visible: !component.visible })
                    ),
                    disabled: readOnly
                },
                {
                    ...lockAction(component.locked, () =>
                        updateComponent({ id: componentId, locked: !component.locked })
                    ),
                    disabled: Boolean(component.library || documentLocked)
                },
                {
                    id: 'add-shapes',
                    label: 'Add selected shapes',
                    icon: { group: 'content', name: 'add_circle', size: 16 },
                    disabled: !canAddSelection,
                    onRun: () =>
                        addShapesToComponent({ componentId, shapeIds: [...selectedShapesIds] })
                },
                {
                    id: 'remove-shapes',
                    label: 'Remove selected shapes',
                    icon: { group: 'content', name: 'remove_circle', size: 16 },
                    disabled: !canRemoveSelection,
                    onRun: () =>
                        removeShapesFromComponent({ componentId, shapeIds: [...selectedShapesIds] })
                }
            ]}
        >
            {children}
        </ExplorerItem>
    );
};
