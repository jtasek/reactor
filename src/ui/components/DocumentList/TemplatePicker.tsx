import React, { useMemo } from 'react';
import { createDocument } from 'src/app/factories';
import { screenFrames } from 'src/app/screens';
import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES, type StarterTemplateId } from 'src/templates/catalog';
import { Problem } from '../Controls';
import { Dialog } from '../Dialog';
import { useStartFromTemplate } from '../FirstRun/startFromTemplate';
import { drawingDocument, drawScreen, ScreenThumbnail } from './DocumentThumbnail';
import styles from './templates.css';

/** The template's first page, drawn as it opens. */
function TemplatePicture({ templateId, name }: { templateId: StarterTemplateId; name: string }) {
    const picture = useMemo(() => {
        let next = 0;
        const document = createDocument(
            buildStarterTemplate(templateId, () => `preview-${next++}`)
        );
        const first = screenFrames(document)[0];
        const drawing = first && drawScreen(document, drawingDocument(document), first.id);

        return drawing && { document, drawing };
    }, [templateId]);

    return (
        <span className={styles.picture} aria-hidden="true">
            {picture && (
                <ScreenThumbnail
                    document={picture.document}
                    drawing={picture.drawing}
                    label={`First page of ${name}`}
                />
            )}
        </span>
    );
}

export default function TemplatePicker({ onClose }: { onClose: () => void }) {
    const { create, error } = useStartFromTemplate(onClose);

    return (
        <Dialog
            title="Start with a template"
            description="Editable pages, reusable controls and connected journeys. Open Prototype to try them."
            visible
            wide
            onClose={onClose}
        >
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
                        <TemplatePicture templateId={template.id} name={template.name} />
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
            {error && <Problem>{error}</Problem>}
        </Dialog>
    );
}
