import { Action, ActionWithParam, Application, Component, Point, PropertyValue } from '../types';
import { createComponent } from '../factories';
import { componentSource } from '../componentSource';
import { componentFingerprint, librarySnapshot } from '../componentLibrary';
import {
    exposableProperties,
    resolveComponentProp,
    acceptsComponentValue,
    invalidOverrideIds
} from '../componentProps';
import { isShapeLocked } from '../utils';

/** A source cannot be emptied while a live instance refers to it. */
export const hasComponentInstances = (document: Application['currentDocument'], id: string) =>
    Object.values(document.shapes).some(
        (shape) => shape.type === 'instance' && shape.componentId === id
    );

/** Whether adding a nested instance would make its containing source recursive. */
function reachesComponent(
    document: Application['currentDocument'],
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

    return (document.components[from]?.shapesIds ?? []).some((id) => {
        const shape = document.shapes[id];

        return (
            shape?.type === 'instance' &&
            reachesComponent(document, shape.componentId, target, visited)
        );
    });
}

export const canAddShapesToComponent = (
    document: Application['currentDocument'],
    componentId: string,
    shapeIds: string[]
) =>
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
            !Object.values(document.components).some((component) =>
                component.shapesIds.includes(id)
            ) &&
            (shape.type !== 'instance' ||
                !reachesComponent(document, shape.componentId, componentId))
        );
    });

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

    setComponent(state, { ...component, id: effects.newId() });
};

export const removeComponent: ActionWithParam<string> = ({ state, actions }, componentId) => {
    if (hasComponentInstances(state.currentDocument, componentId)) {
        actions.displayWarning('Detach its instances before removing this component.');

        return;
    }
    deleteComponent(state, componentId);
};

export const createComponentFromSelection: Action = ({ state, actions }) => {
    const ids = [...state.currentDocument.editableSelectedShapesIds];
    const document = state.currentDocument;

    if (
        document.locked ||
        ids.length === 0 ||
        ids.some((id) =>
            Object.values(document.components).some((component) => component.shapesIds.includes(id))
        )
    ) {
        return;
    }

    const component = createComponent({ shapesIds: ids });
    setComponent(state, component);
    actions.ui.showControl('components');
};

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

export const exposeComponentProp: ActionWithParam<{
    componentId: string;
    shapeId: string;
    key: string;
    label: string;
}> = ({ state, effects }, { componentId, shapeId, key, label }) => {
    const component = state.currentDocument.components[componentId];
    const shape = state.currentDocument.shapes[shapeId];

    if (
        !component ||
        component.library ||
        component.locked ||
        state.currentDocument.locked ||
        !component.shapesIds.includes(shapeId) ||
        !shape ||
        !label.trim() ||
        !exposableProperties(shape, state.currentDocument).some((item) => item.key === key) ||
        component.props?.some((item) => item.shapeId === shapeId && item.key === key)
    ) {
        return;
    }
    component.props = [
        ...(component.props ?? []),
        { id: effects.newId(), shapeId, key, label: label.trim() }
    ];
};

export const removeComponentProp: ActionWithParam<{ componentId: string; propId: string }> = (
    { state },
    { componentId, propId }
) => {
    const component = state.currentDocument.components[componentId];

    if (!component || component.library || component.locked || state.currentDocument.locked) {
        return;
    }
    component.props = component.props?.filter((prop) => prop.id !== propId);
    Object.values(state.currentDocument.shapes).forEach((shape) => {
        if (shape.type === 'instance' && shape.componentId === componentId) {
            delete shape.overrides[propId];
        }
    });
};

export const setInstanceOverride: ActionWithParam<{
    instanceIds: string[];
    propId: string;
    value: PropertyValue;
}> = ({ state }, { instanceIds, propId, value }) => {
    if (state.currentDocument.locked) {
        return;
    }
    instanceIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape?.type !== 'instance' || isShapeLocked(state.currentDocument, id)) {
            return;
        }
        const component = state.currentDocument.components[shape.componentId];
        const resolved = resolveComponentProp(component, propId, state.currentDocument);

        if (!resolved) {
            return;
        }
        const { source, property } = resolved;

        if (!exposableProperties(source, state.currentDocument).includes(property)) {
            return;
        }
        if (!acceptsComponentValue(property, value)) {
            return;
        }
        shape.overrides[propId] = value;
    });
};

export const bindInstanceOverride: ActionWithParam<{
    instanceIds: string[];
    propId: string;
    variableId: string;
}> = ({ state }, { instanceIds, propId, variableId }) => {
    const variable = state.currentDocument.variables[variableId];

    if (!variable || state.currentDocument.locked) {
        return;
    }
    instanceIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape?.type !== 'instance' || isShapeLocked(state.currentDocument, id)) {
            return;
        }
        const component = state.currentDocument.components[shape.componentId];
        const resolved = resolveComponentProp(component, propId, state.currentDocument);

        if (!resolved) {
            return;
        }
        const { source, property } = resolved;

        if (!exposableProperties(source, state.currentDocument).includes(property)) {
            return;
        }
        if (property.kind !== variable.type) {
            return;
        }
        shape.overrides[propId] = { variableId };
    });
};

export const resetInstanceOverrides: ActionWithParam<{
    instanceIds: string[];
    propId?: string;
}> = ({ state }, { instanceIds, propId }) => {
    if (state.currentDocument.locked) {
        return;
    }
    instanceIds.forEach((id) => {
        const shape = state.currentDocument.shapes[id];

        if (shape?.type !== 'instance' || isShapeLocked(state.currentDocument, id)) {
            return;
        }
        if (propId) {
            delete shape.overrides[propId];

            return;
        }
        shape.overrides = {};
    });
};

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
    state.tools.componentToPlace = componentId;
    actions.tools.activateTool('instance');
};

export const importLibraryComponent: ActionWithParam<{
    documentId: string;
    componentId: string;
}> = ({ state, actions }, { documentId, componentId }) => {
    const source = state.documents[documentId];
    const target = state.currentDocument;

    if (!source || source === target || target.locked || target.components[componentId]) {
        return;
    }
    const copies = librarySnapshot(source, componentId, target);

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
    { state, actions },
    componentId
) => {
    const target = state.currentDocument;
    const existing = target.components[componentId];
    const source = existing?.library && state.documents[existing.library.documentId];

    if (!source || target.locked) {
        return;
    }
    const hash = componentFingerprint(source, componentId);

    if (!hash || hash === existing.library?.hash) {
        return;
    }
    const copies = librarySnapshot(source, componentId, target);

    if (!copies) {
        actions.displayWarning('This component update cannot be applied.');

        return;
    }
    copies.forEach((component) => {
        target.components[component.id] = component;

        Object.values(target.shapes).forEach((shape) => {
            if (shape.type !== 'instance' || shape.componentId !== component.id) {
                return;
            }
            invalidOverrideIds(shape, component).forEach((id) => {
                delete shape.overrides[id];
            });
        });
    });
};

export const selectComponentSource: ActionWithParam<string> = ({ state, actions }, componentId) => {
    const component = state.currentDocument.components[componentId];

    if (!component) {
        return;
    }
    actions.unselectShapes();
    state.enteredGroupId = null;
    component.shapesIds.forEach((id) => {
        if (state.currentDocument.shapes[id]) {
            state.currentDocument.shapes[id].selected = true;
        }
    });
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
