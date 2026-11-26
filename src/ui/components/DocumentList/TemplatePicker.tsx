import { Pencil, Search, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createDocument } from 'src/app/factories';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { screenFrames } from 'src/app/screens';
import type { Document } from 'src/app/types';
import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES, type StarterTemplateId } from 'src/templates/catalog';
import { Problem } from '../Controls';
import { Dialog } from '../Dialog';
import { useStartFromTemplate } from '../FirstRun/startFromTemplate';
import {
    DocumentThumbnail,
    drawingDocument,
    drawScreen,
    ScreenThumbnail
} from './DocumentThumbnail';
import toastStyles from './styles.css';
import styles from './templates.css';

/** A document's first page, drawn as it opens, or the whole canvas when it has no pages. */
function FirstPage({ document, name }: { document: Document; name: string }) {
    const drawing = useMemo(() => {
        const first = screenFrames(document)[0];

        return first && drawScreen(document, drawingDocument(document), first.id);
    }, [document]);

    return (
        <span className={styles.picture} aria-hidden="true">
            {drawing ? (
                <ScreenThumbnail
                    document={document}
                    drawing={drawing}
                    label={`First page of ${name}`}
                />
            ) : (
                <DocumentThumbnail document={document} />
            )}
        </span>
    );
}

function StarterPicture({ templateId, name }: { templateId: StarterTemplateId; name: string }) {
    const document = useMemo(() => {
        let next = 0;

        return createDocument(buildStarterTemplate(templateId, () => `preview-${next++}`));
    }, [templateId]);

    return <FirstPage document={document} name={name} />;
}

/** A card's words, with a Use label that stands in for hover on touch screens. */
function CardText({
    name,
    description,
    tag,
    id
}: {
    name: string;
    description?: string;
    tag: string;
    id?: string;
}) {
    return (
        <span className={styles.text}>
            <strong>{name}</strong>
            {description && (
                <span className={styles.description} id={id && `${id}-description`}>
                    {description}
                </span>
            )}
            <span className={styles.footer}>
                <small id={id && `${id}-contents`}>{tag}</small>
                <span className={styles.use} aria-hidden="true">
                    Use template
                </span>
            </span>
        </span>
    );
}

const pagesLabel = (pages: number) => (pages === 1 ? '1 page' : `${pages} pages`);

const matches = (query: string, ...texts: (string | undefined)[]) =>
    texts.some((text) => text?.toLowerCase().includes(query));

interface Props {
    /** The document last moved to Recently Deleted, while it can be undone. */
    trashed: { id: string; name: string } | null;
    onTrashed: (document: { id: string; name: string }) => void;
    onUndo: () => void;
    onClose: () => void;
}

export default function TemplatePicker({ trashed, onTrashed, onUndo, onClose }: Props) {
    const { create, error } = useStartFromTemplate(onClose);
    const { newDocumentFromSavedTemplate, editDocument, trashDocument } = useActions();
    const { newId } = useEffects();
    const [query, setQuery] = useState('');
    const undoButton = useRef<HTMLButtonElement>(null);
    const saved = useAppState((state) =>
        Object.values(state.documents)
            .filter((document) => document.template && !document.deleted)
            .sort((first, second) => second.modified.getTime() - first.modified.getTime())
    );
    const search = query.trim().toLowerCase();
    const yours = saved.filter((document) => matches(search, document.name, document.description));
    const starters = STARTER_TEMPLATES.filter((template) =>
        matches(search, template.name, template.description)
    );
    const startFrom = (templateId: string) => {
        newDocumentFromSavedTemplate({ templateId, id: newId() });
        onClose();
    };
    const trash = (document: Document) => {
        trashDocument(document.id);
        onTrashed({ id: document.id, name: document.name });
    };
    const edit = (templateId: string) => {
        editDocument(templateId);
        onClose();
    };

    // The Undo button takes the focus of the Delete button that went with the template.
    const shownTrashed = useRef(trashed);
    useEffect(() => {
        if (trashed !== shownTrashed.current) {
            shownTrashed.current = trashed;
            undoButton.current?.focus();
        }
    }, [trashed]);

    return (
        <Dialog
            title="Start with a template"
            description="Editable pages, reusable controls and connected journeys. Open Prototype to try them."
            visible
            wide
            onClose={onClose}
        >
            <label className={styles.search}>
                <Search size={16} strokeWidth={1.5} aria-hidden="true" />
                <input
                    type="search"
                    aria-label="Search templates"
                    placeholder="Search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </label>
            {yours.length > 0 && (
                <section aria-label="Your templates">
                    <h3 className={styles.heading}>Yours</h3>
                    <ul className={styles.grid}>
                        {yours.map((document) => (
                            <li key={document.id} className={styles.item}>
                                <button
                                    className={styles.card}
                                    type="button"
                                    aria-label={`Use ${document.name} template`}
                                    onClick={() => startFrom(document.id)}
                                >
                                    <FirstPage document={document} name={document.name} />
                                    <CardText
                                        name={document.name}
                                        description={document.description}
                                        tag={pagesLabel(screenFrames(document).length)}
                                    />
                                </button>
                                <span className={styles.itemActions}>
                                    <button
                                        type="button"
                                        aria-label={`Edit ${document.name} template`}
                                        title="Edit template"
                                        onClick={() => edit(document.id)}
                                    >
                                        <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete ${document.name} template`}
                                        title="Delete template"
                                        onClick={() => trash(document)}
                                    >
                                        <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {starters.length > 0 && (
                <section aria-label="Starter templates">
                    {saved.length > 0 && <h3 className={styles.heading}>Starters</h3>}
                    <ul className={styles.grid}>
                        {starters.map((template) => (
                            <li key={template.id} className={styles.item}>
                                <button
                                    className={styles.card}
                                    type="button"
                                    aria-label={`Use ${template.name} template`}
                                    aria-describedby={`template-${template.id}-description template-${template.id}-contents`}
                                    onClick={() => create(template.id)}
                                >
                                    <StarterPicture templateId={template.id} name={template.name} />
                                    <CardText
                                        id={`template-${template.id}`}
                                        name={template.name}
                                        description={template.description}
                                        tag={
                                            template.id === 'inspector-typography'
                                                ? '1 page · Four interactive styles'
                                                : '3 pages · Includes an empty state'
                                        }
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {yours.length === 0 && starters.length === 0 && (
                <p className={styles.empty}>No templates match “{query.trim()}”.</p>
            )}
            {error && <Problem>{error}</Problem>}
            <div className={toastStyles.toastRegion} role="status">
                {trashed && (
                    <div className={toastStyles.toast}>
                        <span>Moved “{trashed.name}” to Recently Deleted</span>
                        <button ref={undoButton} type="button" onClick={onUndo}>
                            Undo
                        </button>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
