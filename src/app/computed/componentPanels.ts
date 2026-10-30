import type { Application, Document, InstanceShape } from '../types';
import { componentPropValue, exposableProperties } from '../componentProps';
import { instanceComponentId } from '../componentSource';
import { editorHelpers, editorLoaded } from '../editorHelpers';
import { SHAPE_PROPERTIES } from '../properties';
import {
    componentAlternateProblems,
    componentDefaultProblems,
    componentVariantCandidates,
    componentVariantProblems
} from '../componentVariants';

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

    const variantProblems = selected.flatMap((shape) => {
        if (!shape.variantId) {
            return [];
        }
        const alternate = document.components[shape.variantId];
        if (!component.variantIds?.includes(shape.variantId) || !alternate) {
            return [`${shape.name}: selected variant is unavailable; showing the default.`];
        }
        return componentVariantProblems(document, componentId, alternate.id).map(
            (problem) => `${shape.name}: ${problem}`
        );
    });

    return {
        ids: selected.map((shape) => shape.id),
        // Copies often share a name, so several instances can report the same line.
        variantProblems: [...new Set(variantProblems)],
        variants: [component, ...(component.variantIds ?? []).map((id) => document.components[id])]
            .filter((item) => Boolean(item))
            .map((item) => ({ id: item.id, name: item.name })),
        selectedVariantId: selected.every((shape) => shape.variantId === selected[0].variantId)
            ? (selected[0].variantId ?? component.id)
            : '',
        rows: (component.props ?? []).flatMap((prop) => {
            const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

            if (!property) {
                return [];
            }
            const values = selected.map((shape) =>
                componentPropValue(
                    shape,
                    document.components[instanceComponentId(document, shape)],
                    prop.id,
                    document
                )
            );
            const bindings = selected.map((shape) => shape.overrides[prop.id]);
            const binding = bindings[0];
            const shapeName =
                (component.sourceShapes?.[prop.shapeId] ?? document.shapes[prop.shapeId])?.name ??
                'Shape';
            const prefix = `${shapeName}: `;

            return [
                {
                    prop: { id: prop.id, label: prop.label },
                    shapeId: prop.shapeId,
                    shapeName,
                    fieldLabel: prop.label.startsWith(prefix)
                        ? prop.label.slice(prefix.length)
                        : prop.label,
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
        variables: Object.values(document.variables).map((variable) => {
            return {
                id: variable.id,
                name: variable.name,
                type: variable.type,
                modesUnavailable: false
            };
        })
    };
}

export function componentLibraries(state: Application) {
    return Object.values(state.documents)
        .filter((document) => document.id !== state.currentDocumentId && !document.deleted)
        .flatMap((document) =>
            Object.values(document.components).map((component) => ({
                documentId: document.id,
                documentName: document.name,
                componentId: component.id,
                name: component.name,
                imported: Boolean(state.currentDocument.components[component.id])
            }))
        );
}

/** Whether the document an imported component came from now holds a different version of it. */
export function libraryUpdateAvailable(state: Application, componentId: string) {
    const library = state.currentDocument.components[componentId]?.library;
    const source = library && state.documents[library.documentId];
    const hash =
        source && editorLoaded()
            ? editorHelpers().library.componentFingerprint(source, componentId)
            : null;

    return Boolean(hash && hash !== library?.hash);
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

/** The source Inspector's family diagnostics and compatible link targets. */
export function componentVariants(document: Document, componentId: string) {
    const component = document.components[componentId];
    const family = Object.values(document.components).find((item) =>
        item.variantIds?.includes(componentId)
    );

    return {
        family: family ? { id: family.id, name: family.name } : undefined,
        problems: family ? componentVariantProblems(document, family.id, componentId) : [],
        /** The default's own problems, shown once above its variants. */
        defaultProblems: component?.variantIds?.length
            ? componentDefaultProblems(document, componentId)
            : [],
        variants: (component?.variantIds ?? []).map((id) => ({
            id,
            name: document.components[id]?.name ?? 'Missing variant',
            editable: Boolean(document.components[id] && !document.components[id].library),
            problems: componentAlternateProblems(document, componentId, id)
        })),
        // An alternate can't have alternates, and the picker isn't shown for one.
        candidates: family
            ? []
            : componentVariantCandidates(document, componentId).map((candidate) => ({
                  id: candidate.id,
                  name: candidate.name
              }))
    };
}
