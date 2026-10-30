import React, { FC } from 'react';
import { SquarePlus, FileSearch, CircleMinus, RefreshCw, ChevronLeft, Pencil } from 'lucide-react';
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
import {
    useComponent,
    useComponentVariants,
    useLibraryUpdateAvailable
} from 'src/app/componentHooks';
import styles from './styles.css';
import { ComponentRole } from './ComponentRole';

const ACTION_ICON = { component: SquarePlus, size: 16 };
const FIND_ICON = { component: FileSearch, size: 16 };
const EDIT_ICON = { component: Pencil, size: 16 };
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
        setComponentPropTarget,
        createComponentVariant,
        selectComponentSource,
        addComponentVariant,
        removeComponentVariant,
        updateLibraryComponent
    } = useActions();
    const updateAvailable = useLibraryUpdateAvailable(componentId);
    const instances = Object.values(document.shapes).filter(
        (shape) => shape.type === 'instance' && shape.componentId === componentId
    ).length;
    const readOnly = Boolean(component.library || component.locked || document.locked);
    const {
        family: variantFamily,
        variants,
        candidates: variantCandidates,
        problems: variantProblems,
        defaultProblems,
        mappings
    } = useComponentVariants(componentId);
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
            {variantFamily && (
                <nav className={styles.sourceChildBreadcrumb} aria-label="Variant family">
                    <button type="button" onClick={() => selectComponentSource(variantFamily.id)}>
                        <Icon icon={{ component: ChevronLeft, size: 16 }} />
                        <span>Variants of {variantFamily.name}</span>
                    </button>
                </nav>
            )}
            {variantProblems.map((problem) => (
                <p key={problem} role="status" className={styles.componentHint}>
                    {problem}
                </p>
            ))}
            {!variantFamily && (source || component.variantIds?.length) && (
                <div>
                    <h3 className={styles.heading}>Variants</h3>
                    {defaultProblems.map((problem) => (
                        <p key={problem} role="status" className={styles.componentHint}>
                            {problem}
                        </p>
                    ))}
                    <ul className={styles.componentProps}>
                        <li>
                            <span>{component.name} (default)</span>
                        </li>
                        {variants.map(({ id, name, editable, problems }) => {
                            return (
                                <li key={id}>
                                    <div className={styles.variantSummary}>
                                        <span>{name}</span>
                                        {problems.map((problem) => (
                                            <p
                                                key={problem}
                                                role="status"
                                                className={styles.componentHint}
                                            >
                                                {problem}
                                            </p>
                                        ))}
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            title={`Edit ${name}`}
                                            aria-label={`Edit variant ${name}`}
                                            disabled={!editable}
                                            onClick={() => selectComponentSource(id)}
                                        >
                                            <Icon icon={EDIT_ICON} />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            title={`Unlink ${name}`}
                                            aria-label={`Unlink variant ${name}`}
                                            disabled={readOnly}
                                            onClick={() =>
                                                removeComponentVariant({
                                                    componentId,
                                                    variantId: id
                                                })
                                            }
                                        >
                                            <Icon icon={REMOVE_ICON} />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <div className={styles.variantActions}>
                        <button
                            type="button"
                            disabled={readOnly || !source}
                            onClick={() => createComponentVariant(componentId)}
                        >
                            Create variant
                        </button>
                        {!readOnly && variantCandidates.length > 0 && (
                            <select
                                aria-label="Add component variant"
                                value=""
                                onChange={(event) =>
                                    addComponentVariant({
                                        componentId,
                                        variantId: event.target.value
                                    })
                                }
                            >
                                <option value="">Link existing variant…</option>
                                {variantCandidates.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                        {candidate.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            )}
            <div>
                <h3 className={styles.heading}>Editable properties</h3>
                {mappings.length > 0 ? (
                    <ul className={styles.componentProps}>
                        {mappings.map(({ prop, shapeId, exposed, editable, targets }) => (
                            <li key={prop.id}>
                                <div className={styles.propertyMapping}>
                                    <label htmlFor={`mapping-${componentId}-${prop.id}`}>
                                        {prop.label}
                                    </label>
                                    <select
                                        id={`mapping-${componentId}-${prop.id}`}
                                        aria-label={`Source for ${prop.label}`}
                                        value={shapeId}
                                        disabled={
                                            !editable || !targets.some((target) => !target.disabled)
                                        }
                                        onChange={(event) =>
                                            setComponentPropTarget({
                                                componentId,
                                                propId: prop.id,
                                                shapeId: event.target.value
                                            })
                                        }
                                    >
                                        {!shapeId && (
                                            <option value="" disabled>
                                                {targets.some((target) => !target.disabled)
                                                    ? 'Choose a source shape…'
                                                    : 'No compatible source shape'}
                                            </option>
                                        )}
                                        {targets.map((target) => (
                                            <option
                                                key={target.id}
                                                value={target.id}
                                                disabled={target.disabled}
                                            >
                                                {target.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    {!component.library && shapeId && (
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            title={`Select ${prop.label}`}
                                            aria-label={`Select ${prop.label}`}
                                            onClick={() =>
                                                selectComponentChild({
                                                    componentId,
                                                    shapeId
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
                                        disabled={readOnly || !exposed}
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
