import React from 'react';
import { Plus, Table2 } from 'lucide-react';
import type { DataType } from 'src/app/dataTypes';
import { TypeIcon } from './TypeIcon';
import styles from './styles.css';

export interface MapField {
    id: string;
    name: string;
    type: DataType;
    required: boolean;
    optionCount: number;
    targetEntityId?: string;
}

export interface MapEntity {
    id: string;
    name: string;
    records: number;
    labelFieldId?: string;
    fields: MapField[];
}

const CARD_WIDTH = 220;
const COLUMN_GAP = 110;
const ROW_GAP = 32;
const MARGIN = 24;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 26;

/**
 * Places each entity one column right of the entities it refers to, so references read left to
 * right; a cycle stops at the entity where it closes.
 */
export function layoutEntities(entities: MapEntity[]) {
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const columns = new Map<string, number>();
    const columnOf = (entity: MapEntity, visiting: Set<string>): number => {
        const known = columns.get(entity.id);
        if (known !== undefined) {
            return known;
        }
        visiting.add(entity.id);
        let column = 0;
        for (const field of entity.fields) {
            const target = field.targetEntityId && byId.get(field.targetEntityId);
            if (target && !visiting.has(target.id)) {
                column = Math.max(column, columnOf(target, visiting) + 1);
            }
        }
        visiting.delete(entity.id);
        columns.set(entity.id, column);

        return column;
    };
    const tops: number[] = [];
    const places = new Map<string, { x: number; y: number; height: number }>();
    for (const entity of entities) {
        const column = columnOf(entity, new Set());
        const height = HEADER_HEIGHT + (entity.fields.length + 1) * ROW_HEIGHT + 8;
        const y = tops[column] ?? MARGIN;
        places.set(entity.id, { x: MARGIN + column * (CARD_WIDTH + COLUMN_GAP), y, height });
        tops[column] = y + height + ROW_GAP;
    }
    const width =
        Math.max(0, ...[...places.values()].map((place) => place.x + CARD_WIDTH)) + MARGIN;
    const height =
        Math.max(0, ...[...places.values()].map((place) => place.y + place.height)) + MARGIN;

    return { places, width, height };
}

const fieldSummary = (field: MapField, entities: Map<string, MapEntity>, label: boolean) =>
    field.type === 'reference'
        ? `→ ${entities.get(field.targetEntityId ?? '')?.name ?? 'Deleted entity'}`
        : field.type === 'choice'
          ? `${field.optionCount} ${field.optionCount === 1 ? 'option' : 'options'}`
          : field.type === 'boolean'
            ? 'yes/no'
            : label
              ? `${field.type} · names`
              : field.type;

export function DataMap({
    entities,
    selectedEntityId,
    selectedFieldId,
    problems,
    selectEntity,
    selectField,
    addField
}: {
    entities: MapEntity[];
    selectedEntityId?: string;
    selectedFieldId?: string;
    /** Problems per field of the selected entity. */
    problems: Record<string, number>;
    selectEntity: (id: string) => void;
    selectField: (entityId: string, fieldId: string) => void;
    addField: (entityId: string) => void;
}) {
    const { places, width, height } = layoutEntities(entities);
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const links = entities.flatMap((entity) =>
        entity.fields.flatMap((field, index) => {
            const from = places.get(entity.id);
            const to = places.get(field.targetEntityId ?? '');
            if (field.type !== 'reference' || !from || !to) {
                return [];
            }
            const rowY = from.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
            const targetY = to.y + HEADER_HEIGHT / 2;
            const selected =
                entity.id === selectedEntityId || to === places.get(selectedEntityId ?? '');
            let path: string;
            if (to.x < from.x) {
                const startX = to.x + CARD_WIDTH;
                const middle = (startX + from.x) / 2;
                path = `M${startX} ${targetY} C${middle} ${targetY} ${middle} ${rowY} ${from.x} ${rowY}`;
            } else {
                // Same column, or a cycle: loop out to the right of both cards.
                const edge = Math.max(from.x, to.x) + CARD_WIDTH;
                path = `M${from.x + CARD_WIDTH} ${rowY} C${edge + 48} ${rowY} ${edge + 48} ${targetY} ${to.x + CARD_WIDTH} ${targetY}`;
            }

            return [{ id: field.id, path, selected }];
        })
    );

    return (
        <div className={styles.map} aria-label="Data model map" role="group">
            <div className={styles.mapCanvas} style={{ width, height }}>
                <svg className={styles.links} width={width} height={height} aria-hidden>
                    {links.map((link) => (
                        <path
                            key={link.id}
                            d={link.path}
                            data-selected={link.selected || undefined}
                        />
                    ))}
                </svg>
                {entities.map((entity) => {
                    const place = places.get(entity.id)!;
                    const selected = entity.id === selectedEntityId;

                    return (
                        <div
                            key={entity.id}
                            className={styles.card}
                            data-selected={selected || undefined}
                            style={{ left: place.x, top: place.y, width: CARD_WIDTH }}
                        >
                            <button
                                type="button"
                                className={styles.cardHeader}
                                aria-pressed={selected}
                                aria-label={`Show ${entity.name}`}
                                onClick={() => selectEntity(entity.id)}
                            >
                                <Table2 aria-hidden size={14} />
                                <span>{entity.name}</span>
                                <small>{entity.records}</small>
                            </button>
                            {entity.fields.map((field) => (
                                <button
                                    key={field.id}
                                    type="button"
                                    className={styles.cardField}
                                    aria-pressed={field.id === selectedFieldId}
                                    aria-label={`${entity.name} field ${field.name}`}
                                    onClick={() => selectField(entity.id, field.id)}
                                >
                                    <TypeIcon type={field.type} />
                                    <span>
                                        {field.name}
                                        {field.required && (
                                            <span className={styles.required}> *</span>
                                        )}
                                    </span>
                                    <small
                                        data-problem={(selected && problems[field.id]) || undefined}
                                    >
                                        {selected && problems[field.id] ? '⚠ ' : ''}
                                        {fieldSummary(
                                            field,
                                            byId,
                                            field.id === entity.labelFieldId
                                        )}
                                    </small>
                                </button>
                            ))}
                            <button
                                type="button"
                                className={styles.cardAdd}
                                aria-label={`Add field to ${entity.name}`}
                                onClick={() => addField(entity.id)}
                            >
                                <Plus aria-hidden size={12} />
                                Field
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
