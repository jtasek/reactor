import React, { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { useActions, useControls, useCurrentDocument } from 'src/app/hooks';
import { LayerPanel } from '../LayerPanel/LayerPanel';
import styles from './styles.css';

export const DocumentMenu = () => {
    const document = useCurrentDocument();
    const { layerPanel } = useControls();
    const { setPanelPlacement, ui } = useActions();
    const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);
    const open = openDocumentId === document.id;
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        menu.current
            ?.querySelector<HTMLButtonElement>(
                '[data-layer-highlight][aria-pressed="true"], [data-attach]'
            )
            ?.focus();
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !root.current?.contains(event.target)) {
                setOpenDocumentId(null);
            }
        };
        const popup = menu.current;
        const navigate = (event: globalThis.KeyboardEvent) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpenDocumentId(null);
                trigger.current?.focus();
                return;
            }
            if (!popup || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const items = Array.from(
                popup.querySelectorAll<HTMLButtonElement>('[data-layer-highlight]')
            );
            if (items.length === 0) return;
            event.preventDefault();
            const current = items.indexOf(window.document.activeElement as HTMLButtonElement);
            const next =
                event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                        items.length;
            items[next]?.focus();
        };
        popup?.addEventListener('keydown', navigate);
        window.document.addEventListener('pointerdown', dismiss);
        return () => {
            popup?.removeEventListener('keydown', navigate);
            window.document.removeEventListener('pointerdown', dismiss);
        };
    }, [open, layerPanel.visible]);

    const close = () => {
        setOpenDocumentId(null);
        trigger.current?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        event.stopPropagation();
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
        }
    };

    return (
        <div
            className={styles.documentMenu}
            role="group"
            aria-label="Document layers"
            ref={root}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpenDocumentId(null);
            }}
        >
            <button
                type="button"
                className={styles.trigger}
                ref={trigger}
                aria-label={`${document.name}: highlight a layer`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpenDocumentId(open ? null : document.id)}
                onKeyDown={(event) => {
                    handleKeyDown(event);
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setOpenDocumentId(document.id);
                    }
                }}
            >
                <span className={styles.label} title={document.name}>
                    {document.name}
                </span>
                <span aria-hidden="true">▾</span>
            </button>
            {open && (
                <div
                    className={styles.menu}
                    id={menuId}
                    ref={menu}
                    role="dialog"
                    aria-label="Document layers"
                >
                    {layerPanel.visible ? (
                        <button
                            type="button"
                            data-attach
                            onClick={() => ui.hideControl('layerPanel')}
                        >
                            Return layers to document menu
                        </button>
                    ) : (
                        <LayerPanel
                            layersIds={document.layersIds}
                            detached={false}
                            onHighlight={close}
                            onPlacementChange={() => {
                                const bounds = trigger.current!.getBoundingClientRect();
                                setPanelPlacement({
                                    id: 'layerPanel',
                                    placement: {
                                        dock: null,
                                        position: { x: bounds.left, y: bounds.bottom }
                                    }
                                });
                                ui.showControl('layerPanel');
                                close();
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
