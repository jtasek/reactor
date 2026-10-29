import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useActions, useCurrentDocument, useVariableContext } from 'src/app/hooks';
import { ordered } from 'src/app/variableModes';
import { NUMBER_MODE_SUPPORT } from 'src/app/contextualLayout';
import styles from './styles.css';

export function ModePreview() {
    const document = useCurrentDocument();
    const context = useVariableContext();
    const { setPreviewMode } = useActions();
    const dimensions = ordered(document.dimensions);
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const popover = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const close = () => {
        popover.current?.hidePopover();
        trigger.current?.focus();
    };

    const position = useCallback(() => {
        if (!popover.current || !trigger.current) {
            return;
        }
        const anchor = trigger.current.getBoundingClientRect();
        const bounds = popover.current.getBoundingClientRect();
        popover.current.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
        popover.current.style.top = `${Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - bounds.height - 8))}px`;
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }
        const element = popover.current;
        // Keep editor shortcuts outside the popover, as the shared Dialog does.
        const stopShortcuts = (event: KeyboardEvent) => event.stopPropagation();
        element?.addEventListener('keydown', stopShortcuts);
        const resize = new ResizeObserver(position);
        if (element) {
            resize.observe(element);
        }
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);

        return () => {
            resize.disconnect();
            element?.removeEventListener('keydown', stopShortcuts);
            window.removeEventListener('resize', position);
            window.removeEventListener('scroll', position, true);
        };
    }, [open, position]);

    return (
        <>
            <button
                ref={trigger}
                type="button"
                popoverTarget={id}
                aria-label="Preview modes"
                aria-haspopup="dialog"
                aria-controls={id}
                aria-expanded={open}
                disabled={!dimensions.length}
                title={!dimensions.length ? 'Create a dimension to preview its modes' : undefined}
            >
                Preview
            </button>
            <div
                ref={popover}
                id={id}
                popover="auto"
                role="dialog"
                tabIndex={-1}
                aria-label="Canvas preview"
                className={styles.previewPopover}
                onToggle={(event) => {
                    setOpen(event.newState === 'open');
                    if (event.newState !== 'open' || !popover.current || !trigger.current) {
                        return;
                    }
                    position();
                    popover.current.querySelector('select')?.focus();
                }}
            >
                <h3>Canvas preview</h3>
                <p className={styles.resolution}>
                    Your preview only. Screen view settings stay unchanged.
                </p>
                {dimensions.map((dimension) => (
                    <label className={styles.formField} key={dimension.id}>
                        {dimension.name}
                        <select
                            aria-label={`Preview ${dimension.name}`}
                            value={context[dimension.id] ?? dimension.defaultModeId}
                            onChange={(event) =>
                                setPreviewMode({
                                    dimensionId: dimension.id,
                                    modeId: event.target.value
                                })
                            }
                        >
                            {ordered(dimension.modes).map((mode) => (
                                <option key={mode.id} value={mode.id}>
                                    {mode.name}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
                {Object.values(document.variables).some((item) => item.type === 'number') && (
                    <p className={styles.resolution}>{NUMBER_MODE_SUPPORT}</p>
                )}
                <button type="button" onClick={close}>
                    Close preview
                </button>
            </div>
        </>
    );
}
