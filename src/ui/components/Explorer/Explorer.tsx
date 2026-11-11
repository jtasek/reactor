import { isScreenLayout, viewLayoutRoot } from 'src/app/screenLayouts';
import { screenOwners } from 'src/app/screenViews';
import React, {
    FC,
    MouseEvent,
    Ref,
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { AppWindow, Frame as FrameIcon, ListFilter, Lock, X } from 'lucide-react';
import styles from './styles.css';
import { OpenItems, Dragged, ExplorerItem, acceptsDragged, readDragged } from './ExplorerItem';
import { ExplorerMenu, type ExplorerMenuItem } from './ExplorerMenu';
import { LayerManager } from './LayerManager';
import { SearchBoxContainer } from '../SearchBox';
import { hideAction, lockAction, useItemCommandActions, type ItemMenuAction } from '../ItemMenu';
import { Icon } from '../Icon';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { SourceItem } from './SourceItem';
import { Section } from './Section';
import { ComponentFocus, type Press } from './ComponentFocus';
import { byDrawingOrder } from 'src/app/drawOrder';
import {
    explorerKeep,
    explorerKey,
    explorerRevealKeys,
    type ExplorerStatusFilter
} from 'src/app/explorerTree';
import { isShapeLocked } from 'src/app/utils';
import { NewLayerCommand } from 'src/commands';
import {
    useExplorerTree,
    useFrameRows,
    useSelectedFrameId,
    useShapesFrameState
} from 'src/app/frameHooks';
import {
    useActions,
    useAppState,
    useCommandEnabled,
    useComponents,
    useControls,
    useCurrentDocument,
    useDocumentFilter,
    useGroup,
    useGroupSelected,
    useShape,
    useShapeLocked,
    useShapesIds,
    useScopedCommands,
    useShownLayerId
} from 'src/app/hooks';
import { useSourceSelected, useEditingComponentForShape } from 'src/app/componentHooks';

/** "Move to layer" choices for a row's context menu, while the document has layers. */
const useMoveToLayerItems = (shapeIds: string[], disabled: boolean): ExplorerMenuItem[] => {
    const layers = useAppState((state) =>
        state.currentDocument.layersIds.map((id) => ({
            id,
            name: state.currentDocument.layers[id]?.name ?? id
        }))
    );
    const { moveShapesToLayer } = useActions();

    if (layers.length === 0) {
        return [];
    }

    return [
        { heading: 'Move to layer' },
        ...layers.map((layer) => ({
            id: `layer:${layer.id}`,
            label: layer.name,
            disabled,
            onRun: () => moveShapesToLayer({ shapeIds, layerId: layer.id })
        })),
        {
            id: 'layer:none',
            label: 'No layer',
            disabled,
            onRun: () => moveShapesToLayer({ shapeIds, layerId: null })
        }
    ];
};

/** A shape's row; memoized so a list rendering again does not render every row. */
const ShapeItem = memo<{
    shapeId: string;
    sourceId?: string;
    viewId?: string;
    rowRef?: Ref<HTMLLIElement>;
    position?: number;
    setSize?: number;
}>(function ShapeItem({ shapeId, sourceId, viewId, rowRef, position, setSize }) {
    const shape = useShape(shapeId);
    const inherited = useShapesFrameState([shapeId]);
    const sourceSelected = useSourceSelected(sourceId ?? null);
    const focusedId = useEditingComponentForShape(shapeId);
    const documentLocked = useAppState((state) => state.currentDocument.locked);
    const {
        selectShape,
        unselectShapes,
        toggleShapeSelected,
        toggleShapeLocked,
        toggleShapeVisible,
        selectComponentChild,
        setShapesProperty,
        editComponentSource,
        events
    } = useActions();
    const locked = useShapeLocked(shapeId);
    const commands = useItemCommandActions([shapeId], locked || !shape.visible || inherited.hidden);
    const layerItems = useMoveToLayerItems([shapeId], locked);
    // Double-clicking an instance edits its component; the variant it shows, if it has one.
    const editedId = useAppState((state) => {
        const instance = state.currentDocument.shapes[shapeId];

        if (instance?.type !== 'instance') {
            return null;
        }
        const { components } = state.currentDocument;
        const id =
            instance.variantId && components[instance.variantId]
                ? instance.variantId
                : instance.componentId;

        return components[id] && !components[id].library ? id : null;
    });

    const handleSelect = ({ shiftKey }: MouseEvent<HTMLButtonElement>) => {
        // A child of the component being edited keeps the view it is being edited in.
        if (viewId || !focusedId) {
            events.setScreenView(viewId ?? null);
        }

        if (shiftKey) {
            toggleShapeSelected(shapeId);

            return;
        }
        const componentId = sourceId ?? focusedId;

        if (componentId) {
            selectComponentChild({ componentId, shapeId });

            return;
        }
        unselectShapes();
        selectShape(shapeId);
    };

    return (
        <ExplorerItem
            kind={shape.type === 'instance' ? 'instance' : 'shape'}
            name={shape.name}
            icon={<ObjectTypeSymbol type={shape.type} />}
            dragged={sourceId ? undefined : { kind: 'shape', id: shapeId }}
            selected={shape.selected && !sourceSelected}
            active={shape.active}
            visible={shape.visible && !inherited.hidden}
            onClick={handleSelect}
            onDoubleClick={editedId ? () => editComponentSource(editedId) : undefined}
            onRename={
                documentLocked || inherited.locked
                    ? undefined
                    : (name) => setShapesProperty({ shapeIds: [shapeId], key: 'name', value: name })
            }
            rowRef={rowRef}
            place={position && setSize ? [position, setSize] : undefined}
            menuActions={[
                {
                    ...hideAction(!shape.visible, () => toggleShapeVisible(shapeId)),
                    disabled: inherited.locked
                },
                {
                    ...lockAction(shape.locked, () => toggleShapeLocked(shapeId)),
                    disabled: inherited.locked
                },
                ...commands(useScopedCommands('shape'))
            ]}
            menuItems={sourceId ? undefined : layerItems}
        />
    );
});

/** A list this long draws only the rows in or near view; shorter lists draw every row. */
const LAZY_ROWS_FROM = 100;
/** How far outside the Explorer a row is already drawn, so scrolling shows no gaps. */
const LAZY_ROW_MARGIN = '600px 0px';

type RowWatcher = { observer: IntersectionObserver; rows: Map<Element, (near: boolean) => void> };
const rowWatchers = new WeakMap<Element, RowWatcher>();

/** Tells `report` as `row` comes near the view of the Explorer it is in, or leaves it. */
function watchRow(row: Element, report: (near: boolean) => void) {
    const page = row.ownerDocument.documentElement;
    let root: Element = page;

    // The panel that scrolls the list, which is not always the Explorer itself.
    for (let parent = row.parentElement; parent && parent !== page; parent = parent.parentElement) {
        const { overflowY } = getComputedStyle(parent);

        if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            parent.scrollHeight > parent.clientHeight
        ) {
            root = parent;
            break;
        }
    }

    let watcher = rowWatchers.get(root);

    if (!watcher) {
        const rows: RowWatcher['rows'] = new Map();

        watcher = {
            rows,
            observer: new IntersectionObserver(
                (entries) =>
                    entries.forEach((entry) => rows.get(entry.target)?.(entry.isIntersecting)),
                { root: root === page ? null : root, rootMargin: LAZY_ROW_MARGIN }
            )
        };
        rowWatchers.set(root, watcher);
    }

    watcher.rows.set(row, report);
    watcher.observer.observe(row);

    return () => {
        watcher.rows.delete(row);
        watcher.observer.unobserve(row);
    };
}

