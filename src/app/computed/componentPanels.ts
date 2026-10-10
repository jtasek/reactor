import type { Application, Document, InstanceShape } from '../types';
import { componentPropValue, exposableProperties } from '../componentProps';
import { componentFingerprint } from '../componentLibrary';
import { SHAPE_PROPERTIES } from '../properties';

export function instanceProperties(document: Document) {
    const selected = document.selectedShapes.filter(
        (shape): shape is InstanceShape => shape.type === 'instance'
    );
    const componentId = selected[0]?.componentId;

    if (
        !componentId ||
        selected.length !== document.selectedShapes.length ||
        selected.some((shape) => shape.componentId !== componentId)
    ) {
        return null;
    }
    const component = document.components[componentId];

    if (!component) {
        return null;
    }

    return {
        ids: selected.map((shape) => shape.id),
        rows: (component.props ?? []).flatMap((prop) => {
            const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

            if (!property) {
                return [];
            }
            const values = selected.map((shape) =>
                componentPropValue(shape, component, prop.id, document)
            );
            const bindings = selected.map((shape) => shape.overrides[prop.id]);
            const binding = bindings[0];

            return [
                {
                    prop: { id: prop.id, label: prop.label },
                    kind: property.kind,
                    value: values[0],
                    mixed: values.some((value) => value !== values[0]),
                    overridden: selected.some((shape) => prop.id in shape.overrides),
                    variableId:
                        binding &&
                        typeof binding === 'object' &&
                        bindings.every(
                            (item) =>
                                typeof item === 'object' && item.variableId === binding.variableId
                        )
                            ? binding.variableId
                            : ''
                }
            ];
        }),
        variables: Object.values(document.variables).map(({ id, name, type }) => ({
            id,
            name,
            type
        }))
    };
}

export function componentLibraries(state: Application) {
    return Object.values(state.documents)
        .filter((document) => document.id !== state.currentDocumentId)
        .flatMap((document) =>
            Object.values(document.components).map((component) => ({
                documentId: document.id,
                documentName: document.name,
                componentId: component.id,
                name: component.name,
                hash: componentFingerprint(document, component.id),
                imported: Boolean(state.currentDocument.components[component.id])
            }))
        );
}

export function componentCandidates(document: Document, componentId: string) {
    const component = document.components[componentId];

    return (component?.shapesIds ?? []).flatMap((id) => {
        const shape = document.shapes[id];

        if (!shape) {
            return [];
        }

        return exposableProperties(shape, document).map((property) => ({
            id: `${id}:${property.key}`,
            shapeId: id,
            key: property.key,
            label: `${shape.name}: ${property.label}`
        }));
    });
}
