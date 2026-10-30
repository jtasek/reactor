import type * as ComponentPropertyEdits from '../componentPropertyEdits';
import { editorHelpers } from '../editorHelpers';
import { Action, ActionWithParam, Application, Component, Point } from '../types';
import { createComponent } from '../factories';
import { componentSource, instanceComponentId } from '../componentSource';
import { invalidOverrideIds } from '../componentProps';
import { isShapeLocked, isShapeVisible } from '../utils';
import type { GroupDrag } from './group';
import type { ResizeHandlerType } from '../types';
import { resizeContainerShapes, rotateContainerShapes } from '../containerTransforms';
import { putShapesOnLayer, putShapesInFrame } from '../membership';

type ComponentDrag = Omit<GroupDrag, 'groupId'> & { componentId: string };

export const rotateComponent: ActionWithParam<ComponentDrag> = (
    { state },
    { componentId, position, shapes, frame }
) => {
    const document = state.currentDocument;
    const component = document.components[componentId];

    if (
        !component ||
        component.library ||
        component.shapesIds.some((id) => isShapeLocked(document, id))
    ) {
        return;
    }
    component.rotation = rotateContainerShapes(document, position, shapes, frame);
};

export const resizeComponent: ActionWithParam<ComponentDrag & { handle: ResizeHandlerType }> = (
    { state },
    { componentId, position, shapes, frame, handle }
) => {
    const document = state.currentDocument;
    const component = document.components[componentId];

    if (
        !component ||
        component.library ||
        component.shapesIds.some((id) => isShapeLocked(document, id))
    ) {
        return;
    }
    resizeContainerShapes(document, handle, position, shapes, frame);
};

/** A source cannot be emptied while a live instance refers to it. */
export const hasComponentInstances = (document: Application['currentDocument'], id: string) =>
    Object.values(document.shapes).some(
        (shape) => shape.type === 'instance' && shape.componentId === id
    );

export const addComponentVariant: typeof ComponentPropertyEdits.addComponentVariant = (...args) =>
    editorHelpers().componentProperties.addComponentVariant(...args);

export const createComponentVariant: typeof ComponentPropertyEdits.createComponentVariant = (
    ...args
) => editorHelpers().componentProperties.createComponentVariant(...args);

export const removeComponentVariant: typeof ComponentPropertyEdits.removeComponentVariant = (
    ...args
) => editorHelpers().componentProperties.removeComponentVariant(...args);

export const setInstanceVariant: typeof ComponentPropertyEdits.setInstanceVariant = (...args) =>
    editorHelpers().componentProperties.setInstanceVariant(...args);

/** Whether adding a nested instance would make its containing source recursive. */
export function reachesComponent(
    document: Pick<Application['currentDocument'], 'components' | 'shapes'>,
    from: string,
    target: string,
    visited = new Set<string>()
): boolean {
    if (from === target) {
        return true;
    }
    if (visited.has(from)) {
        return false;
    }
    visited.add(from);

    const component = document.components[from];

    return (component?.shapesIds ?? []).some((id) => {
        const shape = component.sourceShapes?.[id] ?? document.shapes[id];

        if (shape?.type !== 'instance') {
            return false;
        }
        // The selected alternate is drawn instead of the default when it is available.
        const drawn = instanceComponentId(document, shape);

        return (
            reachesComponent(document, shape.componentId, target, visited) ||
            (drawn !== shape.componentId && reachesComponent(document, drawn, target, visited))
        );
    });
}

/** The shapes in any component, imported ones included. */
const anyComponentMembers = (document: Application['currentDocument']) =>
    new Set(Object.values(document.components).flatMap((component) => component.shapesIds));

export const canAddShapesToComponent = (
    document: Application['currentDocument'],
    componentId: string,
    shapeIds: string[]
) => {
    const members = anyComponentMembers(document);

    return (
        !document.locked &&
        Boolean(document.components[componentId]) &&
        !document.components[componentId].library &&
        !document.components[componentId].locked &&
        shapeIds.length > 0 &&
        shapeIds.every((id) => {
            const shape = document.shapes[id];

            return (
                shape &&
                !isShapeLocked(document, id) &&
                !members.has(id) &&
                (shape.type !== 'instance' ||
                    !reachesComponent(document, shape.componentId, componentId))
            );
        })
    );
};