/**
 * A shape's row in a long list: an empty row of the same height until it comes
 * near the view. A row out of view then reads nothing from the store, so a
 * document of thousands of shapes costs the Explorer only the rows it shows.
 * A drawn row says where it is in the whole list, for a reader that counts rows.
 */
const LazyShapeItem = memo<{
    shapeId: string;
    viewId?: string;
    position: number;
    setSize: number;
}>(function LazyShapeItem(props) {
    const [near, setNear] = useState(false);
    const stop = useRef<() => void>(undefined);
    const rowRef = useCallback((row: HTMLLIElement | null) => {
        stop.current?.();
        stop.current = row
            ? watchRow(row, (isNear) =>
                  // The row holding the keyboard focus stays, so focus is not lost on scroll.
                  setNear(isNear || row.contains(row.ownerDocument.activeElement))
              )
            : undefined;
    }, []);

    return near ? (
        <ShapeItem {...props} rowRef={rowRef} />
    ) : (
        <li ref={rowRef} aria-hidden="true">
            <div className={styles.row} />
        </li>
    );
});

const GroupItem: FC<{
    groupId: string;
    shapesIds: string[];
    viewId?: string;
}> = ({ groupId, shapesIds, viewId }) => {
    const group = useGroup(groupId);
    const inherited = useShapesFrameState(group.shapesIds);
    const selected = useGroupSelected(groupId);
    const documentLocked = useAppState((state) => state.currentDocument.locked);
    const {
        addShapesToGroup,
        unselectShapes,
        toggleGroupSelected,
        toggleGroupLocked,
        toggleGroupVisible,
        updateGroup,
        events
    } = useActions();
    const commands = useItemCommandActions(
        group.shapesIds,
        group.locked || inherited.locked || inherited.hidden
    );
    const layerItems = useMoveToLayerItems(group.shapesIds, group.locked || inherited.locked);

    const handleSelect = ({ shiftKey }: MouseEvent<HTMLButtonElement>) => {
        events.setScreenView(viewId ?? null);

        if (!shiftKey) {
            unselectShapes();
        }
        toggleGroupSelected(groupId);
    };

    return (
        <ExplorerItem
            kind="group"
            name={group.name}
            icon={<ObjectTypeSymbol type="group" />}
            dragged={{ kind: 'group', id: groupId }}
            collapseId={explorerKey('group', groupId)}
            selected={selected}
            visible={group.visible && !inherited.hidden}
            onClick={handleSelect}
            onRename={
                group.locked || inherited.locked || documentLocked
                    ? undefined
                    : (name) => updateGroup({ id: groupId, name })
            }
            menuActions={[
                {
                    ...hideAction(!group.visible, () => toggleGroupVisible(groupId)),
                    disabled: inherited.locked
                },
                {
                    ...lockAction(group.locked, () => toggleGroupLocked(groupId)),
                    disabled: inherited.locked
                },
                ...commands(useScopedCommands('group'))
            ]}
            menuItems={layerItems}
            onDrop={({ kind, id }) => {
                // Only shapes join a group; a group dropped on a group stays as it is.
                if (kind === 'shape') {
                    addShapesToGroup({ shapeIds: [id], groupId });
                }
            }}
        >
            {shapesIds.map((shapeId) => (
                <ShapeItem key={shapeId} shapeId={shapeId} viewId={viewId} />
            ))}
        </ExplorerItem>
    );
};

