import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { useRoleEditor } from 'src/app/roleHooks';
import type { ActivationAction, InteractionSettings, Point } from 'src/app/types';
import { ExplorerMenu, type ExplorerMenuItem } from 'src/ui/components/Explorer/ExplorerMenu';
import menuStyles from '../ui/components/ContextMenu/styles.css';
import styles from './Flow.css';

type Page = 'link' | 'here' | 'shown' | 'newState';

/**
 * The one place a link is edited: where the control goes, what it changes on its own
 * screen, and when it is shown. Every choice applies at once, as one undo step.
 */
export function FlowLinkMenu({
    instanceId,
    name,
    shared,
    position,
    onClose
}: {
    instanceId: string;
    name: string;
    /** Inside another component: an edit changes it everywhere that component is used. */
    shared: boolean;
    position: Point;
    onClose: () => void;
}) {
    const [page, setPage] = useState<Page>('link');
    const data = useRoleEditor(undefined, instanceId);
    const { editInteractions, unselectShapes, selectShape } = useActions();
    const effects = useEffects();
    // How the thing this control shows or hides starts, to set both in one place.
    const target = useAppState((state) => {
        const action = data?.activation;
        const shape =
            action?.type === 'toggleVisibility'
                ? state.currentDocument.shapes[action.instanceId]
                : undefined;

        return shape?.type === 'instance' && !shape.prototypeVisibilityStateId
            ? { id: shape.id, name: shape.name, hidden: shape.prototypeVisible === false }
            : undefined;
    });

    if (!data) {
        return null;
    }

    const off = data.disabled;
    const action = data.activation;
    const explicit = data.actionInherited ? undefined : action;
    const update = (settings: InteractionSettings) =>
        editInteractions({ target: 'instance', id: instanceId, settings });
    const act = (activate: ActivationAction) => update({ activate });
    const stateName = (id: string) =>
        data.prototypeBooleans.find((value) => value.id === id)?.name ?? 'a missing state';
    const describe = (value: ActivationAction | null | undefined) => {
        switch (value?.type) {
            case 'navigate':
                return `Go to ${data.screens.find((screen) => screen.id === value.screenId)?.name ?? 'a missing screen'}`;
            case 'changeVariant':
                return 'Show variant';
            case 'toggleVisibility':
                return 'Show or hide';
            case 'toggleState':
                return `Switch ${stateName(value.stateId)}`;
            case 'setState':
                return `Turn ${stateName(value.stateId)} ${value.value ? 'on' : 'off'}`;
            default:
                return 'No action';
        }
    };
    const follows = data.prototypeVisibilityStateId;
    const shown = follows
        ? `When ${stateName(follows)} is ${data.prototypeVisibilityWhen ? 'on' : 'off'}`
        : data.prototypeVisible === false
          ? 'Hidden at first'
          : 'Always';
    const back: ExplorerMenuItem = {
        id: 'back',
        label: '‹ Back',
        keepOpen: true,
        onRun: () => setPage('link')
    };
    const states = data.prototypeBooleans.filter((value) => value.id !== follows);
    const onThisScreen =
        data.variantTargets.length > 0 || data.visibilityTargets.length > 0 || !off;
    const pages: Record<Exclude<Page, 'newState'>, ExplorerMenuItem[]> = {
        link: [
            ...(off || shared
                ? [
                      {
                          heading: off
                              ? 'Locked or view only'
                              : 'Applies wherever its component is used'
                      }
                  ]
                : []),
            { heading: 'Go to' },
            ...data.screens.map(
                (screen): ExplorerMenuItem => ({
                    id: `go:${screen.id}`,
                    label: screen.name,
                    checked: explicit?.type === 'navigate' && explicit.screenId === screen.id,
                    disabled: off,
                    onRun: () => act({ type: 'navigate', screenId: screen.id })
                })
            ),
            'separator',
            ...(onThisScreen
                ? [
                      {
                          id: 'here',
                          label: 'On this screen',
                          detail:
                              explicit && explicit.type !== 'navigate'
                                  ? `${describe(explicit)} ›`
                                  : '›',
                          keepOpen: true,
                          onRun: () => setPage('here')
                      }
                  ]
                : []),
            {
                id: 'inherit',
                label: 'Component’s action',
                detail: describe(data.sourceActivation),
                checked: data.actionInherited,
                disabled: off,
                onRun: () => update({})
            },
            'separator',
            ...(data.prototypeVisible !== undefined
                ? [
                      {
                          id: 'shown',
                          label: 'Shown',
                          detail: `${shown} ›`,
                          keepOpen: true,
                          onRun: () => setPage('shown')
                      }
                  ]
                : []),
            {
                id: 'canvas',
                label: 'Show on canvas',
                onRun: () => {
                    unselectShapes();
                    selectShape(instanceId);
                    effects.navigate('/');
                }
            },
            {
                id: 'remove',
                label: 'Remove link',
                danger: true,
                disabled: off || !action,
                onRun: () => update({ activate: null })
            }
        ],
        here: [
            back,
            ...data.variantTargets.flatMap((item): ExplorerMenuItem[] => [
                { heading: `Show ${item.name} as` },
                ...item.variants.map(
                    (variant): ExplorerMenuItem => ({
                        id: `variant:${item.id}:${variant.id}`,
                        label: variant.name,
                        checked:
                            explicit?.type === 'changeVariant' &&
                            explicit.instanceId === item.id &&
                            explicit.variantId === variant.id,
                        disabled: off,
                        onRun: () =>
                            act({
                                type: 'changeVariant',
                                instanceId: item.id,
                                variantId: variant.id
                            })
                    })
                )
            ]),
            ...(data.visibilityTargets.length > 0 ? [{ heading: 'Show or hide' }] : []),
            ...data.visibilityTargets.map(
                (item): ExplorerMenuItem => ({
                    id: `visibility:${item.id}`,
                    label: item.name,
                    checked:
                        explicit?.type === 'toggleVisibility' && explicit.instanceId === item.id,
                    disabled: off,
                    onRun: () => act({ type: 'toggleVisibility', instanceId: item.id })
                })
            ),
            ...(target
                ? [
                      {
                          id: 'starts-hidden',
                          label: `${target.name} starts hidden`,
                          checked: target.hidden,
                          disabled: off,
                          onRun: () =>
                              editInteractions({
                                  target: 'state',
                                  kind: 'bind',
                                  instanceId: target.id,
                                  stateId: null,
                                  visible: target.hidden
                              })
                      } satisfies ExplorerMenuItem
                  ]
                : []),
            { heading: 'Turn on or off' },
            ...states.flatMap((value): ExplorerMenuItem[] => [
                {
                    id: `toggle:${value.id}`,
                    label: `Switch ${value.name}`,
                    checked: explicit?.type === 'toggleState' && explicit.stateId === value.id,
                    disabled: off,
                    onRun: () => act({ type: 'toggleState', stateId: value.id })
                },
                ...[true, false].map(
                    (on): ExplorerMenuItem => ({
                        id: `set:${value.id}:${on}`,
                        label: `Turn ${value.name} ${on ? 'on' : 'off'}`,
                        checked:
                            explicit?.type === 'setState' &&
                            explicit.stateId === value.id &&
                            explicit.value === on,
                        disabled: off,
                        onRun: () => act({ type: 'setState', stateId: value.id, value: on })
                    })
                )
            ]),
            {
                id: 'new-state',
                label: 'New state…',
                disabled: off,
                keepOpen: true,
                onRun: () => setPage('newState')
            }
        ],
        shown: [
            back,
            { heading: `${name} is shown` },
            {
                id: 'shown:always',
                label: 'Always',
                checked: !follows && data.prototypeVisible !== false,
                disabled: off,
                onRun: () =>
                    editInteractions({
                        target: 'state',
                        kind: 'bind',
                        instanceId,
                        stateId: null,
                        visible: true
                    })
            },
            {
                id: 'shown:hidden',
                label: 'Once something shows it',
                checked: !follows && data.prototypeVisible === false,
                disabled: off,
                onRun: () =>
                    editInteractions({
                        target: 'state',
                        kind: 'bind',
                        instanceId,
                        stateId: null,
                        visible: false
                    })
            },
            ...data.prototypeBooleans
                .filter((value) => value.id === follows || !data.blockedStateIds.includes(value.id))
                .flatMap((value) =>
                    [true, false].map(
                        (when): ExplorerMenuItem => ({
                            id: `shown:${value.id}:${when}`,
                            label: `When ${value.name} is ${when ? 'on' : 'off'}`,
                            checked: follows === value.id && data.prototypeVisibilityWhen === when,
                            disabled: off,
                            onRun: () =>
                                editInteractions({
                                    target: 'state',
                                    kind: 'bind',
                                    instanceId,
                                    stateId: value.id,
                                    when
                                })
                        })
                    )
                )
        ]
    };

    if (page === 'newState') {
        return (
            <NewState
                position={position}
                onCancel={onClose}
                onAdd={(stateName) => {
                    const problem = editInteractions({
                        target: 'state',
                        kind: 'add',
                        name: stateName,
                        initial: false
                    });

                    return typeof problem === 'string' ? problem : undefined;
                }}
                onAdded={onClose}
                instanceId={instanceId}
            />
        );
    }

    // A fresh menu per page, so focus lands on its first item.
    return (
        <ExplorerMenu
            key={page}
            label={`Link from ${name}`}
            position={position}
            items={pages[page]}
            onClose={onClose}
        />
    );
}

