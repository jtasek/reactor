import React, { FC } from 'react';
import { useCamera, usePointer, useShapes } from 'src/app/hooks';
import styles from './styles.css';

const printObject = (value: unknown): string => {
    if (Array.isArray(value)) {
        return value.map((val) => printObject(val)).join(', ');
    }

    if (typeof value === 'object' && value !== null) {
        return Object.entries(value)
            .map(([key, val]) => `${key}: ${printObject(val)}`)
            .join(', ');
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
        return String(Math.floor(value));
    }

    return String(value);
};

const Section: FC<{ name: string; rows: [string, string][] }> = ({ name, rows }) => (
    <section className={styles.section} aria-label={name}>
        <h4 className={styles.heading}>{name}</h4>
        <dl className={styles.card}>
            {rows.map(([label, value]) => (
                <div key={label} className={styles.row}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    </section>
);

/** What the document holds and what the pointer is doing, for debugging. */
export const Stats: FC = () => {
    const shapes = useShapes();
    const camera = useCamera();
    const pointer = usePointer();

    return (
        <div className={styles.stats}>
            <Section
                name="Document"
                rows={[
                    ['Shapes', String(Object.keys(shapes).length)],
                    ['Scale', String(camera.scale)]
                ]}
            />
            <Section
                name="Pointer"
                rows={[
                    ['Dragging', printObject(pointer.dragging)],
                    ['Start', printObject(pointer.start)],
                    ['Current', printObject(pointer.current)],
                    ['Top left', printObject(pointer.topLeft)],
                    ['Bottom right', printObject(pointer.bottomRight)],
                    ['Center', printObject(pointer.center)],
                    ['Size', printObject(pointer.size)],
                    ['Offset', printObject(pointer.offset)],
                    ['Radius', printObject(pointer.radius)],
                    ['Path', printObject(pointer.path.length)]
                ]}
            />
        </div>
    );
};
