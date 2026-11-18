import React from 'react';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { useStartFromTemplate } from './startFromTemplate';
import styles from './styles.css';

/** The journeys a first prototype starts from; Inspector typography shows component variants. */
const FIRST_TEMPLATES = STARTER_TEMPLATES.filter(({ id }) => id !== 'inspector-typography');

/** Offered on an empty canvas: start from a starter template, or keep the blank canvas. */
export default function StartPanel({ onBlank }: { onBlank: () => void }) {
    const { create, error } = useStartFromTemplate();

    return (
        <section className={styles.start} aria-labelledby="start-heading">
            <h2 id="start-heading">Start a prototype</h2>
            <p>
                Pick a starter with connected pages, change it, play it and share a link. It is
                yours to edit.
            </p>
            <div className={styles.templates}>
                {FIRST_TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        className={styles.template}
                        aria-label={`Start from ${template.name}`}
                        aria-describedby={`start-${template.id}`}
                        onClick={() => create(template.id)}
                    >
                        <strong>{template.name}</strong>
                        <span id={`start-${template.id}`}>{template.description}</span>
                    </button>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
            <button type="button" className={styles.blank} onClick={onBlank}>
                Start with a blank canvas
            </button>
        </section>
    );
}
