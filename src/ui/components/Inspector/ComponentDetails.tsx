import React, { FC } from 'react';
import { SquarePlus, FileSearch, CircleMinus, RefreshCw, ChevronLeft } from 'lucide-react';
import {
    useActions,
    useCurrentDocument,
    useComponentSource,
    useVariableContext
} from 'src/app/hooks';
import type { InstanceShape } from 'src/app/types';
import { Icon } from '../Icon';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { Instance } from '../Shape/Instance';
import { useComponent, useLibraryUpdateAvailable } from 'src/app/componentHooks';
import styles from './styles.css';
import { ComponentRole } from './ComponentRole';

const ACTION_ICON = { component: SquarePlus, size: 16 };
const FIND_ICON = { component: FileSearch, size: 16 };
const REMOVE_ICON = { component: CircleMinus, size: 16 };
const UPDATE_ICON = { component: RefreshCw, size: 16 };

export const ComponentDetails: FC<{ componentId: string }> = ({ componentId }) => {
    const component = useComponent(componentId);
    const document = useCurrentDocument();
    const context = useVariableContext();
    const source = useComponentSource(componentId);
    const {
        chooseComponentToPlace,
        selectComponentChild,
        removeComponentProp,
        updateLibraryComponent
    } = useActions();
    const updateAvailable = useLibraryUpdateAvailable(componentId);
    const instances = Object.values(document.shapes).filter(
        (shape) => shape.type === 'instance' && shape.componentId === componentId
    ).length;
    const readOnly = Boolean(component.library || component.locked || document.locked);
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
                    <small>
                        Used by {instances} {instances === 1 ? 'instance' : 'instances'}
                    </small>
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
                    <Instance instance={preview} source={source} context={context} />
                </svg>
            )}
            <ComponentRole componentId={componentId} />
            <div>
                <h3 className={styles.heading}>Editable properties</h3>
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

export const SourceChildBreadcrumb: FC<{ componentId: string }> = ({ componentId }) => {
    const component = useComponent(componentId);
    const { selectComponentSource } = useActions();

    return (
        <nav className={styles.sourceChildBreadcrumb} aria-label="Component hierarchy">
            <button
                type="button"
                title={`Select ${component.name} source`}
                aria-label={`Select ${component.name} source`}
                onClick={() => selectComponentSource(componentId)}
            >
                <Icon icon={{ component: ChevronLeft, size: 16 }} />
                <ObjectTypeSymbol type="component" />
                <span>{component.name}</span>
            </button>
        </nav>
    );
};
