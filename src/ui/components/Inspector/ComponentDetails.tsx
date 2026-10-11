import React, { FC, useState } from 'react';
import { useActions, useComponent, useComponentSource, useCurrentDocument } from 'src/app/hooks';
import type { InstanceShape } from 'src/app/types';
import { Icon } from '../Icon';
import { Instance } from '../Shape/Instance';
import { useComponentLibraries } from 'src/app/componentHooks';
import styles from './styles.css';

const ACTION_ICON = { group: 'content', name: 'add_box', size: 16 };
const FIND_ICON = { group: 'action', name: 'find_in_page', size: 16 };
const REMOVE_ICON = { group: 'content', name: 'remove_circle', size: 16 };
const UPDATE_ICON = { group: 'action', name: 'update', size: 16 };

/** A source has one name and one set of exposed properties for all its instances. */
export const ComponentDetails: FC<{ componentId: string }> = ({ componentId }) => {
    const component = useComponent(componentId);
    const document = useCurrentDocument();
    const source = useComponentSource(componentId);
    const libraries = useComponentLibraries();
    const [name, setName] = useState(component.name);
    const {
        updateComponent,
        chooseComponentToPlace,
        selectComponentChild,
        removeComponentProp,
        updateLibraryComponent
    } = useActions();
    const updateAvailable = Boolean(
        component.library &&
        libraries.some(
            (item) =>
                item.documentId === component.library?.documentId &&
                item.componentId === componentId &&
                item.hash !== component.library?.hash
        )
    );
    const instances = Object.values(document.shapes).filter(
        (shape) => shape.type === 'instance' && shape.componentId === componentId
    ).length;
    const readOnly = Boolean(component.library || component.locked || document.locked);
    const handleRename = () => {
        const next = name.trim();
        if (!next || readOnly) {
            setName(component.name);

            return;
        }
        updateComponent({ id: componentId, name: next });
    };
    const preview: InstanceShape = {
        id: 'component-preview',
        key: 'component-preview',
        type: 'instance',
        active: false,
        created: document.created,
        createdBy: document.createdBy,
        modified: document.modified,
        modifiedBy: document.modifiedBy,
        locked: false,
        name: component.name,
        order: 'a0',
        selected: false,
        visible: true,
        componentId,
        position: source?.box.topLeft ?? { x: 0, y: 0 },
        overrides: {}
    };

    return (
        <section className={styles.componentDetails} aria-label="Component source">
            <div className={styles.componentHeading}>
                <div>
                    <strong>{component.name}</strong>
                    <small>Source · used by {instances} instances</small>
                </div>
                {updateAvailable && (
                    <button
                        type="button"
                        className={styles.iconButton}
                        title="Update from library"
                        aria-label="Update from library"
                        onClick={() => updateLibraryComponent(componentId)}
                    >
                        <Icon icon={UPDATE_ICON} />
                    </button>
                )}
                <button
                    type="button"
                    className={styles.iconButton}
                    title="Place instance"
                    aria-label="Place instance"
                    disabled={!source || document.locked}
                    onClick={() => chooseComponentToPlace(componentId)}
                >
                    <Icon icon={ACTION_ICON} />
                </button>
            </div>
            {source && (
                <svg
                    className={styles.componentPreview}
                    role="img"
                    aria-label={`${component.name} preview`}
                    viewBox={`${source.box.topLeft.x - 8} ${source.box.topLeft.y - 8} ${Math.max(1, source.box.width + 16)} ${Math.max(1, source.box.height + 16)}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    <Instance instance={preview} source={source} />
                </svg>
            )}
            <label className={styles.componentName}>
                Name
                <input
                    type="text"
                    value={name}
                    readOnly={readOnly}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur();
                        }
                    }}
                />
            </label>
            <div>
                <h3 className={styles.heading}>Editable in instances</h3>
                {component.props?.length ? (
                    <ul className={styles.componentProps}>
                        {component.props.map((prop) => (
                            <li key={prop.id}>
                                <span>{prop.label}</span>
                                <div>
                                    {!component.library && (
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            title={`Select ${prop.label}`}
                                            aria-label={`Select ${prop.label}`}
                                            onClick={() =>
                                                selectComponentChild({
                                                    componentId,
                                                    shapeId: prop.shapeId
                                                })
                                            }
                                        >
                                            <Icon icon={FIND_ICON} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.iconButton}
                                        title={`Stop exposing ${prop.label}`}
                                        aria-label={`Stop exposing ${prop.label}`}
                                        disabled={readOnly}
                                        onClick={() =>
                                            removeComponentProp({ componentId, propId: prop.id })
                                        }
                                    >
                                        <Icon icon={REMOVE_ICON} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.componentHint}>
                        Select a source shape to choose what instances can change.
                    </p>
                )}
            </div>
            {component.library && <p className={styles.componentHint}>Imported library source</p>}
        </section>
    );
};

export const SourceChildHeading: FC<{ componentId: string; shapeId: string }> = ({
    componentId,
    shapeId
}) => {
    const component = useComponent(componentId);
    const document = useCurrentDocument();
    const shape = document.shapes[shapeId];
    const { selectComponentSource } = useActions();

    return (
        <div className={styles.sourceChildHeading}>
            <strong>{shape?.name}</strong>
            <small>Source shape · changes update instances</small>
            <button
                type="button"
                title={`Select ${component.name} source`}
                aria-label={`Select ${component.name} source`}
                onClick={() => selectComponentSource(componentId)}
            >
                <Icon icon={FIND_ICON} />
                {component.name}
            </button>
            <p>Use + beside a property to let instances change it.</p>
        </div>
    );
};
