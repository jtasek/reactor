import React, { useEffect, useId, useRef, useState } from 'react';
import { Plus, Hash, Type, ToggleLeft, Layers, ChevronLeft } from 'lucide-react';
import { useActions, useCurrentDocument, useEffects } from 'src/app/hooks';
import { useVariables, useVariableUses } from 'src/app/variableHooks';
import { ordered } from 'src/app/variableModes';
import { Icon } from '../Icon';
import { Dialog } from '../Dialog';
import { Packages } from './Packages';
import { DimensionEditor } from './Dimensions';
import { ModePreview } from './ModePreview';
import { CreateVariable } from './CreateVariable';
import { VariableEditor } from './VariableEditor';
import { SaveStatusInfo } from '../StatusBar/SaveStatusInfo';
import styles from './styles.css';

/**
 * `returnId` is the variable whose "Manage modes" or "New dimension…" opened the Dimensions
 * tab; `assignTo` is set only for "New dimension…", whose new dimension that variable takes.
 */
type View = {
    section: 'variables' | 'dimensions';
    id?: string;
    creating?: boolean;
    returnId?: string;
    assignTo?: string;
};

function VariablePanel({ fullPage = false }: { fullPage?: boolean }) {
    const document = useCurrentDocument();
    const effects = useEffects();
    const { setVariableDimension } = useActions();
    const variables = useVariables();
    const uses = useVariableUses();
    const dimensions = ordered(document.dimensions);
    const [view, setView] = useState<View>({ section: 'variables' });
    const [dirty, setDirty] = useState(false);
    const [pending, setPending] = useState<View | 'canvas'>();
    const [query, setQuery] = useState('');
    const [discarded, setDiscarded] = useState(false);
    const [revision, setRevision] = useState(0);
    const [packageMode, setPackageMode] = useState<'import' | 'export'>();
    const [tabFocus, setTabFocus] = useState<View['section']>('variables');
    const tabsId = useId();
    const tabs = useRef<HTMLDivElement>(null);
    const releaseNavigationGuard = useRef<(() => void) | undefined>(undefined);

    useEffect(() => setTabFocus(view.section), [view.section]);
    const panel = useRef<HTMLElement>(null);
    const byId = Object.fromEntries(variables.map((variable) => [variable.id, variable]));
    const items = view.section === 'variables' ? variables : dimensions;
    const matches = items.filter((item) =>
        item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    );
    const selected = items.find((item) => item.id === view.id) ?? items[0];
    const variable = view.section === 'variables' && selected ? byId[selected.id] : undefined;
    const dimension =
        view.section === 'dimensions' && selected ? document.dimensions[selected.id] : undefined;
    const title = view.section === 'variables' ? 'variable' : 'dimension';

    useEffect(() => {
        if (!fullPage || !dirty) {
            return;
        }
        const protectDraft = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', protectDraft);
        const release = effects.guardNavigation(() =>
            window.confirm('Discard unfinished variable or dimension changes?')
        );
        releaseNavigationGuard.current = release;

        return () => {
            window.removeEventListener('beforeunload', protectDraft);
            release();
        };
    }, [fullPage, dirty, effects]);

    const canUndo = !document.locked && !dirty && document.history.canUndo;
    const canRedo = !document.locked && !dirty && document.history.canRedo;
    useEffect(() => {
        if (!fullPage) {
            return;
        }
        // Canvas shortcuts are off on this page; the history keys work outside text fields.
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                !(event.metaKey || event.ctrlKey) ||
                event.altKey ||
                target?.closest('input, textarea, select, [contenteditable="true"]')
            ) {
                return;
            }
            const key = event.key.toLowerCase();
            const redo = key === 'y' || (key === 'z' && event.shiftKey);
            if (key !== 'z' && key !== 'y') {
                return;
            }
            event.preventDefault();
            if (redo && canRedo) {
                effects.collaboration.redo(document.id);
            } else if (!redo && canUndo) {
                effects.collaboration.undo(document.id);
            }
        };
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [fullPage, canUndo, canRedo, effects, document.id]);

    useEffect(() => {
        if (view.creating) {
            return;
        }
        // The item being edited was deleted elsewhere, so its draft is gone.
        if (view.id !== undefined && !items.some((item) => item.id === view.id) && dirty) {
            setDirty(false);
            setPending(undefined);
            setDiscarded(true);
        }
        if (!selected) {
            if (view.id !== undefined) {
                setView({ section: view.section, returnId: view.returnId });
            }

            return;
        }
        if (view.id !== selected.id) {
            setView({ ...view, id: selected.id });
        }
    }, [view, selected, items, dirty]);

    const show = (next: View) => {
        if (next.section !== view.section || view.creating) {
            setQuery('');
        }
        setDirty(false);
        setPending(undefined);
        setDiscarded(false);
        setView(next);
        setRevision((value) => value + 1);
    };
    const navigate = (next: View) => {
        if (dirty) {
            setPending(next);

            return;
        }
        show(next);
    };
    const create = () =>
        navigate({ section: view.section, creating: true, returnId: view.returnId });
    const returnToCanvas = () => {
        releaseNavigationGuard.current?.();
        effects.navigate('/');
    };
    const backToCanvas = () => {
        if (dirty) {
            setPending('canvas');

            return;
        }
        effects.navigate('/');
    };
    const editDimension = (id?: string) => {
        navigate({
            section: 'dimensions',
            id,
            creating: !id,
            returnId: variable?.id,
            assignTo: id ? undefined : variable?.id
        });
    };
    const cancel = () => {
        if (view.creating && view.assignTo && byId[view.assignTo]) {
            show({ section: 'variables', id: view.assignTo });

            return;
        }
        show({ section: view.section, returnId: view.returnId });
    };
    const dimensionSaved = (id: string) => {
        const owner = byId[view.assignTo ?? ''];
        if (
            view.creating &&
            owner &&
            owner.type !== 'boolean' &&
            owner.alias === undefined &&
            !owner.dimensionId
        ) {
            setVariableDimension({ variableId: owner.id, dimensionId: id });
            show({ section: 'variables', id: owner.id });

            return;
        }
        show({ section: 'dimensions', id, returnId: view.returnId });
    };
    const returnId = view.section === 'dimensions' ? view.returnId : undefined;
    // A deletion removes the focused control, so keep the keyboard in the panel.
    const keepFocus = () =>
        requestAnimationFrame(() => {
            const focused = globalThis.document.activeElement;
            if (!panel.current || (focused && focused !== globalThis.document.body)) {
                return;
            }
            const candidates = [
                panel.current.querySelector<HTMLElement>('[data-variable-picker]'),
                panel.current.querySelector<HTMLElement>('aside button[aria-pressed="true"]'),
                panel.current.querySelector<HTMLElement>('[data-variable-new]')
            ];
            candidates
                .find((element) => element?.checkVisibility() && !element.matches(':disabled'))
                ?.focus();
        });

    return (
        <section
            ref={panel}
            className={`${styles.variables} ${styles.workspacePanel} ${fullPage ? styles.pageWorkspace : ''}`}
            aria-label="Variables"
        >
            {fullPage && (
                <header className={styles.pageHeader}>
                    <button type="button" onClick={backToCanvas}>
                        <Icon icon={{ component: ChevronLeft, size: 16 }} />
                        Back to canvas
                    </button>
                    <div className={styles.pageTitle}>
                        <h1>Variables</h1>
                        <span>{document.name}</span>
                    </div>
                    <span role="status">
                        <SaveStatusInfo />
                    </span>
                    <div className={styles.utilities} aria-label="Document history">
                        <button
                            type="button"
                            disabled={!canUndo}
                            onClick={() => effects.collaboration.undo(document.id)}
                        >
                            Undo
                        </button>
                        <button
                            type="button"
                            disabled={!canRedo}
                            onClick={() => effects.collaboration.redo(document.id)}
                        >
                            Redo
                        </button>
                    </div>
                </header>
            )}
            <div className={styles.panelToolbar}>
                <div
                    ref={tabs}
                    className={styles.toolbar}
                    role="tablist"
                    aria-label="Variable editor sections"
                >
                    {(['variables', 'dimensions'] as const).map((section) => (
                        <button
                            key={section}
                            type="button"
                            role="tab"
                            id={`${tabsId}-${section}`}
                            aria-selected={view.section === section}
                            aria-controls={`${tabsId}-workspace`}
                            tabIndex={tabFocus === section ? 0 : -1}
                            onKeyDown={(event) => {
                                const buttons = Array.from(
                                    tabs.current?.querySelectorAll<HTMLButtonElement>(
                                        '[role="tab"]'
                                    ) ?? []
                                );
                                const current = buttons.indexOf(event.target as HTMLButtonElement);
                                const destinations: Record<string, number> = {
                                    ArrowRight: (current + 1) % 2,
                                    ArrowLeft: (current + 1) % 2,
                                    Home: 0,
                                    End: 1
                                };
                                const next = destinations[event.key];
                                if (next === undefined) {
                                    return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                buttons[next]?.focus();
                            }}
                            onFocus={() => setTabFocus(section)}
                            onClick={() => navigate({ section })}
                        >
                            {section === 'variables' ? 'Variables' : 'Dimensions'}
                        </button>
                    ))}
                </div>
            </div>
            <div className={styles.commandBar}>
                <button type="button" data-variable-new onClick={create} disabled={document.locked}>
                    <Icon icon={{ component: Plus, size: 16 }} />
                    New {title}
                </button>
                <div className={styles.utilities}>
                    {!fullPage && <ModePreview />}
                    <button
                        type="button"
                        onClick={() => setPackageMode('import')}
                        disabled={document.locked}
                    >
                        Import
                    </button>
                    <button type="button" onClick={() => setPackageMode('export')}>
                        Export
                    </button>
                </div>
            </div>
            {fullPage && (
                <div className={styles.searchBar}>
                    <label className={styles.formField}>
                        Search {view.section}
                        <input
                            type="search"
                            value={query}
                            placeholder={
                                view.section === 'variables'
                                    ? 'Name or path, e.g. color/'
                                    : 'Dimension name'
                            }
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    <span role="status" className={styles.resolution}>
                        {query.trim() ? `${matches.length} of ${items.length}` : items.length}{' '}
                        {items.length === 1 ? title : view.section}
                    </span>
                </div>
            )}
            <div className={styles.compactPicker}>
                <select
                    data-variable-picker
                    aria-label={`Selected ${title}`}
                    value={view.creating ? '' : (selected?.id ?? '')}
                    onChange={(event) =>
                        navigate({
                            section: view.section,
                            id: event.target.value,
                            returnId: view.returnId
                        })
                    }
                >
                    {(view.creating || !selected) && (
                        <option value="">
                            {view.creating ? `New ${title}` : `No ${view.section} yet`}
                        </option>
                    )}
                    {selected && !matches.some((item) => item.id === selected.id) && (
                        <option value={selected.id}>{selected.name} (current)</option>
                    )}
                    {matches.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </select>
            </div>
            {packageMode && (
                <Packages mode={packageMode} onClose={() => setPackageMode(undefined)} />
            )}
            {discarded && (
                <div className={styles.notice} role="status">
                    <p>
                        The {title} you were editing was deleted elsewhere, so your unsaved changes
                        were discarded.
                    </p>
                    <div className={styles.actions}>
                        <button type="button" onClick={() => setDiscarded(false)}>
                            OK
                        </button>
                    </div>
                </div>
            )}
            {pending && (
                <Dialog
                    visible
                    title="Discard unfinished changes?"
                    description="You have unfinished changes. Keep editing or discard them to continue."
                    onClose={() => setPending(undefined)}
                    actions={
                        <>
                            <button type="button" onClick={() => setPending(undefined)}>
                                Keep editing
                            </button>
                            <button
                                type="button"
                                data-variant="destructive"
                                onClick={() =>
                                    pending === 'canvas' ? returnToCanvas() : show(pending)
                                }
                            >
                                Discard changes
                            </button>
                        </>
                    }
                />
            )}
            <div
                className={styles.workspace}
                role="tabpanel"
                id={`${tabsId}-workspace`}
                aria-labelledby={`${tabsId}-${view.section}`}
            >
                <aside
                    className={styles.sidebar}
                    aria-label={`${view.section === 'variables' ? 'Variable' : 'Dimension'} list`}
                >
                    <p className={styles.listHeading}>
                        {items.length} {items.length === 1 ? title : view.section}
                    </p>
                    <ul className={styles.itemList}>
                        {matches.map((item) => {
                            const entry = byId[item.id];
                            const split = item.name.lastIndexOf('/');
                            const color =
                                view.section === 'variables' && entry?.type === 'color'
                                    ? entry.values.default
                                    : undefined;
                            const symbol =
                                view.section === 'dimensions'
                                    ? Layers
                                    : entry?.type === 'number'
                                      ? Hash
                                      : entry?.type === 'boolean'
                                        ? ToggleLeft
                                        : Type;

                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={styles.item}
                                        aria-label={`Edit ${title} ${item.name}`}
                                        aria-pressed={!view.creating && selected?.id === item.id}
                                        onClick={() =>
                                            navigate({
                                                section: view.section,
                                                id: item.id,
                                                returnId: view.returnId
                                            })
                                        }
                                    >
                                        {color ? (
                                            <span
                                                className={styles.swatch}
                                                style={{ backgroundColor: color }}
                                            />
                                        ) : (
                                            <Icon icon={{ component: symbol, size: 16 }} />
                                        )}
                                        <span>
                                            {item.name.slice(split + 1)}
                                            <small>
                                                {view.section === 'dimensions'
                                                    ? ordered(document.dimensions[item.id].modes)
                                                          .map((mode) => mode.name)
                                                          .join(' · ')
                                                    : split < 0
                                                      ? entry.type
                                                      : item.name.slice(0, split)}
                                            </small>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {items.length > 0 && matches.length === 0 && (
                        <p className={styles.resolution}>No matching {view.section}.</p>
                    )}
                </aside>
                <div className={styles.detail}>
                    {view.section === 'dimensions' && returnId && byId[returnId] && (
                        <button
                            type="button"
                            className={styles.back}
                            onClick={() => navigate({ section: 'variables', id: returnId })}
                        >
                            <Icon icon={{ component: ChevronLeft, size: 16 }} />
                            Back to {byId[returnId].name}
                        </button>
                    )}
                    {view.creating && view.section === 'variables' && (
                        <CreateVariable
                            key={`create-${revision}`}
                            onDirty={setDirty}
                            onCancel={cancel}
                            onCreated={(id) => show({ section: 'variables', id })}
                        />
                    )}
                    {view.section === 'dimensions' && (dimension || view.creating) && (
                        <DimensionEditor
                            key={`${view.creating ? 'new' : dimension?.id}-${revision}`}
                            dimension={view.creating ? undefined : dimension}
                            onDirty={setDirty}
                            onCancel={cancel}
                            onSaved={dimensionSaved}
                            onDeleted={keepFocus}
                        />
                    )}
                    {!view.creating && variable && (
                        <VariableEditor
                            key={variable.id}
                            variable={variable}
                            variables={byId}
                            uses={uses[variable.id] ?? 0}
                            onManageDimension={editDimension}
                            onDeleted={keepFocus}
                        />
                    )}
                    {!view.creating && !selected && (
                        <div className={styles.empty}>
                            <h3>No {view.section} yet</h3>
                            <p>
                                {view.section === 'variables'
                                    ? 'Create a named value to reuse across your designs. Modes are optional.'
                                    : 'Add a dimension when you need different values for Theme, Brand or Density.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export function Variables({ fullPage = false }: { fullPage?: boolean }) {
    const document = useCurrentDocument();

    return <VariablePanel key={document.id} fullPage={fullPage} />;
}
