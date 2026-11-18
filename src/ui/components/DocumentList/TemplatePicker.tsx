import React, { useEffect, useRef } from 'react';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { useStartFromTemplate } from '../FirstRun/startFromTemplate';
import styles from './templates.css';

export default function TemplatePicker({ onClose }: { onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const { create, error } = useStartFromTemplate(onClose);

    useEffect(() => {
        const previous = document.activeElement;
        const element = dialog.current;
        element?.showModal();

        return () => {
            element?.close();

            if (previous instanceof HTMLElement && previous.isConnected) {
                previous.focus();
            }
        };
    }, []);

    return (
        <dialog
            ref={dialog}
            className={styles.dialog}
            aria-labelledby="template-heading"
            onCancel={onClose}
        >
            <header className={styles.header}>
                <h2 id="template-heading">Start with a template</h2>
                <button type="button" onClick={onClose}>
                    Close
                </button>
            </header>
            <p>
                Editable pages, reusable controls and connected journeys. Open Prototype to try
                them.
            </p>
            <p>
                Sample content only. These templates do not submit data, send email or sign you in.
            </p>
            <div className={styles.grid}>
                {STARTER_TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        className={styles.card}
                        type="button"
                        aria-label={`Use ${template.name} template`}
                        aria-describedby={`template-${template.id}-description template-${template.id}-contents`}
                        onClick={() => create(template.id)}
                    >
                        <strong>{template.name}</strong>
                        <span id={`template-${template.id}-description`}>
                            {template.description}
                        </span>
                        <small id={`template-${template.id}-contents`}>
                            {template.id === 'inspector-typography'
                                ? '1 page · Four interactive styles'
                                : '3 pages · Includes an empty state'}
                        </small>
                    </button>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
        </dialog>
    );
}
