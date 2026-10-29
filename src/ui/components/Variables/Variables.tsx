import React, { useEffect, useId, useRef, useState } from 'react';
import { Plus, Hash, Type, ToggleLeft, Layers, ChevronLeft, Settings2 } from 'lucide-react';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import { useVariables, useVariableUses } from 'src/app/variableHooks';
import { ordered } from 'src/app/variableModes';
import { NUMBER_MODE_SUPPORT } from 'src/app/contextualLayout';
import { Icon } from '../Icon';
import { Packages } from './Packages';
import { DimensionEditor, ModePreview } from './Dimensions';
import { CreateVariable } from './CreateVariable';
import { VariableEditor } from './VariableEditor';
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

function VariablePanel() {
    const document = useCurrentDocument();
    const { setVariableDimension } = useActions();
    const variables = useVariables();
    const uses = useVariableUses();
    const dimensions = ordered(document.dimensions);
    const [view, setView] = useState<View>({ section: 'variables' });
    const [dirty, setDirty] = useState(false);
    const [pending, setPending] = useState<View>();
    const [discarded, setDiscarded] = useState(false);
    const [revision, setRevision] = useState(0);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const optionsId = useId();
    const panel = useRef<HTMLElement>(null);
    const byId = Object.fromEntries(variables.map((variable) => [variable.id, variable]));
    const items = view.section === 'variables' ? variables : dimensions;
    const selected = items.find((item) => item.id === view.id) ?? items[0];
    const variable = view.section === 'variables' && selected ? byId[selected.id] : undefined;
    const dimension =
        view.section === 'dimensions' && selected ? document.dimensions[selected.id] : undefined;
    const title = view.section === 'variables' ? 'variable' : 'dimension';

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
        <section ref={panel} className={styles.variables} aria-label="Variables">
            <div className={styles.panelToolbar}>
                <div className={styles.toolbar} role="group" aria-label="Variable editor sections">
                    {(['variables', 'dimensions'] as const).map((section) => (
                        <button
                            key={section}
                            type="button"
                            aria-pressed={view.section === section}
                            onClick={() => navigate({ section })}
                        >
                            {section === 'variables' ? 'Variables' : 'Dimensions'}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    aria-label={`New ${title}`}
                    data-variable-new
                    onClick={create}
                    disabled={document.locked}
                >
                    <Icon icon={{ component: Plus, size: 16 }} />
                    New
                </button>
                <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Panel options"
                    title="Panel options: preview and import / export"
                    aria-expanded={optionsOpen}
                    aria-controls={optionsId}
                    onClick={() => setOptionsOpen(!optionsOpen)}
                >
                    <Icon icon={{ component: Settings2, size: 16 }} />
                </button>
            </div>
            <div className={styles.commandBar}>
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
                        {items.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div id={optionsId} className={styles.options} hidden={!optionsOpen}>
                <ModePreview />
                {variables.some((item) => item.type === 'number') && dimensions.length > 0 && (
                    <p className={styles.resolution}>{NUMBER_MODE_SUPPORT}</p>
                )}
                <Packages />
            </div>
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
                <div className={styles.notice} role="alert">
                    <p>You have unfinished changes.</p>
                    <div className={styles.actions}>
                        <button type="button" onClick={() => setPending(undefined)}>
                            Keep editing
                        </button>
                        <button type="button" onClick={() => show(pending)}>
                            Discard changes
                        </button>
                    </div>
                </div>
            )}
            <div className={styles.workspace}>
                <aside
                    className={styles.sidebar}
                    aria-label={`${view.section === 'variables' ? 'Variable' : 'Dimension'} list`}
                >
                    <p className={styles.listHeading}>
                        {items.length} {items.length === 1 ? title : view.section}
                    </p>
                    <ul className={styles.itemList}>
                        {items.map((item) => {
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

export function Variables() {
    const document = useCurrentDocument();

    return <VariablePanel key={document.id} />;
}
