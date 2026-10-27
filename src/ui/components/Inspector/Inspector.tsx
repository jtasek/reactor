import React, { FC } from 'react';
import styles from './styles.css';
import { ComponentRole } from './ComponentRole';
import { SizingFields } from './SizingFields';
import { FrameParent } from './FrameParent';
import { PropertyField } from './PropertyField';
import { PropertyGroup } from './PropertyGroup';
import { AlignSection } from './AlignSection';
import { ModeFields } from './ModeFields';
import { InstanceProps } from './InstanceProps';
import { ComponentDetails, SourceChildBreadcrumb } from './ComponentDetails';
import { InspectorHeader } from './InspectorHeader';
import { useComponentExposure, useSelectedComponentContext } from 'src/app/componentHooks';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import { canBind } from 'src/app/variables';
import type { SelectionIdentity } from '../selectionIdentity';
import { groupRows, type PropertyRow, type PropertyValue } from 'src/app/properties';
import type { Variable } from 'src/app/types';

export interface Props {
    rows: PropertyRow[];
    shapeIds: string[];
    identity: SelectionIdentity | null;
    onChange: (shapeIds: string[], key: string, value: PropertyValue) => void;
    variables: Variable[];
    /** The variable every shape follows for a property, by its key. */
    bound: Record<string, Variable>;
    /** What a field's value cannot show, by property key. */
    notes: Record<string, string>;
    onBind: (shapeIds: string[], key: string, variableId: string) => void;
    onUnbind: (shapeIds: string[], key: string) => void;
}

/**
 * The properties every selected shape shares, in sections; editing one changes
 * all of them.
 */
export const Inspector: FC<Props> = ({
    rows,
    shapeIds,
    identity,
    onChange,
    variables,
    bound,
    notes,
    onBind,
    onUnbind
}) => {
    const componentContext = useSelectedComponentContext();
    const document = useCurrentDocument();
    const exposure = useComponentExposure(
        componentContext?.kind === 'child' ? componentContext.componentId : null,
        componentContext?.kind === 'child' ? componentContext.shapeId : null
    );
    const { exposeComponentProp, removeComponentProp } = useActions();
    const propertyField = (row: PropertyRow) => (
        <PropertyField
            key={row.property.key}
            row={row}
            shapeIds={shapeIds}
            onChange={onChange}
            variables={variables.filter((variable) => variable.type === row.property.kind)}
            unavailableVariables={variables
                .filter(
                    (variable) =>
                        variable.type === row.property.kind &&
                        !shapeIds.every(
                            (id) =>
                                document.shapes[id] &&
                                canBind(row.property, document.shapes[id], document, variable)
                        )
                )
                .map((variable) => variable.id)}
            variable={bound[row.property.key]}
            note={notes[row.property.key]}
            onBind={onBind}
            onUnbind={onUnbind}
            exposure={exposureFor(row.property.key)}
        />
    );
    const exposureFor = (key: string) => {
        if (!exposure || componentContext?.kind !== 'child') {
            return undefined;
        }
        const candidate = exposure.candidates.find((item) => item.key === key);

        if (!candidate) {
            return undefined;
        }
        const prop = exposure.props.find(
            (item) => item.shapeId === componentContext.shapeId && item.key === candidate.key
        );

        return {
            active: Boolean(prop),
            disabled: exposure.disabled,
            onToggle: () => {
                if (prop) {
                    removeComponentProp({
                        componentId: componentContext.componentId,
                        propId: prop.id
                    });

                    return;
                }
                exposeComponentProp({
                    componentId: componentContext.componentId,
                    shapeId: componentContext.shapeId,
                    key: candidate.key,
                    label: candidate.label
                });
            }
        };
    };

    if (componentContext?.kind === 'source') {
        return (
            <div key={`source-${componentContext.componentId}`} className={styles.inspector}>
                <InspectorHeader
                    source
                    componentId={componentContext.componentId}
                    objectType="component"
                />
                <ComponentDetails componentId={componentContext.componentId} />
            </div>
        );
    }

    if (shapeIds.length === 0) {
        if (!identity) {
            return <div className={styles.inspector}>No shapes selected</div>;
        }

        return (
            <div className={styles.inspector}>
                <InspectorHeader
                    objectType={identity.type}
                    nameField={<strong>{identity.name}</strong>}
                />
            </div>
        );
    }

    const instance = componentContext?.kind === 'instance';
    const nameRow = rows.find((row) => row.property.key === 'name');
    const visibleRow = rows.find((row) => row.property.key === 'visible');
    const lockedRow = rows.find((row) => row.property.key === 'locked');
    const shownRows = rows.filter(
        (row) =>
            !['visible', 'locked'].includes(row.property.key) &&
            (row.property.key !== 'name' || shapeIds.length > 1)
    );
    let nameField: React.ReactNode = null;

    if (identity?.type === 'group') {
        nameField = <strong>{identity.name}</strong>;
    } else if (nameRow && shapeIds.length === 1) {
        nameField = (
            <table className={styles.headerName}>
                <tbody>{propertyField(nameRow)}</tbody>
            </table>
        );
    }

    return (
        <div
            key="selection"
            className={`${styles.inspector} ${instance ? styles.instanceInspector : ''}`}
        >
            {componentContext?.kind === 'child' && (
                <SourceChildBreadcrumb componentId={componentContext.componentId} />
            )}
            <InspectorHeader
                objectType={identity?.type}
                nameField={nameField}
                count={identity?.type === 'group' ? 1 : shapeIds.length}
                componentId={componentContext?.componentId}
                shapeIds={shapeIds}
                visibleRow={visibleRow}
                lockedRow={lockedRow}
                variables={variables}
                bound={bound}
                onChange={onChange}
                onBind={onBind}
                onUnbind={onUnbind}
                visibleExposure={exposureFor('visible')}
                lockedExposure={exposureFor('locked')}
            />
            {instance && shapeIds.length === 1 && <ComponentRole instanceId={shapeIds[0]} />}
            {instance && <InstanceProps />}
            <AlignSection />
            <table>
                {instance && shapeIds.length === 1 && (
                    <ModeFields target={{ instanceId: shapeIds[0] }} />
                )}
                <PropertyGroup name="Frame">
                    <FrameParent shapeIds={shapeIds} />
                </PropertyGroup>
                {shapeIds.length === 1 && <SizingFields shapeId={shapeIds[0]} />}
                {groupRows(shownRows).map(({ group, rows: grouped }) => (
                    <PropertyGroup key={group} name={group}>
                        {grouped.map(propertyField)}
                    </PropertyGroup>
                ))}
            </table>
        </div>
    );
};
