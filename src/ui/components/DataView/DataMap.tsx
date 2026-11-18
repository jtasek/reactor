import React, { forwardRef, useMemo, useRef, useState } from 'react';
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
    position?: { x: number; y: number };
    fields: MapField[];
}

const CARD_WIDTH = 220;
const COLUMN_GAP = 110;
const ROW_GAP = 32;
const MARGIN = 24;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 26;
/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD = 4;
/** Alt+arrow keys move a card by this much. */
const KEY_STEP = 16;
/** How far a line between cards in one column bows out to their right. */
const LOOP = 48;

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
        if (entity.position) {
            places.set(entity.id, { ...entity.position, height });
            continue;
        }
        const y = tops[column] ?? MARGIN;
        places.set(entity.id, { x: MARGIN + column * (CARD_WIDTH + COLUMN_GAP), y, height });
        tops[column] = y + height + ROW_GAP;
    }
    const all = [...places.values()];
    // Cards dragged above or left of the origin shift the drawing so they stay reachable.
    const left = Math.min(0, ...all.map((place) => place.x - MARGIN));
    const top = Math.min(0, ...all.map((place) => place.y - MARGIN));
    const width = Math.max(0, ...all.map((place) => place.x + CARD_WIDTH)) + MARGIN + LOOP - left;
    const height = Math.max(0, ...all.map((place) => place.y + place.height)) + MARGIN - top;

    return { places, width, height, left, top };
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

export const DataMap = forwardRef<
    HTMLDivElement,
    {
        entities: MapEntity[];
        selectedEntityId?: string;
        selectedFieldId?: string;
        problems: Record<string, number>;
        scale: number;
        disabled: boolean;
        selectEntity: (id: string) => void;
        selectField: (entityId: string, fieldId: string) => void;
        addField: (entityId: string) => void;
        move: (entityId: string, position: { x: number; y: number }) => void;
    }
>(function DataMap(
    {
        entities,
        selectedEntityId,
        selectedFieldId,
        problems,
        scale,
        disabled,
        selectEntity,
        selectField,
        addField,
        move
    },
    ref
) {
    const [drag, setDrag] = useState<{ id: string; dx: number; dy: number }>();
    const press = useRef<{ id: string; x: number; y: number; moved: boolean } | undefined>(
        undefined
    );
    const settled = useMemo(() => layoutEntities(entities), [entities]);
    const placeOf = (id: string) => settled.places.get(id)!;
    const { places, width, height, left, top } = drag
        ? layoutEntities(
              entities.map((entity) =>
                  entity.id === drag.id
                      ? {
                            ...entity,
                            position: {
                                x: placeOf(entity.id).x + drag.dx,
                                y: placeOf(entity.id).y + drag.dy
                            }
                        }
                      : entity
              )
          )
        : settled;

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
            const curve = (startX: number, endX: number) => {
                const middle = (startX + endX) / 2;

                return `M${startX} ${rowY} C${middle} ${rowY} ${middle} ${targetY} ${endX} ${targetY}`;
            };
            let path: string;
            if (to.x + CARD_WIDTH <= from.x) {
                path = curve(from.x, to.x + CARD_WIDTH);
            } else if (from.x + CARD_WIDTH <= to.x) {
                path = curve(from.x + CARD_WIDTH, to.x);
            } else {
                // The cards overlap sideways, or the field refers to its own entity: loop out
                // to the right of both.
                const edge = Math.max(from.x, to.x) + CARD_WIDTH;
                path = `M${from.x + CARD_WIDTH} ${rowY} C${edge + LOOP} ${rowY} ${edge + LOOP} ${targetY} ${to.x + CARD_WIDTH} ${targetY}`;
            }

            return [{ id: field.id, path, selected }];
        })
    );

    return (
        <div ref={ref} className={styles.map} aria-label="Data model map" role="group">
            <div
                className={styles.mapSize}
                style={{ width: width * scale, height: height * scale }}
            >
                <div
                    className={styles.mapCanvas}
                    style={{
                        width,
                        height,
                        transform: `scale(${scale}) translate(${-left}px, ${-top}px)`
                    }}
                >
                    <svg
                        className={styles.links}
                        width={width}
                        height={height}
                        viewBox={`${left} ${top} ${width} ${height}`}
                        style={{ transform: `translate(${left}px, ${top}px)` }}
                        aria-hidden
                    >
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
                                data-dragging={drag?.id === entity.id || undefined}
                                style={{ left: place.x, top: place.y, width: CARD_WIDTH }}
                            >
                                <button
                                    type="button"
                                    className={styles.cardHeader}
                                    aria-pressed={selected}
                                    aria-label={`Show ${entity.name}`}
                                    title={
                                        disabled
                                            ? undefined
                                            : 'Drag to move · Alt+arrow keys move it too'
                                    }
                                    onPointerDown={(event) => {
                                        if (disabled || event.button !== 0) {
                                            return;
                                        }
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        press.current = {
                                            id: entity.id,
                                            x: event.clientX,
                                            y: event.clientY,
                                            moved: false
                                        };
                                    }}
                                    onPointerMove={(event) => {
                                        const start = press.current;
                                        if (!start || start.id !== entity.id) {
                                            return;
                                        }
                                        const dx = (event.clientX - start.x) / scale;
                                        const dy = (event.clientY - start.y) / scale;
                                        if (
                                            !start.moved &&
                                            Math.hypot(dx, dy) * scale < DRAG_THRESHOLD
                                        ) {
                                            return;
                                        }
                                        start.moved = true;
                                        setDrag({ id: entity.id, dx, dy });
                                    }}
                                    onPointerUp={() => {
                                        const start = press.current;
                                        press.current = undefined;
                                        // The click that ends the press selects the card.
                                        if (start?.moved && drag) {
                                            const from = placeOf(entity.id);
                                            move(entity.id, {
                                                x: from.x + drag.dx,
                                                y: from.y + drag.dy
                                            });
                                        }
                                        setDrag(undefined);
                                    }}
                                    onPointerCancel={() => {
                                        press.current = undefined;
                                        setDrag(undefined);
                                    }}
                                    onClick={() => selectEntity(entity.id)}
                                    onKeyDown={(event) => {
                                        const step = {
                                            ArrowLeft: [-KEY_STEP, 0],
                                            ArrowRight: [KEY_STEP, 0],
                                            ArrowUp: [0, -KEY_STEP],
                                            ArrowDown: [0, KEY_STEP]
                                        }[event.key];
                                        if (!event.altKey || !step || disabled) {
                                            return;
                                        }
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const from = placeOf(entity.id);
                                        move(entity.id, {
                                            x: from.x + step[0],
                                            y: from.y + step[1]
                                        });
                                    }}
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
                                            data-problem={
                                                (selected && problems[field.id]) || undefined
                                            }
                                        >
                                            {selected && problems[field.id]
                                                ? `⚠ ${problems[field.id]}`
                                                : fieldSummary(
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
                                    disabled={disabled}
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
        </div>
    );
});
