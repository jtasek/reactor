import { useRef, useState } from 'react';
import { useActions, useEffects } from 'src/app/hooks';
import { startFirstRunGuide } from 'src/app/firstRun';
import { buildStarterTemplate } from 'src/templates/build';
import type { StarterTemplateId } from 'src/templates/catalog';

/** Creates a document from a starter template, opens it and has the first-run guide follow it. */
export function useStartFromTemplate(onCreated?: () => void) {
    const { newDocumentFromTemplate } = useActions();
    const { newId } = useEffects();
    const [error, setError] = useState('');
    const creating = useRef(false);

    const create = (templateId: StarterTemplateId) => {
        if (creating.current) {
            return;
        }

        creating.current = true;
        setError('');

        try {
            const id = newId();

            newDocumentFromTemplate({ ...buildStarterTemplate(templateId, newId), id });
            startFirstRunGuide(id);
            onCreated?.();
        } catch {
            creating.current = false;
            setError('The template could not be created. Please try again.');
        }
    };

    return { create, error };
}