/** Names a new on/off state and makes the control switch it. */
function NewState({
    position,
    instanceId,
    onAdd,
    onAdded,
    onCancel
}: {
    position: Point;
    instanceId: string;
    onAdd: (name: string) => string | undefined;
    onAdded: () => void;
    onCancel: () => void;
}) {
    const form = useRef<HTMLFormElement>(null);
    const [name, setName] = useState('');
    const [problem, setProblem] = useState<string>();
    const { editInteractions } = useActions();
    const added = useAppState((state) =>
        Object.values(state.currentDocument.prototypeBooleans).find(
            (value) => value.name === name.trim()
        )
    );
    const pending = useRef(false);

    useEffect(() => {
        const close = (event: PointerEvent) => {
            if (event.target instanceof Node && !form.current?.contains(event.target)) {
                onCancel();
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onCancel();
            }
        };
        document.addEventListener('pointerdown', close, true);
        document.addEventListener('keydown', escape, true);

        return () => {
            document.removeEventListener('pointerdown', close, true);
            document.removeEventListener('keydown', escape, true);
        };
    }, [onCancel]);
    useEffect(() => form.current?.querySelector('input')?.focus(), []);
    useEffect(() => {
        // The state exists once the store has it; then the control can switch it.
        if (pending.current && added) {
            pending.current = false;
            editInteractions({
                target: 'instance',
                id: instanceId,
                settings: { activate: { type: 'toggleState', stateId: added.id } }
            });
            onAdded();
        }
    }, [added, editInteractions, instanceId, onAdded]);

    return createPortal(
        <form
            ref={form}
            className={`${menuStyles.contextMenu} ${styles.newState}`}
            style={{
                left: Math.max(8, Math.min(position.x, window.innerWidth - 260)),
                top: Math.max(8, Math.min(position.y, window.innerHeight - 140))
            }}
            aria-label="New state"
            onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) {
                    return;
                }
                if (added) {
                    setProblem('A state with this name already exists.');

                    return;
                }
                pending.current = true;
                const error = onAdd(name.trim());
                if (error) {
                    pending.current = false;
                    setProblem(error);
                }
            }}
        >
            <label>
                Name of the new state
                <input
                    type="text"
                    maxLength={100}
                    value={name}
                    placeholder="Help is open"
                    onChange={(event) => {
                        setName(event.target.value);
                        setProblem(undefined);
                    }}
                />
            </label>
            {problem && <p role="alert">{problem}</p>}
            <div>
                <button type="button" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" disabled={!name.trim()}>
                    Add
                </button>
            </div>
        </form>,
        document.body
    );
}
