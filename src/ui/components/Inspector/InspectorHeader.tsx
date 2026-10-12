import React, { FC, ReactNode, useEffect, useState } from 'react';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import { useComponent } from 'src/app/componentHooks';
import type { PropertyRow, PropertyValue } from 'src/app/properties';
import type { Variable } from 'src/app/types';
import { Icon } from '../Icon';
import { ObjectTypeSymbol, type ObjectType } from '../ObjectTypeSymbol';
import styles from './styles.css';

interface Props {
    nameField?: ReactNode;
    count?: number;
    componentId?: string;
    objectType?: ObjectType;
    source?: boolean;
    shapeIds?: string[];
    visibleRow?: PropertyRow;
    lockedRow?: PropertyRow;
    variables?: Variable[];
    bound?: Record<string, Variable>;
    onChange?: (shapeIds: string[], key: string, value: PropertyValue) => void;
    onBind?: (shapeIds: string[], key: string, variableId: string) => void;
    onUnbind?: (shapeIds: string[], key: string) => void;
    visibleExposure?: { active: boolean; disabled: boolean; onToggle: () => void };
    lockedExposure?: { active: boolean; disabled: boolean; onToggle: () => void };
}

export const InspectorHeader: FC<Props> = ({
    nameField,
    count,
    componentId,
    objectType,
    source,
    shapeIds = [],
    visibleRow,
    lockedRow,
    variables = [],
    bound = {},
    onChange,
    onBind,
    onUnbind,
    visibleExposure,
    lockedExposure
}) => {
    const component = useComponent(componentId ?? '');
    const document = useCurrentDocument();
    const { selectComponentSource, updateComponent } = useActions();
    const [sourceName, setSourceName] = useState(component?.name ?? '');
    const componentName = component?.name;
    useEffect(() => {
        if (source && componentName) {
            setSourceName(componentName);
        }
    }, [source, componentName]);
    const sourceReadOnly = Boolean(component?.library || component?.locked || document.locked);
    const sourceVisible = source && component ? component.visible : undefined;
    const sourceLocked = source && component ? component.locked : undefined;
    const visible = source ? sourceVisible : visibleRow?.value;
    const locked = source ? sourceLocked : lockedRow?.value;
    const canChangeSource = Boolean(source && component && !component.library && !document.locked);
    const canChangeVisible = source ? canChangeSource : Boolean(visibleRow && !visibleRow.readOnly);
    const canChangeLocked = source ? canChangeSource : Boolean(lockedRow && !lockedRow.readOnly);
    const booleanVariables = variables.filter((variable) => variable.type === 'boolean');

    const renameSource = () => {
        if (!component) {
            return;
        }
        const name = sourceName.trim();
        if (!name || sourceReadOnly) {
            setSourceName(component.name);
            return;
        }
        updateComponent({ id: component.id, name });
        setSourceName(name);
    };
    const changeState = (key: 'visible' | 'locked', value: boolean) => {
        if (source && component) {
            updateComponent({ id: component.id, [key]: value });
            return;
        }
        onChange?.(shapeIds, key, value);
    };

    return (
        <header className={styles.inspectorHeader}>
            <div className={styles.headerIdentity}>
                {objectType && <ObjectTypeSymbol type={objectType} size={20} />}
                {source && component ? (
                    <input
                        aria-label="Name"
                        className={styles.headerSourceName}
                        type="text"
                        value={sourceName}
                        readOnly={sourceReadOnly}
                        onChange={(event) => setSourceName(event.target.value)}
                        onBlur={renameSource}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.currentTarget.blur();
                            }
                            if (event.key === 'Escape') {
                                setSourceName(component.name);
                                event.currentTarget.blur();
                            }
                        }}
                    />
                ) : count && count > 1 ? (
                    <strong>{count} objects</strong>
                ) : (
                    nameField
                )}
            </div>
            <div className={styles.headerActions}>
                {(source ? visible !== undefined : Boolean(visibleRow)) && (
                    <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={visible === true ? 'Hide' : 'Show'}
                        aria-pressed={visible === true}
                        title={visible === true ? 'Hide' : 'Show'}
                        disabled={!canChangeVisible || Boolean(bound.visible)}
                        onClick={() => changeState('visible', visible !== true)}
                    >
                        <Icon
                            icon={{
                                group: 'action',
                                name: visible === true ? 'visibility' : 'visibility_off',
                                size: 16
                            }}
                        />
                    </button>
                )}
                {(source ? locked !== undefined : Boolean(lockedRow)) && (
                    <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={locked === true ? 'Unlock' : 'Lock'}
                        aria-pressed={locked === true}
                        title={locked === true ? 'Unlock' : 'Lock'}
                        disabled={!canChangeLocked || Boolean(bound.locked)}
                        onClick={() => changeState('locked', locked !== true)}
                    >
                        <Icon
                            icon={{
                                group: 'action',
                                name: locked === true ? 'lock_outline' : 'lock_open',
                                size: 16
                            }}
                        />
                    </button>
                )}
                {((componentId && !source) ||
                    visibleExposure ||
                    lockedExposure ||
                    bound.visible ||
                    bound.locked ||
                    booleanVariables.length > 0) && (
                    <details className={styles.headerMenu}>
                        <summary
                            className={styles.iconButton}
                            aria-label="More inspector actions"
                            title="More actions"
                        >
                            <Icon icon={{ group: 'navigation', name: 'more_horiz', size: 16 }} />
                        </summary>
                        <div className={styles.headerMenuContents}>
                            {componentId && !source && (
                                <button
                                    type="button"
                                    onClick={() => selectComponentSource(componentId)}
                                >
                                    Edit component
                                </button>
                            )}
                            {(
                                [
                                    ['Visible', visibleExposure],
                                    ['Locked', lockedExposure]
                                ] as const
                            ).map(([label, exposure]) => {
                                if (!exposure) {
                                    return null;
                                }
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        aria-pressed={exposure.active}
                                        disabled={exposure.disabled}
                                        onClick={exposure.onToggle}
                                    >
                                        {exposure.active
                                            ? `Stop exposing ${label}`
                                            : `Expose ${label} to instances`}
                                    </button>
                                );
                            })}
                            {!source &&
                                (['visible', 'locked'] as const).map((key) => {
                                    const row = key === 'visible' ? visibleRow : lockedRow;
                                    if (!row || (!bound[key] && booleanVariables.length === 0)) {
                                        return null;
                                    }
                                    const variable = bound[key];
                                    return (
                                        <div key={key} className={styles.headerBinding}>
                                            <label htmlFor={`header-variable-${key}`}>
                                                {row.property.label} variable
                                            </label>
                                            <select
                                                id={`header-variable-${key}`}
                                                value={variable?.id ?? ''}
                                                disabled={row.readOnly}
                                                onChange={(event) => {
                                                    if (!event.target.value) {
                                                        onUnbind?.(shapeIds, key);
                                                        return;
                                                    }
                                                    onBind?.(shapeIds, key, event.target.value);
                                                }}
                                            >
                                                <option value="">None</option>
                                                {booleanVariables.map((item) => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                        </div>
                    </details>
                )}
            </div>
        </header>
    );
};