interface Contents {
    groups: { groupId: string; shapesIds: string[] }[];
    shapesIds: string[];
}

const ObjectContents: FC<Contents & { viewId?: string }> = ({ groups, shapesIds, viewId }) => {
    const drawOrder = new Map(useShapesIds().map((id, index) => [id, index]));
    const items = [
        ...groups.map((group) => ({
            kind: 'group' as const,
            id: group.groupId,
            shapesIds: [...group.shapesIds].sort(
                (a, b) => (drawOrder.get(b) ?? -1) - (drawOrder.get(a) ?? -1)
            ),
            rank: Math.max(...group.shapesIds.map((id) => drawOrder.get(id) ?? -1))
        })),
        ...shapesIds.map((id) => ({
            kind: 'shape' as const,
            id,
            rank: drawOrder.get(id) ?? -1
        }))
    ].sort((a, b) => b.rank - a.rank);
    const lazy = items.length >= LAZY_ROWS_FROM && typeof IntersectionObserver !== 'undefined';

    return (
        <>
            {items.map((item, index) =>
                item.kind === 'group' ? (
                    <GroupItem
                        key={item.id}
                        groupId={item.id}
                        shapesIds={item.shapesIds}
                        viewId={viewId}
                    />
                ) : lazy ? (
                    <LazyShapeItem
                        key={item.id}
                        shapeId={item.id}
                        viewId={viewId}
                        position={index + 1}
                        setSize={items.length}
                    />
                ) : (
                    <ShapeItem key={item.id} shapeId={item.id} viewId={viewId} />
                )
            )}
        </>
    );
};

const noContents: Contents = { groups: [], shapesIds: [] };
const hasContents = (contents: Contents | undefined) =>
    contents !== undefined && contents.groups.length + contents.shapesIds.length > 0;

const OPEN_KEY = 'reactor:explorer-open:';

