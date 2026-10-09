import React, { FC, MouseEvent } from 'react';
import { useActions, useAppState, useComponents, useSelectedShapesIds } from 'src/app/hooks';
import { useComponentLibraries } from 'src/app/componentHooks';
import { PropertyPicker } from './PropertyPicker';

/** Source controls; Insert arms the canvas for one placement. */
export const Components: FC = () => {
    const components = Object.values(useComponents() ?? {});
    const selected = useSelectedShapesIds();
    const actions = useActions();
    const libraries = useComponentLibraries();
    const handleCreate = () => actions.createComponentFromSelection();

    return (
        <section aria-label="Components">
            <button type="button" disabled={selected.length === 0} onClick={handleCreate}>
                Create component
            </button>
            {components.length === 0 && <p>No components yet</p>}
            <ul>
                {components.map((component) => (
                    <ComponentRow
                        key={component.id}
                        componentId={component.id}
                        updateAvailable={Boolean(
                            component.library &&
                            libraries.some(
                                (item) =>
                                    item.documentId === component.library?.documentId &&
                                    item.componentId === component.id &&
                                    item.hash !== component.library?.hash
                            )
                        )}
                    />
                ))}
            </ul>
            {libraries.length > 0 && (
                <section aria-label="Other documents">
                    <h3>Other documents</h3>
                    {libraries.map((item) => (
                        <LibraryRow key={`${item.documentId}:${item.componentId}`} item={item} />
                    ))}
                </section>
            )}
        </section>
    );
};

const ComponentRow: FC<{ componentId: string; updateAvailable: boolean }> = ({
    componentId,
    updateAvailable
}) => {
    const component = useAppState((state) => state.currentDocument.components[componentId]);
    const selected = useSelectedShapesIds();
    const actions = useActions();
    const handleUpdate = () => actions.updateLibraryComponent(componentId);
    const handleInsert = () => actions.chooseComponentToPlace(componentId);
    const handleSelect = () => actions.selectComponentSource(componentId);
    const handleAddSelection = () =>
        actions.addShapesToComponent({ componentId, shapeIds: [...selected] });
    const handleRemoveSelection = () =>
        actions.removeShapesFromComponent({ componentId, shapeIds: [...selected] });
    const handleToggleVisibility = () =>
        actions.updateComponent({ id: componentId, visible: !component.visible });
    const handleToggleLock = () =>
        actions.updateComponent({ id: componentId, locked: !component.locked });
    const handleRemoveProperty = (event: MouseEvent<HTMLButtonElement>) =>
        actions.removeComponentProp({ componentId, propId: event.currentTarget.value });

    return (
        <li>
            <span>{component.name}</span>
            {updateAvailable && (
                <button type="button" onClick={handleUpdate}>
                    Update library copy
                </button>
            )}
            <button type="button" onClick={handleInsert}>
                Insert
            </button>
            <button type="button" disabled={Boolean(component.library)} onClick={handleSelect}>
                Select source
            </button>
            <button
                type="button"
                disabled={selected.length === 0 || Boolean(component.library)}
                onClick={handleAddSelection}
            >
                Add selection
            </button>
            <button
                type="button"
                disabled={selected.length === 0 || Boolean(component.library)}
                onClick={handleRemoveSelection}
            >
                Remove selection
            </button>
            <button
                type="button"
                disabled={Boolean(component.library)}
                onClick={handleToggleVisibility}
            >
                {component.visible ? 'Hide source' : 'Show source'}
            </button>
            <button type="button" disabled={Boolean(component.library)} onClick={handleToggleLock}>
                {component.locked ? 'Unlock source' : 'Lock source'}
            </button>
            {!component.library && (
                <PropertyPicker componentId={component.id} name={component.name} />
            )}
            {component.props?.map((prop) => (
                <div key={prop.id}>
                    {prop.label}
                    {!component.library && (
                        <button type="button" value={prop.id} onClick={handleRemoveProperty}>
                            Remove property
                        </button>
                    )}
                </div>
            ))}
        </li>
    );
};

const LibraryRow: FC<{ item: ReturnType<typeof useComponentLibraries>[number] }> = ({ item }) => {
    const actions = useActions();
    const handleImport = () =>
        actions.importLibraryComponent({
            documentId: item.documentId,
            componentId: item.componentId
        });

    return (
        <div>
            {item.documentName} / {item.name}
            <button type="button" disabled={item.imported} onClick={handleImport}>
                {item.imported ? 'Copied' : 'Copy here'}
            </button>
        </div>
    );
};