const getComponent = ({ currentDocument }: Application, componentId: string) => {
    const component = currentDocument.components[componentId];

    if (!component) {
        throw new Error(`Component ${componentId} not found`);
    }

    return component;
};

const setComponent = ({ currentDocument }: Application, component: Component) => {
    if (currentDocument) {
        currentDocument.components[component.id] = component;
    }
};

const deleteComponent = ({ currentDocument }: Application, componentId: string) =>
    delete currentDocument.components[componentId];

export const addComponent: ActionWithParam<Partial<Component>> = ({ state }, options) => {
    const component = createComponent(options);

    setComponent(state, component);
};

export const cloneComponent: ActionWithParam<string> = ({ state, effects }, componentId) => {
    const component = getComponent(state, componentId);

    // An alternate belongs to one family, so the copy starts without links.
    const copy = { ...component, id: effects.newId() };
    delete copy.variantIds;
    setComponent(state, copy);
};

export const removeComponent: ActionWithParam<string> = ({ state, actions }, componentId) => {
    if (hasComponentInstances(state.currentDocument, componentId)) {
        actions.displayWarning('Detach its instances before removing this component.');

        return;
    }
    deleteComponent(state, componentId);
    Object.values(state.currentDocument.components).forEach((family) => {
        if (!family.variantIds?.includes(componentId)) {
            return;
        }
        family.variantIds = family.variantIds.filter((id) => id !== componentId);
        if (family.variantIds.length === 0) {
            delete family.variantIds;
        }
    });
    editorHelpers().componentProperties.clearVariantChoice(state.currentDocument, componentId);
};

export const createComponentFromSelection: typeof ComponentPropertyEdits.createComponentFromSelection =
    (context) => editorHelpers().componentProperties.createComponentFromSelection(context);

export const addShapesToComponent: ActionWithParam<{ componentId: string; shapeIds: string[] }> = (
    { state, actions },
    { componentId, shapeIds }
) => {
    if (!canAddShapesToComponent(state.currentDocument, componentId, shapeIds)) {
        actions.displayWarning('These shapes cannot be added to this component.');

        return;
    }

    const component = getComponent(state, componentId);
    component.shapesIds.push(...shapeIds);
    if (component.sourceOnly) {
        putShapesOnLayer(state.currentDocument, shapeIds, null);
        putShapesInFrame(state.currentDocument, shapeIds, undefined);
    }
};

export const removeShapesFromComponent: ActionWithParam<{
    componentId: string;
    shapeIds: string[];
}> = ({ state, actions }, { componentId, shapeIds }) => {
    const component = getComponent(state, componentId);
    const removing = new Set(shapeIds);
    const remaining = component.shapesIds.filter((id) => !removing.has(id));

    if (state.currentDocument.locked || component.library || component.locked) {
        return;
    }
    if (remaining.length === 0 && hasComponentInstances(state.currentDocument, componentId)) {
        actions.displayWarning('A component with instances must keep at least one shape.');

        return;
    }
    component.shapesIds = remaining;
    component.props = component.props?.filter((prop) => remaining.includes(prop.shapeId));
    Object.values(state.currentDocument.shapes).forEach((shape) => {
        if (shape.type !== 'instance' || shape.componentId !== componentId) {
            return;
        }
        invalidOverrideIds(shape, component).forEach((id) => {
            delete shape.overrides[id];
        });
    });
};

export const exposeComponentProp: typeof ComponentPropertyEdits.exposeComponentProp = (
    context,
    input
) => editorHelpers().componentProperties.exposeComponentProp(context, input);

export const setComponentPropTarget: typeof ComponentPropertyEdits.setComponentPropTarget = (
    context,
    input
) => editorHelpers().componentProperties.setComponentPropTarget(context, input);

export const removeComponentProp: typeof ComponentPropertyEdits.removeComponentProp = (
    context,
    input
) => editorHelpers().componentProperties.removeComponentProp(context, input);

export const setInstanceOverride: typeof ComponentPropertyEdits.setInstanceOverride = (
    context,
    input
) => editorHelpers().componentProperties.setInstanceOverride(context, input);