/** Which rows someone opened or closed, kept per document on this device. */
function useOpenRows(documentId: string) {
    const read = (id: string): Record<string, boolean> => {
        try {
            const value = JSON.parse(localStorage.getItem(OPEN_KEY + id) ?? '{}');

            return value && typeof value === 'object' ? value : {};
        } catch {
            return {};
        }
    };
    const [rows, setRows] = useState(() => ({ documentId, open: read(documentId) }));
    const current = rows.documentId === documentId ? rows.open : read(documentId);

    if (rows.documentId !== documentId) {
        setRows({ documentId, open: current });
    }

    return useMemo(
        () => ({
            isOpen: (key: string, fallback: boolean) => current[key] ?? fallback,
            setOpen: (entries: Record<string, boolean>) => {
                const changed = Object.entries(entries).some(
                    ([key, open]) => current[key] !== open
                );

                if (!changed) {
                    return;
                }
                const open = { ...current, ...entries };

                setRows({ documentId, open });
                try {
                    localStorage.setItem(OPEN_KEY + documentId, JSON.stringify(open));
                } catch {
                    // The rows still open and close; they just start as they were next time.
                }
            }
        }),
        [current, documentId]
    );
}

export const Explorer: FC = () => {
    const [status, setStatus] = useState<ExplorerStatusFilter>('all');
    const [filterMenu, setFilterMenu] = useState<{ x: number; y: number } | null>(null);
    const [managingLayers, setManagingLayers] = useState(false);
    const [chosenViews, setChosenViews] = useState<Record<string, string>>({});
    const outline = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLElement>(null);
    const frames = useFrameRows();
    const selectedFrameId = useSelectedFrameId();
    const actions = useActions();
    const { editFrame, events, selectExplorerLayer, showOnlyLayer, showAllLayers, runCommand } =
        actions;
    const tree = useExplorerTree(status);
    const document = useCurrentDocument();
    const components = useComponents() ?? {};
    const filter = useDocumentFilter().trim().toLowerCase();
    const shownLayerId = useShownLayerId();
    const canAddLayer = useCommandEnabled(NewLayerCommand);
    const editedViewId = useAppState((state) => state.events.pointer.screenView?.viewId);
    const revealKeys = useAppState((state) => explorerRevealKeys(state.currentDocument).join(' '));
    const selection = useAppState(({ currentDocument }) =>
        [
            currentDocument.selectedFrameId ?? '',
            ...currentDocument.selectedGroupsIds,
            ...currentDocument.selectedShapesIds
        ].join(' ')
    );
    const filterButton = useRef<HTMLButtonElement>(null);
    const openRows = useOpenRows(document.id);
    const { explorer } = useControls();
    const drawOrder = new Map(useShapesIds().map((id, index) => [id, index]));
    const focusedId = useAppState((state) =>
        state.enteredComponentId && state.currentDocument.components[state.enteredComponentId]
            ? state.enteredComponentId
            : null
    );
    const outlineScroll = useRef(0);
    const lastPress = useRef<Press | null>(null);
    const wasFocused = useRef(focusedId);

    // The whole outline's scroll, kept while a component is edited and put back after.
    useEffect(() => {
        if (focusedId) {
            return;
        }
        const keep = () => {
            outlineScroll.current = scrollParent(panel.current)?.scrollTop ?? 0;
        };

        keep();
        window.document.addEventListener('scroll', keep, { capture: true, passive: true });

        return () => window.document.removeEventListener('scroll', keep, { capture: true });
    }, [focusedId]);

    useLayoutEffect(() => {
        const scroller = scrollParent(panel.current);

        if (wasFocused.current && !focusedId && scroller) {
            scroller.scrollTop = outlineScroll.current;
        }
        wasFocused.current = focusedId;
    }, [focusedId]);

    useEffect(() => {
        // The whole outline opens nothing for selections made while a component is edited.
        if (revealKeys && !focusedId) {
            openRows.setOpen(Object.fromEntries(revealKeys.split(' ').map((key) => [key, true])));
        }
        // Each new selection reveals its rows; closing one afterwards keeps it closed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealKeys, selection, focusedId]);

    // A component someone just made opens, so its parts show where they went.
    const componentIds = Object.keys(components).join(' ');
    const knownComponents = useRef({ documentId: document.id, ids: componentIds });

    useEffect(() => {
        const known = knownComponents.current;
        const added =
            known.documentId === document.id
                ? componentIds.split(' ').filter((id) => id && !known.ids.split(' ').includes(id))
                : [];

        knownComponents.current = { documentId: document.id, ids: componentIds };
        if (added.length > 0) {
            openRows.setOpen(
                Object.fromEntries(added.map((id) => [explorerKey('component', id), true]))
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [componentIds, document.id]);

    useEffect(() => {
        const frame = requestAnimationFrame(() =>
            outline.current
                ?.querySelector('[aria-selected="true"]')
                ?.scrollIntoView?.({ block: 'nearest' })
        );

        return () => cancelAnimationFrame(frame);
    }, [revealKeys, selection]);

    // One tab stop for the outline: the row with the focus, or else the selected or first one.
    useLayoutEffect(() => {
        const rows = [
            ...(outline.current?.querySelectorAll<HTMLElement>('[data-explorer-row]') ?? [])
        ];
        const focused = rows.find((row) => row === window.document.activeElement);
        const target =
            focused ?? rows.find((row) => row.getAttribute('aria-pressed') === 'true') ?? rows[0];

        rows.forEach((row) => (row.tabIndex = row === target ? 0 : -1));
    });

    if (!explorer.visible) {
        return null;
    }

    if (focusedId) {
        const component = components[focusedId];
        const members = component.shapesIds
            .filter((id) => document.shapes[id])
            .sort((a, b) => (drawOrder.get(b) ?? -1) - (drawOrder.get(a) ?? -1));

        return (
            <OpenItems.Provider value={openRows}>
                <section ref={panel} className={styles.explorer} aria-label="Explorer">
                    <ComponentFocus componentId={focusedId} lastPress={lastPress}>
                        {members.map((shapeId) => (
                            <ShapeItem key={shapeId} shapeId={shapeId} sourceId={focusedId} />
                        ))}
                    </ComponentFocus>
                </section>
            </OpenItems.Provider>
        );
    }

    const keep = explorerKeep(document, shownLayerId, status);
    const narrowed = filter !== '' || Boolean(keep.shape || keep.frame);
    const frameContents = new Map(tree.frames.map((frame) => [frame.id, frame]));
    const shownFrames = frames.flatMap((frame) => {
        const contents = frameContents.get(frame.id);

        return contents ? [{ ...frame, ...contents }] : [];
    });
    const owners = screenOwners(document.frames);
    const views = frames.filter(
        (frame) => frame.kind === 'view' && frame.screenId && document.frames[frame.screenId]
    );
    const screens = frames.filter((frame) => owners.get(frame.id) === frame.id);
    const shapesOf = ({ kind, id }: Dragged) =>
        kind === 'shape' ? [id] : (document.groups[id]?.shapesIds ?? []);
    // Same as the Parent picker: a group moves whole, positions stay where they are.
    const moveIntoFrame = (dragged: Dragged, parentFrameId: string | null) => {
        const ids = shapesOf(dragged).filter(
            (id) =>
                !isShapeLocked(document, id) &&
                (document.shapes[id]?.parentFrameId ?? null) !== parentFrameId
        );

        if (ids.length > 0) {
            editFrame({ kind: 'reparentShapes', ids, parentFrameId });
        }
    };
    const frameActions = (frame: (typeof frames)[number]) => [
        {
            ...hideAction(!frame.visible, () =>
                editFrame({ kind: 'toggle', id: frame.id, flag: 'visible' })
            ),
            disabled: frame.inheritedLock
        },
        {
            ...lockAction(frame.locked, () =>
                editFrame({ kind: 'toggle', id: frame.id, flag: 'locked' })
            ),
            disabled: frame.inheritedLock
        }
    ];
    const renameFrame = (frame: (typeof frames)[number]) =>
        document.locked || frame.locked || frame.inheritedLock
            ? undefined
            : (name: string) => editFrame({ kind: 'update', id: frame.id, changes: { name } });
    /** Frames drawn inside `rootId`, apart from root screens and other screen layouts. */
    const childFrames = (rootId: string) =>
        shownFrames.filter(
            (child) =>
                owners.get(child.id) !== child.id &&
                child.parentFrameId === rootId &&
                !isScreenLayout(document.frames, child.id)
        );
    const frameItem = (frame: (typeof shownFrames)[number], viewId?: string): React.ReactNode => {
        // A view whose screen is gone shows as a frame, with the artwork it holds.
        const rootId =
            frame.kind === 'view'
                ? (viewLayoutRoot(document, document.frames[frame.id])?.id ?? frame.id)
                : frame.id;

        const nested = childFrames(rootId);
        const contents = frameContents.get(rootId)?.contents ?? noContents;

        return (
            <ExplorerItem
                key={`frame:${frame.id}`}
                kind="frame"
                name={frame.name}
                icon={
                    <Icon
                        icon={{
                            component:
                                frame.kind === 'frame' || !frame.kind ? FrameIcon : AppWindow,
                            size: 16
                        }}
                    />
                }
                selected={selectedFrameId === frame.id}
                visible={frame.shown}
                collapseId={
                    nested.length > 0 || hasContents(contents)
                        ? explorerKey('frame', frame.id)
                        : undefined
                }
                onClick={() => editFrame({ kind: 'select', id: frame.id })}
                onRename={renameFrame(frame)}
                onDrop={
                    frame.locked || frame.inheritedLock
                        ? undefined
                        : (dragged) => moveIntoFrame(dragged, rootId)
                }
                menuActions={frameActions(frame)}
            >
                {nested.map((child) => frameItem(child, viewId))}
                <ObjectContents {...contents} viewId={viewId} />
            </ExplorerItem>
        );
    };

    const screenItem = (screen: (typeof frames)[number]) => {
        const screenViews = views.filter((view) => view.screenId === screen.id);
        const shownView =
            screenViews.find((view) => view.id === editedViewId) ??
            screenViews.find((view) => view.id === chosenViews[screen.id]) ??
            screenViews[0];
        const rootId = shownView
            ? (viewLayoutRoot(document, document.frames[shownView.id])?.id ?? screen.id)
            : screen.id;
        const contents = frameContents.get(rootId)?.contents;
        const nested = childFrames(rootId);
        const named = filter !== '' && screen.name.toLowerCase().includes(filter);

        if (
            narrowed &&
            !named &&
            !hasContents(contents) &&
            nested.length === 0 &&
            !(keep.frame?.(screen.id) ?? false)
        ) {
            return null;
        }

        const chooseView = (viewId: string) => {
            setChosenViews({ ...chosenViews, [screen.id]: viewId });
            events.setScreenView(viewId);
            editFrame({ kind: 'select', id: viewId });
        };

        return (
            <ExplorerItem
                key={screen.id}
                kind="screen"
                name={screen.name}
                icon={<Icon icon={{ component: AppWindow, size: 16 }} />}
                chips={
                    <span className={styles.chips}>
                        {screenViews.length === 0 ? (
                            <span className={`${styles.chip} ${styles.muted}`}>Not placed</span>
                        ) : (
                            screenViews.map((view) => (
                                <ViewChip
                                    key={view.id}
                                    view={view}
                                    screenName={screen.name}
                                    label={document.frames[view.id]?.name ?? view.name}
                                    current={screenViews.length > 1 && view.id === shownView?.id}
                                    selected={selectedFrameId === view.id}
                                    actions={frameActions(view)}
                                    onChoose={() => chooseView(view.id)}
                                />
                            ))
                        )}
                    </span>
                }
                selected={selectedFrameId === screen.id}
                visible={screen.shown}
                collapseId={
                    nested.length > 0 || hasContents(contents)
                        ? explorerKey('screen', screen.id)
                        : undefined
                }
                defaultOpen={narrowed || screenViews.some((view) => view.id === editedViewId)}
                onClick={() => editFrame({ kind: 'select', id: screen.id })}
                onRename={renameFrame(screen)}
                onDrop={
                    screen.locked || screen.inheritedLock
                        ? undefined
                        : (dragged) => moveIntoFrame(dragged, rootId)
                }
                menuActions={frameActions(screen)}
                menuItems={
                    screenViews.length > 0
                        ? [
                              { heading: 'Edit in view' },
                              ...screenViews.map((view) => ({
                                  id: `view:${view.id}`,
                                  label: view.name,
                                  checked: view.id === shownView?.id,
                                  onRun: () => chooseView(view.id)
                              }))
                          ]
                        : undefined
                }
            >
                {nested.map((child) => frameItem(child, shownView?.id))}
                <ObjectContents {...(contents ?? noContents)} viewId={shownView?.id} />
            </ExplorerItem>
        );
    };

    const screenRows = screens.map(screenItem).filter(Boolean);
    const canvasFrames = shownFrames.filter(
        (frame) =>
            frame.parentFrameId === undefined &&
            !owners.get(frame.id) &&
            !(frame.kind === 'view' && frame.screenId && document.frames[frame.screenId])
    );
    const scene = tree.canvas;
    const hasCanvasRows = canvasFrames.length > 0 || hasContents(scene);
    const sources = Object.values(components).flatMap((component) => {
        const member = (id: string) => component.sourceShapes?.[id] ?? document.shapes[id];
        const members = component.shapesIds.filter((id) => member(id));

        members.sort((a, b) => {
            if (!component.library) {
                return (drawOrder.get(b) ?? -1) - (drawOrder.get(a) ?? -1);
            }
            const first = member(a);
            const second = member(b);

            return first && second ? byDrawingOrder(second, first) : 0;
        });
        const kept = keep.shape ? members.filter(keep.shape) : members;
        const componentNamed = component.name.toLowerCase().includes(filter);
        const matching = kept.filter((id) => member(id)?.name.toLowerCase().includes(filter));

        if ((keep.shape && kept.length === 0) || (filter && !componentNamed && !matching.length)) {
            return [];
        }

        return [{ component, shapesIds: !filter || componentNamed ? kept : matching }];
    });
    const layers = document.layersIds.map((id) => document.layers[id]).filter(Boolean);
    const clearFilter = () => {
        showAllLayers();
        setStatus('all');
    };
    const filterLabel =
        [
            shownLayerId && document.layers[shownLayerId]
                ? `Layer: ${document.layers[shownLayerId].name}`
                : null,
            status === 'hiddenOrLocked' ? 'Hidden and locked' : null
        ]
            .filter(Boolean)
            .join(' · ') || null;
    const filterItems: ExplorerMenuItem[] = [
        { heading: 'Show' },
        {
            id: 'status:all',
            label: 'Everything',
            checked: status === 'all',
            onRun: () => setStatus('all')
        },
        {
            id: 'status:flagged',
            label: 'Hidden and locked only',
            checked: status === 'hiddenOrLocked',
            onRun: () => setStatus('hiddenOrLocked')
        },
        ...(layers.length > 0
            ? [
                  'separator' as const,
                  { heading: 'Layer' },
                  ...layers.map((layer) => ({
                      id: `layer:${layer.id}`,
                      label: layer.name,
                      checked: shownLayerId === layer.id,
                      // Shown alone, the layer also takes what is drawn; choosing it again shows all.
                      onRun: () => showOnlyLayer(layer.id)
                  }))
              ]
            : []),
        'separator',
        {
            id: 'new-layer',
            label: 'New layer',
            disabled: !canAddLayer,
            onRun: () => runCommand(NewLayerCommand)
        },
        { id: 'manage-layers', label: 'Manage layers…', onRun: () => setManagingLayers(true) }
    ];
    const empty = screenRows.length === 0 && !hasCanvasRows && sources.length === 0;

    return (
        <OpenItems.Provider value={openRows}>
            <section
                ref={panel}
                className={styles.explorer}
                aria-label="Explorer"
                onPointerDownCapture={(event) => {
                    lastPress.current = {
                        x: event.clientX,
                        y: event.clientY,
                        time: performance.now()
                    };
                }}
            >
                <div className={styles.header}>
                    <SearchBoxContainer label="Search" />
                    <button
                        ref={filterButton}
                        type="button"
                        className={styles.filterButton}
                        aria-label="Filter"
                        title="Filter"
                        aria-haspopup="menu"
                        aria-expanded={filterMenu !== null}
                        data-active={filterLabel !== null}
                        onClick={(event) => {
                            const box = event.currentTarget.getBoundingClientRect();

                            setFilterMenu(filterMenu ? null : { x: box.left, y: box.bottom + 4 });
                        }}
                    >
                        <Icon icon={{ component: ListFilter, size: 16 }} />
                    </button>
                </div>
                {filterLabel && (
                    <div className={styles.filterPill}>
                        <span
                            title={
                                shownLayerId
                                    ? 'Only this layer shows, and new shapes go onto it'
                                    : undefined
                            }
                        >
                            {filterLabel}
                        </span>
                        <button
                            type="button"
                            aria-label="Clear filter"
                            title="Clear filter"
                            onClick={clearFilter}
                        >
                            <Icon icon={{ component: X, size: 12 }} />
                        </button>
                    </div>
                )}
                {filterMenu && (
                    <ExplorerMenu
                        label="Filter"
                        position={filterMenu}
                        items={filterItems}
                        anchor={filterButton.current}
                        onClose={() => setFilterMenu(null)}
                    />
                )}
                {managingLayers && <LayerManager onClose={() => setManagingLayers(false)} />}
                <div ref={outline} className={styles.outline} data-explorer-outline>
                    {empty && (
                        <p className={styles.empty}>
                            {narrowed ? 'No matches' : 'Draw a shape or add a screen to start.'}
                        </p>
                    )}
                    {screenRows.length > 0 && <Section title="Screens">{screenRows}</Section>}
                    {hasCanvasRows && (
                        <Section title="Canvas" onDrop={(dragged) => moveIntoFrame(dragged, null)}>
                            {canvasFrames.map((frame) => frameItem(frame))}
                            <ObjectContents {...scene} />
                        </Section>
                    )}
                    {sources.length > 0 && (
                        <Section title="Components">
                            {sources.map(({ component, shapesIds }) => (
                                <SourceItem
                                    key={component.id}
                                    componentId={component.id}
                                    shapesIds={shapesIds}
                                >
                                    {shapesIds.map((shapeId) =>
                                        component.library ? (
                                            <ExplorerItem
                                                key={shapeId}
                                                kind={
                                                    component.sourceShapes?.[shapeId]?.type ===
                                                    'instance'
                                                        ? 'instance'
                                                        : 'shape'
                                                }
                                                name={
                                                    component.sourceShapes?.[shapeId]?.name ??
                                                    shapeId
                                                }
                                                icon={
                                                    component.sourceShapes?.[shapeId] && (
                                                        <ObjectTypeSymbol
                                                            type={
                                                                component.sourceShapes[shapeId].type
                                                            }
                                                        />
                                                    )
                                                }
                                            />
                                        ) : (
                                            <ShapeItem
                                                key={shapeId}
                                                shapeId={shapeId}
                                                sourceId={component.id}
                                            />
                                        )
                                    )}
                                </SourceItem>
                            ))}
                        </Section>
                    )}
                    {/* Pressing the space under the outline selects the canvas. */}
                    <div
                        className={styles.rest}
                        aria-hidden="true"
                        onClick={() => selectExplorerLayer(null)}
                        onDragOver={(event) => {
                            if (acceptsDragged(event)) {
                                event.preventDefault();
                            }
                        }}
                        onDrop={(event) => {
                            const dropped = readDragged(event);

                            if (dropped) {
                                event.preventDefault();
                                moveIntoFrame(dropped, null);
                            }
                        }}
                    />
                </div>
            </section>
        </OpenItems.Provider>
    );
};

/** The element that scrolls the Explorer: the panel itself, or one holding it. */
function scrollParent(element: HTMLElement | null) {
    for (let current = element; current; current = current.parentElement) {
        const { overflowY } = getComputedStyle(current);

        if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            current.scrollHeight > current.clientHeight
        ) {
            return current;
        }
    }

    return null;
}

/** One of a screen's views, as a chip after its name: pressing it edits the screen there. */
const ViewChip: FC<{
    view: {
        id: string;
        name: string;
        size: { width: number; height: number };
        visible: boolean;
        locked: boolean;
        shown: boolean;
    };
    screenName: string;
    label: string;
    current: boolean;
    selected: boolean;
    actions: ItemMenuAction[];
    onChoose: () => void;
}> = ({ view, screenName, label, current, selected, actions, onChoose }) => {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

    return (
        <>
            <button
                type="button"
                tabIndex={-1}
                className={[
                    styles.chip,
                    current && styles.current,
                    selected && styles.chipSelected,
                    !view.shown && styles.muted
                ]
                    .filter(Boolean)
                    .join(' ')}
                aria-label={view.name}
                aria-pressed={selected}
                title={`${screenName} · ${view.size.width} × ${view.size.height} Screen view${
                    view.locked ? ' · locked' : ''
                }`}
                onClick={(event) => {
                    event.stopPropagation();
                    onChoose();
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setMenu({ x: event.clientX, y: event.clientY });
                }}
            >
                {label}
                {view.locked && <Icon icon={{ component: Lock, size: 10 }} />}
            </button>
            {menu && (
                <ExplorerMenu
                    label={`${view.name} actions`}
                    position={menu}
                    items={[
                        { id: 'select', label: `Select ${view.name}`, onRun: onChoose },
                        ...actions.map((action) => ({
                            id: action.id,
                            label: action.label,
                            icon: action.icon,
                            disabled: action.disabled,
                            onRun: action.onRun
                        }))
                    ]}
                    onClose={() => setMenu(null)}
                />
            )}
        </>
    );
};
