import { json } from 'overmind';
import { createComponent, createGroup, createShape, instanceName } from './factories';
import { readCopiedShape } from './services/documentStorage';
import { componentSource, instanceBox, instanceSource } from './componentSource';
import { reachesComponent } from './actions/components';
import { ordersBetween, resolveDrawOrderTies } from './drawOrder';
import { putShapesOnLayer, putShapesInFrame, shapeLayer } from './membership';
import { editorHelpers } from './editorHelpers';
import type {
    Action,
    ActionWithParam,
    ActionWithParamAndResult,
    Component,
    Document,
    InstanceShape,
    PropertyValue,
    Shape
} from './types';
import { exposableProperties, resolveComponentProp, acceptsComponentValue } from './componentProps';
import { isShapeLocked } from './utils';
import { canLinkComponentVariant } from './componentVariants';

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
        const matching =
            alternate && counterpart(state.currentDocument, component, alternate, shape);
        if (
            !matching ||
            !exposableProperties(matching, state.currentDocument).some((item) => item.key === key)
        ) {
            continue;
        }
        alternate.props = [...(alternate.props ?? []), { ...prop, shapeId: matching.id }];
    }
};

/**
 * The alternate's shape that corresponds to a default source shape. A property both already
 * expose pairs them directly. Otherwise a unique name decides; created variants keep the
 * default's drawing order, so a source with the same shape types in the same order pairs by
 * position, which also covers repeated names and renamed copies.
 */
function counterpart(
    document: Document,
    family: Component,
    alternate: Component,
    shape: Shape
): Shape | undefined {
    const read = (id: string) => alternate.sourceShapes?.[id] ?? document.shapes[id];
    const shared = family.props?.find(
        (prop) =>
            prop.shapeId === shape.id && alternate.props?.some((other) => other.id === prop.id)
    );
    const paired =
        shared && read(alternate.props!.find((other) => other.id === shared.id)!.shapeId);

    if (paired && alternate.shapesIds.includes(paired.id) && paired.type === shape.type) {
        return paired;
    }
    const own = componentSource(document, family.id)?.shapes ?? [];
    const theirs = componentSource(document, alternate.id)?.shapes ?? [];
    const named = (shapes: Shape[]) =>
        shapes.filter(
            (candidate) => candidate.name === shape.name && candidate.type === shape.type
        );
    const ownNamed = named(own);
    const theirNamed = named(theirs);

    if (ownNamed.length === 1 && theirNamed.length === 1) {
        return theirNamed[0];
    }
    if (
        own.length === theirs.length &&
        own.every((candidate, index) => candidate.type === theirs[index].type)
    ) {
        return theirs[own.findIndex((candidate) => candidate.id === shape.id)];
    }
    return ownNamed.length === theirNamed.length
        ? theirNamed[ownNamed.findIndex((candidate) => candidate.id === shape.id)]
        : undefined;
}

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

