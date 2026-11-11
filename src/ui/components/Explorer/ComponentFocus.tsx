import React, { FC, MouseEvent, ReactNode, RefObject, useEffect, useRef } from 'react';
import { AppWindow, Frame as FrameIcon } from 'lucide-react';
import { componentFocus, type ComponentUse } from 'src/app/explorerTree';
import { useActions, useAppState, useCommandEnabled } from 'src/app/hooks';
import { LeaveComponentSourceCommand } from 'src/commands/component';
import { Icon } from '../Icon';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { ExplorerItem } from './ExplorerItem';
import { Section } from './Section';
import styles from './styles.css';

/**
 * A single press on a component's row opens the view, and the second press of a
 * double-click would land on the new rows. A press this soon after, this close to the
 * one that opened it, is ignored.
 */
const DOUBLE_PRESS_MS = 500;
const DOUBLE_PRESS_DISTANCE = 4;

/** Where and when the Explorer was last pressed, in client pixels and `performance.now()`. */
export interface Press {
    x: number;
    y: number;
    time: number;
}

interface Props {
    componentId: string;
    /** The Explorer's last press. */
    lastPress: RefObject<Press | null>;
    /** The rows of the component's own layers. */
    children: ReactNode;
}

/**
 * The Explorer while a component is edited: its name with Done, its variants, its
 * layers and where it is used. Done or Escape goes back to the whole outline.
 */
export const ComponentFocus: FC<Props> = ({ componentId, lastPress, children }) => {
    const name = useAppState((state) => state.currentDocument.components[componentId]?.name);
    const focus = useAppState((state) => componentFocus(state.currentDocument, componentId));
    // The view each screen is shown in: the one editing started from, or else its first.
    const screenViews = useAppState((state) => {
        const { frames, framesIds } = state.currentDocument;
        const from = state.componentEditingReturn?.screenView?.viewId;
        const views: Record<string, string> = {};

        for (const id of from ? [from, ...framesIds] : framesIds) {
            const screenId = frames[id]?.kind === 'view' ? frames[id].screenId : undefined;

            if (screenId && !views[screenId]) {
                views[screenId] = id;
            }
        }

        return views;
    });
    const canLeave = useCommandEnabled(LeaveComponentSourceCommand);
    const opening = useRef<Press | null>(null);
    const {
        runCommand,
        editComponentSource,
        leaveComponentSource,
        selectComponentChild,
        selectShape,
        unselectShapes,
        events
    } = useActions();

    useEffect(() => {
        opening.current = lastPress.current;
    }, [lastPress]);

    if (!focus || name === undefined) {
        return null;
    }

    const showUse = (use: ComponentUse) => {
        const [first] = use.instanceIds;

        if (use.kind === 'component' && use.id && first) {
            // An instance inside another source is edited in that source.
            selectComponentChild({ componentId: use.id, shapeId: first });

            return;
        }
        leaveComponentSource();
        unselectShapes();
        events.setScreenView(
            use.kind === 'screen' && use.id ? (screenViews[use.id] ?? null) : null
        );
        use.instanceIds.forEach((id) => selectShape(id));
    };

    const ignore = (event: MouseEvent) => {
        const press = opening.current;

        if (
            press &&
            performance.now() < press.time + DOUBLE_PRESS_MS &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) <= DOUBLE_PRESS_DISTANCE
        ) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return (
        // Only ignores a double-click's second press; the rows take the keyboard as usual.

        <div
            className={styles.focus}
            onPointerDownCapture={ignore}
            onClickCapture={ignore}
            onDoubleClickCapture={ignore}
        >
            <div className={styles.focusBar}>
                <ObjectTypeSymbol type="component" />
                <span className={styles.focusName} title={name}>
                    {name}
                </span>
                <button
                    type="button"
                    className={styles.done}
                    disabled={!canLeave}
                    aria-keyshortcuts="Escape"
                    title="Back to the whole outline (Esc)"
                    onClick={() => runCommand(LeaveComponentSourceCommand)}
                >
                    Done
                </button>
            </div>
            <div className={styles.outline} data-explorer-outline>
                {focus.variants.length > 0 && (
                    <Section title="Variants">
                        {focus.variants.map((variant) => {
                            const editing = variant.id === componentId;

                            return (
                                <ExplorerItem
                                    key={variant.id}
                                    kind="component"
                                    name={variant.name}
                                    icon={<ObjectTypeSymbol type="component" />}
                                    active={editing}
                                    chips={
                                        editing ? (
                                            <span className={`${styles.chip} ${styles.current}`}>
                                                Editing
                                            </span>
                                        ) : undefined
                                    }
                                    onClick={() => {
                                        if (!editing && variant.editable) {
                                            editComponentSource(variant.id);
                                        }
                                    }}
                                />
                            );
                        })}
                    </Section>
                )}
                <Section title={`Layers in ${name}`}>{children}</Section>
                {focus.usedIn.length > 0 ? (
                    <Section title="Used in">
                        {focus.usedIn.map((use) => (
                            <ExplorerItem
                                key={use.id ?? use.kind}
                                kind={use.kind === 'component' ? 'component' : 'screen'}
                                name={use.name}
                                icon={
                                    use.kind === 'component' ? (
                                        <ObjectTypeSymbol type="component" />
                                    ) : (
                                        <Icon
                                            icon={{
                                                component:
                                                    use.kind === 'screen' ? AppWindow : FrameIcon,
                                                size: 16
                                            }}
                                        />
                                    )
                                }
                                chips={
                                    <span
                                        className={styles.count}
                                        title={`${use.instanceIds.length} ${
                                            use.instanceIds.length === 1 ? 'instance' : 'instances'
                                        }`}
                                    >
                                        {use.instanceIds.length}
                                    </span>
                                }
                                onClick={() => showUse(use)}
                            />
                        ))}
                    </Section>
                ) : (
                    <p className={styles.empty}>Not placed anywhere yet.</p>
                )}
            </div>
        </div>
    );
};
