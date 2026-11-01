import React, { useEffect, useRef, useState } from 'react';
import { useActions, useEffects } from 'src/app/hooks';
import { STARTER_TEMPLATES, type StarterTemplateId } from 'src/templates/catalog';
import { buildStarterTemplate } from 'src/templates/build';
import styles from './templates.css';

export default function TemplatePicker({ onClose }: { onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const { newDocumentFromTemplate } = useActions();
    const { newId } = useEffects();
    const [error, setError] = useState('');
    const creating = useRef(false);

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

    const create = (id: StarterTemplateId) => {
        if (creating.current) {
            return;
        }

        creating.current = true;
        setError('');

        try {
            newDocumentFromTemplate(buildStarterTemplate(id, newId));
            onClose();
        } catch {
            creating.current = false;
            setError('The template could not be created. Please try again.');
        }
    };

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
                Editable screens, reusable controls and connected journeys. Open Prototype to try
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
                        onClick={() => create(template.id)}
                    >
                        <strong>{template.name}</strong>
                        <span>{template.description}</span>
                        <small>3 Screen views · Includes an empty state</small>
                    </button>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
        </dialog>
    );
}
