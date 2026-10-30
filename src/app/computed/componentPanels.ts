import type { Application, Document, InstanceShape, Shape } from '../types';
import { componentPropValue, componentOverrideValue, exposableProperties } from '../componentProps';
import { instanceComponentId } from '../componentSource';
import { editorHelpers, editorLoaded } from '../editorHelpers';
import { SHAPE_PROPERTIES } from '../properties';
import {
    componentAlternateProblems,
    componentDefaultProblems,
    componentVariantCandidates,
    componentPropertyMappings,
    componentVariantProblems
} from '../componentVariants';

export function instanceProperties(document: Document, projected: Record<string, Shape> = {}) {
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

    const drawn = (shape: InstanceShape) => {
        const candidate = projected[shape.id];

        return candidate?.type === 'instance' ? candidate : shape;
    };
    const variantProblems = selected.flatMap((shape) => {
        const selectedId = instanceComponentId(document, drawn(shape));
        if (selectedId === component.id && !shape.variantId) {
            return [];
        }
        const alternate = document.components[shape.variantId ?? selectedId];
        if (!component.variantIds?.includes(shape.variantId ?? selectedId) || !alternate) {
            return [`${shape.name}: selected variant is unavailable; showing the default.`];
        }
        return componentVariantProblems(document, componentId, alternate.id).map(
            (problem) => `${shape.name}: ${problem}`
        );
    });

    return {
        ids: selected.map((shape) => shape.id),
        /** Whether a selected instance keeps values for properties the source no longer exposes. */
        hasRetainedValues: selected.some((shape) =>
            Object.keys(shape.overrides).some(
                (id) => !component.props?.some((prop) => prop.id === id)
            )
        ),
        propertyProblems: [
            ...new Set(
                selected.flatMap((shape) => {
                    const active = document.components[instanceComponentId(document, drawn(shape))];
                    const missing = Object.keys(shape.overrides).filter(
                        (id) => !component.props?.some((prop) => prop.id === id)
                    );
                    const incompatible = (component.props ?? []).filter(
                        (prop) =>
                            shape.overrides[prop.id] !== undefined &&
                            active.props?.some(
                                (other) => other.id === prop.id && other.key === prop.key
                            ) &&
                            componentOverrideValue(shape, active, prop.id, document) === undefined
                    );

                    return [
                        ...(missing.length
                            ? [
                                  `${shape.name}: ${missing.length} saved property ${missing.length === 1 ? 'value is' : 'values are'} no longer exposed. Kept for when those properties return.`
                              ]
                            : []),
                        ...incompatible.map(
                            (prop) =>
                                `${shape.name}: saved value for “${prop.label}” cannot apply to this source. The value is kept.`
                        )
                    ];
                })
            )
        ],
        // Copies often share a name, so several instances can report the same line.
        variantProblems: [...new Set(variantProblems)],
        variants: [component, ...(component.variantIds ?? []).map((id) => document.components[id])]
            .filter((item) => Boolean(item))
            .map((item) => ({ id: item.id, name: item.name })),
        automatic: selected.some((shape) => shape.variantMode === 'auto'),
        responsiveDescriptions: selected.flatMap((shape) => {
            const decision = drawn(shape).projectedSource?.variant;

            return shape.variantMode === 'auto' && decision
                ? [
                      `${shape.name}: ${decision.explanation}${decision.problem ? `. ${decision.problem} Using the default source.` : ''}`
                  ]
                : [];
        }),
        selectedVariantId: selected.every(
            (shape) =>
                shape.variantId === selected[0].variantId &&
                shape.variantMode === selected[0].variantMode
        )
            ? (selected[0].variantId ??
              (selected[0].variantMode === 'auto' ? '__auto' : component.id))
            : '',
        rows: (component.props ?? []).flatMap((prop) => {
            const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

            if (!property) {
                return [];
            }
            const values = selected.map((shape) =>
                componentPropValue(
                    shape,
                    document.components[instanceComponentId(document, drawn(shape))],
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
        source && !source.deleted && editorLoaded()
            ? editorHelpers().library.componentFingerprint(source, componentId)
            : null;

    return Boolean(hash && hash !== library?.hash);
}

/** Why an imported component can't take its library's current version, or null. */
export function libraryUpdateProblem(state: Application, componentId: string): string | null {
    const library = state.currentDocument.components[componentId]?.library;
    const source = library && state.documents[library.documentId];

    if (!source || !editorLoaded()) {
        return null;
    }
    if (source.deleted) {
        return `${source.name} is in Recently Deleted. Restore it to get library updates.`;
    }
    if (!source.components[componentId]) {
        return `${source.name} no longer has this component. The last copy stays in use.`;
    }
    const problem = editorHelpers().library.libraryVersionProblem(source, componentId);

    return problem && `${problem} Updates wait until it's fixed; the last copy stays in use.`;
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
        mappings: componentPropertyMappings(document, componentId),
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