/** Create independent source artwork while retaining the family's exposed property identities. */
export const createComponentVariant: ActionWithParamAndResult<string, string | undefined> = (
    { state, actions, effects },
    componentId
) => {
    const document = state.currentDocument;
    const family = document.components[componentId];

    if (
        document.locked ||
        !family ||
        family.locked ||
        family.library ||
        Object.values(document.components).some((item) => item.variantIds?.includes(componentId))
    ) {
        return;
    }
    const source = componentSource(document, componentId);

    if (!source) {
        return;
    }
    const orders = ordersBetween(
        document.shapes[document.shapesIds.at(-1) ?? '']?.order ?? null,
        null,
        source.shapes.length
    );
    const copies = source.shapes.map((shape, index) =>
        createShape({
            ...readCopiedShape(shape),
            name: shape.name,
            order: orders[index],
            locked: shape.locked,
            visible: shape.visible,
            selected: false,
            ...(shape.sizing ? { sizing: json(shape.sizing) } : {})
        })
    );
    const ids = new Map(source.shapes.map((shape, index) => [shape.id, copies[index].id]));
    copies.forEach((copy, index) => {
        const parent = source.shapes[index].parentShapeId;

        if (parent && ids.has(parent)) {
            copy.parentShapeId = ids.get(parent);
        }
    });
    const variant = createComponent({
        name: instanceName(
            `${family.name} variant`,
            new Set(Object.values(document.components).map((item) => item.name))
        ),
        sourceOnly: true,
        shapesIds: copies.map((shape) => shape.id),
        rotation: family.rotation,
        props: family.props?.map((prop) => ({ ...prop, shapeId: ids.get(prop.shapeId)! })),
        ...(family.interaction ? { interaction: json(family.interaction) } : {})
    });
    // A group also holding shapes outside the source keeps just its source members, when two remain.
    const groups = Object.values(document.groups)
        .map((group) => ({ group, members: group.shapesIds.filter((id) => ids.has(id)) }))
        .filter(({ members }) => members.length >= 2)
        .map(({ group, members }) =>
            createGroup({
                name: group.name,
                rotation: group.rotation,
                locked: group.locked,
                visible: group.visible,
                shapesIds: members.map((id) => ids.get(id)!)
            })
        );

    effects.collaboration.startBatch(document.id, { kind: 'person' });
    copies.forEach((shape) => {
        document.shapes[shape.id] = shape;
    });
    document.shapesIds.push(...variant.shapesIds);
    groups.forEach((group) => {
        document.groups[group.id] = group;
    });
    document.components[variant.id] = variant;
    family.variantIds = [...(family.variantIds ?? []), variant.id];
    effects.collaboration.flush();
    actions.selectComponentSource(variant.id);

    return variant.id;
};

/** Link two independently editable component sources into one manual family. */
export const addComponentVariant: ActionWithParam<{ componentId: string; variantId: string }> = (
    { state },
    { componentId, variantId }
) => {
    const document = state.currentDocument;
    if (!canLinkComponentVariant(document, componentId, variantId)) {
        return;
    }
    const family = document.components[componentId];

    family.variantIds = [...(family.variantIds ?? []), variantId];
};

/** Unlink an alternate; instances that chose it go back to the default. */
export const removeComponentVariant: ActionWithParam<{ componentId: string; variantId: string }> = (
    { state },
    { componentId, variantId }
) => {
    const document = state.currentDocument;
    const family = document.components[componentId];

    if (
        document.locked ||
        !family?.variantIds?.includes(variantId) ||
        family.locked ||
        family.library
    ) {
        return;
    }
    family.variantIds = family.variantIds.filter((id) => id !== variantId);
    if (family.variantIds.length === 0) {
        delete family.variantIds;
    }
    clearVariantChoice(document, variantId, componentId);
};

/** Instances of `familyId` (any family when omitted) stop choosing `variantId`. */
export function clearVariantChoice(document: Document, variantId: string, familyId?: string) {
    Object.values(document.shapes).forEach((shape) => {
        if (
            shape.type !== 'instance' ||
            shape.variantId !== variantId ||
            (familyId !== undefined && shape.componentId !== familyId)
        ) {
            return;
        }
        delete shape.variantId;
        refreshInstanceBounds(document, shape);
    });
}

function refreshInstanceBounds(document: Document, shape: InstanceShape) {
    const source = instanceSource(document, shape);
    if (source) {
        shape.bounds = instanceBox(shape, source);
    } else {
        delete shape.bounds;
    }
}

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
            (!family?.variantIds?.includes(variantId) ||
                !document.components[variantId] ||
                // A source may not end up drawing itself through the alternate.
                Object.values(document.components).some(
                    (owner) =>
                        owner.shapesIds.includes(id) &&
                        reachesComponent(document, variantId, owner.id)
                ))
        ) {
            return;
        }

        if (variantId) {
            shape.variantId = variantId;
        } else {
            delete shape.variantId;
        }
        refreshInstanceBounds(document, shape);
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