export const bindInstanceOverride: typeof ComponentPropertyEdits.bindInstanceOverride = (
    context,
    input
) => editorHelpers().componentProperties.bindInstanceOverride(context, input);

export const resetInstanceOverrides: typeof ComponentPropertyEdits.resetInstanceOverrides = (
    context,
    input
) => editorHelpers().componentProperties.resetInstanceOverrides(context, input);

export const insertComponentAt: ActionWithParam<{ componentId: string; position: Point }> = (
    { state, actions },
    { componentId, position }
) => {
    const component = state.currentDocument.components[componentId];

    if (!component || component.shapesIds.length === 0 || state.currentDocument.locked) {
        return;
    }
    const source = componentSource(state.currentDocument, componentId);
    actions.drawShape({
        type: 'instance',
        componentId,
        position,
        overrides: {},
        ...(source
            ? {
                  bounds: {
                      topLeft: position,
                      bottomRight: {
                          x: position.x + source.box.width,
                          y: position.y + source.box.height
                      },
                      width: source.box.width,
                      height: source.box.height
                  }
              }
            : {})
    });
};

export const chooseComponentToPlace: ActionWithParam<string> = (
    { state, actions },
    componentId
) => {
    if (!state.currentDocument.components[componentId]) {
        return;
    }
    if (state.enteredComponentId === componentId) {
        actions.leaveComponentSource();
    }
    state.tools.componentToPlace = componentId;
    actions.tools.activateTool('instance');
};

export const importLibraryComponent: ActionWithParam<{
    documentId: string;
    componentId: string;
}> = ({ state, actions }, { documentId, componentId }) => {
    const source = state.documents[documentId];
    const target = state.currentDocument;

    if (
        !source ||
        source.deleted ||
        source === target ||
        target.locked ||
        target.components[componentId]
    ) {
        return;
    }
    const copies = editorHelpers().library.librarySnapshot(source, componentId, target);

    if (!copies) {
        actions.displayWarning('This component cannot be copied into this document.');

        return;
    }
    copies.forEach((component) => {
        target.components[component.id] = component;
    });
    actions.ui.showControl('components');
};

export const updateLibraryComponent: ActionWithParam<string> = (
    { state, actions, effects },
    componentId
) => {
    const target = state.currentDocument;
    const existing = target.components[componentId];
    const source = existing?.library && state.documents[existing.library.documentId];

    if (!source || source.deleted || target.locked) {
        return;
    }
    const hash = editorHelpers().library.componentFingerprint(source, componentId);

    if (!hash || hash === existing.library?.hash) {
        return;
    }
    const copies = editorHelpers().library.librarySnapshot(source, componentId, target);

    if (!copies) {
        actions.displayWarning('This component update cannot be applied.');

        return;
    }
    effects.collaboration.startBatch(target.id, { kind: 'person' });
    copies.forEach((component) => {
        target.components[component.id] = component;
    });
    effects.collaboration.flush();
};

export const selectComponentSource: ActionWithParam<string> = ({ state, actions }, componentId) => {
    const component = state.currentDocument.components[componentId];

    if (!component) {
        return;
    }
    if (component.sourceOnly && !component.library) {
        actions.editComponentSource(componentId);

        return;
    }
    actions.unselectShapes();
    state.enteredGroupId = null;
    state.enteredComponentId = null;
    component.shapesIds.forEach((id) => {
        if (state.currentDocument.shapes[id]) {
            state.currentDocument.shapes[id].selected = true;
        }
    });
    state.selectedComponent = {
        documentId: state.currentDocumentId,
        componentId
    };
    actions.ui.showControl('inspector');
};

