import React, { FC, useState } from 'react';
import {
    useActions,
    useAppState,
    useComponents,
    useCurrentDocument,
    useSelectedShapesIds
} from 'src/app/hooks';
import { exposableProperties } from 'src/app/componentProps';
import { componentFingerprint } from 'src/app/componentLibrary';

/** Source controls; Insert arms the canvas for one placement. */
export const Components: FC = () => {
    const components = Object.values(useComponents() ?? {});
    const selected = useSelectedShapesIds();
    const actions = useActions();
    const document = useCurrentDocument();
    const libraries = useAppState((state) =>
        Object.values(state.documents)
            .filter((item) => item.id !== state.currentDocumentId)
            .flatMap((item) =>
                Object.values(item.components).map((component) => ({
                    documentId: item.id,
                    documentName: item.name,
                    componentId: component.id,
                    name: component.name,
                    hash: componentFingerprint(item, component.id),
                    imported: Boolean(state.currentDocument.components[component.id])
                }))
            )
    );
    const [chosenProps, setChosenProps] = useState<Record<string, number>>({});

    return (
        <section aria-label="Components">
            <button
                type="button"
                disabled={selected.length === 0}
                onClick={() => actions.createComponentFromSelection()}
            >
                Create component
            </button>
            {components.length === 0 && <p>No components yet</p>}
            <ul>
                {components.map((component) => (
                    <li key={component.id}>
                        <span>{component.name}</span>
                        {component.library &&
                            libraries.some(
                                (item) =>
                                    item.documentId === component.library?.documentId &&
                                    item.componentId === component.id &&
                                    item.hash !== component.library?.hash
                            ) && (
                                <button
                                    type="button"
                                    onClick={() => actions.updateLibraryComponent(component.id)}
                                >
                                    Update library copy
                                </button>
                            )}
                        <button
                            type="button"
                            onClick={() => actions.chooseComponentToPlace(component.id)}
                        >
                            Insert
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(component.library)}
                            onClick={() => actions.selectComponentSource(component.id)}
                        >
                            Select source
                        </button>
                        <button
                            type="button"
                            disabled={selected.length === 0 || Boolean(component.library)}
                            onClick={() =>
                                actions.addShapesToComponent({
                                    componentId: component.id,
                                    shapeIds: [...selected]
                                })
                            }
                        >
                            Add selection
                        </button>
                        <button
                            type="button"
                            disabled={selected.length === 0 || Boolean(component.library)}
                            onClick={() =>
                                actions.removeShapesFromComponent({
                                    componentId: component.id,
                                    shapeIds: [...selected]
                                })
                            }
                        >
                            Remove selection
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(component.library)}
                            onClick={() =>
                                actions.updateComponent({
                                    id: component.id,
                                    visible: !component.visible
                                })
                            }
                        >
                            {component.visible ? 'Hide source' : 'Show source'}
                        </button>
                        <button
                            type="button"
                            disabled={Boolean(component.library)}
                            onClick={() =>
                                actions.updateComponent({
                                    id: component.id,
                                    locked: !component.locked
                                })
                            }
                        >
                            {component.locked ? 'Unlock source' : 'Lock source'}
                        </button>
                        {!component.library &&
                            (() => {
                                const candidates = component.shapesIds.flatMap((id) => {
                                    const shape = document.shapes[id];

                                    return shape
                                        ? exposableProperties(shape, document).map((property) => ({
                                              shapeId: id,
                                              key: property.key,
                                              label: `${shape.name}: ${property.label}`
                                          }))
                                        : [];
                                });
                                const chosen = candidates[chosenProps[component.id] ?? 0];

                                return (
                                    <div>
                                        <select
                                            aria-label={`Property to expose for ${component.name}`}
                                            value={chosenProps[component.id] ?? 0}
                                            onChange={(event) =>
                                                setChosenProps({
                                                    ...chosenProps,
                                                    [component.id]: Number(event.target.value)
                                                })
                                            }
                                        >
                                            {candidates.map((item, index) => (
                                                <option
                                                    key={`${item.shapeId}:${item.key}`}
                                                    value={index}
                                                >
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            disabled={!chosen}
                                            onClick={() => {
                                                if (!chosen) {
                                                    return;
                                                }
                                                actions.exposeComponentProp({
                                                    componentId: component.id,
                                                    shapeId: chosen.shapeId,
                                                    key: chosen.key,
                                                    label: chosen.label
                                                });
                                            }}
                                        >
                                            Expose property
                                        </button>
                                    </div>
                                );
                            })()}
                        {component.props?.map((prop) => (
                            <div key={prop.id}>
                                {prop.label}
                                {!component.library && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            actions.removeComponentProp({
                                                componentId: component.id,
                                                propId: prop.id
                                            })
                                        }
                                    >
                                        Remove property
                                    </button>
                                )}
                            </div>
                        ))}
                    </li>
                ))}
            </ul>
            {libraries.length > 0 && (
                <section aria-label="Other documents">
                    <h3>Other documents</h3>
                    {libraries.map((item) => (
                        <div key={`${item.documentId}:${item.componentId}`}>
                            {item.documentName} / {item.name}
                            <button
                                type="button"
                                disabled={item.imported}
                                onClick={() =>
                                    actions.importLibraryComponent({
                                        documentId: item.documentId,
                                        componentId: item.componentId
                                    })
                                }
                            >
                                {item.imported ? 'Copied' : 'Copy here'}
                            </button>
                        </div>
                    ))}
                </section>
            )}
        </section>
    );
};
