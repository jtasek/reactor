import { createComponent, createShape, instanceName } from './factories';
import { componentSource } from './componentSource';
import { ordersBetween, resolveDrawOrderTies } from './drawOrder';
import { putShapesOnLayer, putShapesInFrame, shapeLayer } from './membership';
import { editorHelpers } from './editorHelpers';
import type { Action, ActionWithParam, PropertyValue } from './types';
import { exposableProperties, resolveComponentProp, acceptsComponentValue } from './componentProps';
import { isShapeLocked } from './utils';

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
    const prop = { id: effects.newId(), shapeId, key, label: label.trim() };
    component.props = [...(component.props ?? []), prop];
    for (const variantId of component.variantIds ?? []) {
        const alternate = state.currentDocument.components[variantId];
        const matching = alternate?.shapesIds
            .map((id) => alternate.sourceShapes?.[id] ?? state.currentDocument.shapes[id])
            .find((candidate) => candidate?.name === shape.name && candidate.type === shape.type);
        if (
            !matching ||
            !exposableProperties(matching, state.currentDocument).some((item) => item.key === key)
        ) {
            continue;
        }
        alternate.props = [...(alternate.props ?? []), { ...prop, shapeId: matching.id }];
    }
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
    for (const variantId of component.variantIds ?? []) {
        const alternate = state.currentDocument.components[variantId];
        if (alternate) {
            alternate.props = alternate.props?.filter((prop) => prop.id !== propId);
        }
    }
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

/** Link two independently editable component sources into one manual family. */
export const addComponentVariant: ActionWithParam<{ componentId: string; variantId: string }> = (
    { state },
    { componentId, variantId }
) => {
    const document = state.currentDocument;
    const family = document.components[componentId];
    const variant = document.components[variantId];

    if (
        document.locked ||
        !family ||
        !variant ||
        family.locked ||
        variant.locked ||
        family.library ||
        variant.library ||
        componentId === variantId ||
        variant.variantIds?.length ||
        Object.values(document.components).some((item) => item.variantIds?.includes(componentId)) ||
        !componentSource(document, componentId) ||
        !componentSource(document, variantId) ||
        JSON.stringify(family.interaction ?? null) !==
            JSON.stringify(variant.interaction ?? null) ||
        family.variantIds?.includes(variantId) ||
        Object.values(document.components).some((item) => item.variantIds?.includes(variantId))
    ) {
        return;
    }
    const defaultProps = family.props ?? [];
    const alternateProps = variant.props ?? [];
    if (
        defaultProps.length !== alternateProps.length ||
        defaultProps.some(
            (prop) =>
                !alternateProps.some(
                    (candidate) => candidate.id === prop.id && candidate.key === prop.key
                )
        )
    ) {
        return;
    }

    family.variantIds = [...(family.variantIds ?? []), variantId];
};

export const setInstanceVariant: ActionWithParam<{ instanceIds: string[]; variantId?: string }> = (
    { state },
    { instanceIds, variantId }
) => {
    const document = state.currentDocument;
    if (document.locked) {
        return;
    }

    instanceIds.forEach((id) => {
        const shape = document.shapes[id];
        if (shape?.type !== 'instance' || isShapeLocked(document, id)) {
            return;
        }
        const family = document.components[shape.componentId];
        if (
            variantId &&
            (!family?.variantIds?.includes(variantId) || !document.components[variantId])
        ) {
            return;
        }

        if (variantId) {
            shape.variantId = variantId;
        } else {
            delete shape.variantId;
        }
        delete shape.bounds;
    });
};

export const createComponentFromSelection: Action = ({ state, actions }) => {
    const document = state.currentDocument;
    const ids = [...document.editableSelectedShapesIds];
    const members = new Set(
        Object.values(document.components).flatMap((component) => component.shapesIds)
    );

    if (document.locked || ids.length === 0 || ids.some((id) => members.has(id))) {
        return;
    }

    const parentFrameId = document.shapes[ids[ids.length - 1]].parentFrameId;
    const layoutOrder = Math.min(
        ...ids.map((id) => document.shapes[id].layoutOrder ?? Number.MAX_SAFE_INTEGER)
    );
    editorHelpers().groups.materializeGroupPlacement(document, ids, parentFrameId);
    const component = createComponent({ shapesIds: ids, sourceOnly: true });
    document.components[component.id] = component;
    const source = componentSource(document, component.id);

    if (!source) {
        delete document.components[component.id];

        return;
    }

    const topId = ids[ids.length - 1];
    const layerId = shapeLayer(document, topId)?.id ?? null;
    resolveDrawOrderTies(document.shapesIds.map((id) => document.shapes[id]));
    const index = document.shapesIds.indexOf(topId);
    const nextId = document.shapesIds[index + 1];
    const order = ordersBetween(
        document.shapes[topId].order,
        document.shapes[nextId]?.order ?? null,
        1
    )[0];
    const position = { ...source.box.topLeft };

    actions.unselectShapes();
    state.enteredGroupId = null;
    const instance = createShape({
        type: 'instance',
        parentFrameId,
        ...(layoutOrder === Number.MAX_SAFE_INTEGER ? {} : { layoutOrder }),
        componentId: component.id,
        name: instanceName(
            component.name,
            new Set(Object.values(document.shapes).map((shape) => shape.name))
        ),
        order,
        position,
        overrides: {},
        bounds: {
            topLeft: position,
            bottomRight: {
                x: position.x + source.box.width,
                y: position.y + source.box.height
            },
            width: source.box.width,
            height: source.box.height
        }
    });
    document.shapes[instance.id] = instance;
    document.shapesIds.splice(index + 1, 0, instance.id);
    putShapesOnLayer(document, [instance.id], layerId);
    putShapesOnLayer(document, ids, null);
    putShapesInFrame(document, ids, undefined);
    actions.ui.showControl('explorer');
    actions.ui.showControl('inspector');
};