/** Opens the definition on the canvas, isolating its children for direct editing. */
export const editComponentSource: ActionWithParam<string> = ({ state, actions }, componentId) => {
    const component = state.currentDocument.components[componentId];

    if (!component || component.library) {
        return;
    }
    if (
        state.enteredComponentId === null ||
        state.componentEditingReturn?.documentId !== state.currentDocumentId
    ) {
        const document = state.currentDocument;
        const componentOrigin = editorHelpers().pointer.componentEditingOrigin(state, component);
        state.componentEditingReturn = {
            documentId: document.id,
            ...(document.selectedComponentsIds.includes(componentId)
                ? { selectedComponentId: componentId }
                : {}),
            shapeIds: document.selectedShapesIds.filter((id) => {
                const shape = document.shapes[id];

                return (
                    (shape.type === 'instance' && shape.componentId === componentId) ||
                    component.shapesIds.includes(id)
                );
            }),
            camera: { position: { ...document.camera.position }, scale: document.camera.scale },
            screenView: state.events.pointer.screenView
                ? {
                      documentId: state.events.pointer.screenView.documentId,
                      viewId: state.events.pointer.screenView.viewId
                  }
                : null,
            ...(componentOrigin ? { componentOrigin } : {})
        };
    }
    actions.unselectShapes();
    state.enteredGroupId = null;
    state.enteredComponentId = componentId;
    if (!editorHelpers().pointer.componentScreenView(state)) {
        state.events.pointer.screenView = null;
    }
    state.selectedComponent = { documentId: state.currentDocumentId, componentId };
};

export const leaveComponentSource: Action = ({ state, actions }) => {
    const componentId = state.enteredComponentId;

    if (!componentId) {
        return;
    }
    const previous = state.componentEditingReturn;
    state.componentEditingReturn = null;
    if (previous?.documentId === state.currentDocumentId) {
        actions.unselectShapes();
        actions.events.setScreenView(previous.screenView?.viewId ?? null);
        state.currentDocument.camera = {
            position: { ...previous.camera.position },
            scale: previous.camera.scale
        };
        const shapeIds = (
            state.currentDocument.components[previous.selectedComponentId ?? '']?.shapesIds ??
            previous.shapeIds
        ).filter(
            (id) => state.currentDocument.shapes[id] && isShapeVisible(state.currentDocument, id)
        );
        if (shapeIds.length > 0) {
            shapeIds.forEach((id) => actions.selectShape(id));

            return;
        }
    }
    if (state.currentDocument.components[componentId]?.sourceOnly) {
        actions.unselectShapes();
        const instance = state.currentDocument.shapesIds.find(
            (id) =>
                state.currentDocument.shapes[id].type === 'instance' &&
                state.currentDocument.shapes[id].componentId === componentId &&
                isShapeVisible(state.currentDocument, id)
        );

        if (instance) {
            actions.selectShape(instance);
        }

        return;
    }
    actions.selectComponentSource(componentId);
};

export const selectComponentChild: ActionWithParam<{
    componentId: string;
    shapeId: string;
}> = ({ state, actions }, { componentId, shapeId }) => {
    const component = state.currentDocument.components[componentId];

    if (!component?.shapesIds.includes(shapeId) || !state.currentDocument.shapes[shapeId]) {
        return;
    }
    if (state.enteredComponentId !== componentId) {
        actions.editComponentSource(componentId);
    }
    actions.unselectShapes();
    actions.selectShape(shapeId);
    state.enteredComponentId = componentId;
    state.enteredGroupId = null;
    state.selectedComponent = { documentId: state.currentDocumentId, componentId, shapeId };
    actions.ui.showControl('inspector');
};

export const unselectComponent: ActionWithParam<string> = ({ state }, componentId) => {
    const component = getComponent(state, componentId);

    component.selected = false;
};

export const lockComponent: ActionWithParam<string> = ({ state }, componentId) => {
    const component = getComponent(state, componentId);

    component.locked = true;
};

export const unlockComponent: ActionWithParam<string> = ({ state }, componentId) => {
    const component = getComponent(state, componentId);

    component.locked = false;
};

export const showComponent: ActionWithParam<string> = ({ state }, componentId) => {
    const component = getComponent(state, componentId);

    component.visible = true;
};

export const hideComponent: ActionWithParam<string> = ({ state }, componentId) => {
    const component = getComponent(state, componentId);

    component.visible = false;
};

export const updateComponent: ActionWithParam<
    Pick<Component, 'id'> & Partial<Pick<Component, 'name' | 'visible' | 'locked'>>
> = ({ state }, options) => {
    const component = getComponent(state, options.id);

    if (component.library || state.currentDocument.locked) {
        return;
    }
    setComponent(state, { ...component, ...options });
};
