import type { Context } from 'src/app';
import type { Frame } from 'src/app/types';
import type { UpdateFrame } from 'src/app/operations';
import { isFrameLocked, isFrameVisible } from 'src/app/frameState';
import { isScreenLayout } from 'src/app/screenLayouts';
import { editableScreenView } from 'src/app/screenViewEditing';
import { MIN_FRAME_SIZE } from 'src/app/services/documentStorage';
import { readParameters } from './creation';
import { bindingEdit, bindingVariable } from './bindings';
import { FRAME_NUMBER_KEYS, acceptsFrameNumber, frameNumber } from 'src/app/frameVariables';
import type { FrameNumberKey } from 'src/app/frameVariables';
import { resolveVariable } from 'src/app/variableResolver';

export const FRAME_SELECTION_HELP =
    'Edit frame: w=390 h=844 · move x=24 y=-8 · gap=16 padding=24. Gap and padding require an existing stack.';
export const VIEW_SELECTION_HELP =
    'Edit view: w=390 h=844 · move x=24 y=-8. gap=16 padding=24 edits its active shared layout’s existing stack. Resize first, then edit the stack.';

/** View geometry stays local; stack inputs belong to the currently displayed source layout. */
export function frameSelectionOperations(input: string, state: Context['state']): UpdateFrame[] {
    const document = state.currentDocument;
    const frame = document.frames[document.selectedFrameId ?? ''];
    if (
        !frame ||
        document.locked ||
        !isFrameVisible(document, frame.id) ||
        isFrameLocked(document, frame.id)
    ) {
        throw new Error('Select an editable frame or Screen view.');
    }

    const binding = bindingEdit(input);
    if (binding) {
        if (!FRAME_NUMBER_KEYS.includes(binding.key as FrameNumberKey)) {
            throw new Error('Frames can bind width, height, gap or padding.');
        }
        const key = binding.key as FrameNumberKey;
        const target = ['gap', 'padding'].includes(key) ? stackTarget(state, frame) : frame;
        const variable =
            binding.variable === undefined
                ? undefined
                : bindingVariable(document, binding.variable);
        const value = variable
            ? resolveVariable(variable, document.variables)
            : frameNumber(target, key);
        if (
            (variable && variable.type !== 'number') ||
            typeof value !== 'number' ||
            !acceptsFrameNumber(target, key, value)
        ) {
            throw new Error(
                'This property needs a compatible number variable, fixed sizing, and an existing stack for gap or padding. Screen view dimensions cannot be bound.'
            );
        }
        const bindings = { ...target.bindings };
        delete bindings[key];
        if (variable) {
            bindings[key] = variable.id;
        }

        return [{ op: 'updateFrame', frame: target.id, changes: { bindings } }];
    }

    const moving = /^move\s/i.test(input.trim());
    const parameters = readParameters(` ${input.trim().replace(/^move\s+/i, '')}`);
    const allowed = moving ? ['x', 'y'] : ['width', 'height', 'gap', 'padding'];
    const values = Object.fromEntries(
        Object.entries(parameters).map(([key, text]) => {
            if (!allowed.includes(key)) {
                throw new Error(`Unknown parameter ${key}. Available: ${allowed.join(', ')}.`);
            }
            const value = Number(text);
            const minimum = key === 'width' || key === 'height' ? MIN_FRAME_SIZE : 0;
            if (!text.trim() || !Number.isFinite(value) || (!moving && value < minimum)) {
                throw new Error(
                    `${key} must be ${moving ? 'a finite number' : `a finite number of at least ${minimum}`}.`
                );
            }

            return [key, value];
        })
    );
    if (moving && Object.values(values).every((value) => value === 0)) {
        throw new Error('Move needs a non-zero x or y.');
    }

    const sizing = 'width' in values || 'height' in values;
    const stacking = 'gap' in values || 'padding' in values;
    if ((moving || sizing) && isScreenLayout(document.frames, frame.id)) {
        throw new Error(
            'This layout follows its Screen view. Select a Screen view to resize or move it.'
        );
    }
    if (frame.kind === 'view' && sizing && stacking) {
        throw new Error(
            'Resize the Screen view first, then edit its active layout’s stack in a separate command.'
        );
    }
    if (moving) {
        return [
            {
                op: 'updateFrame',
                frame: frame.id,
                changes: {
                    position: {
                        x: frame.position.x + (values.x ?? 0),
                        y: frame.position.y + (values.y ?? 0)
                    }
                }
            }
        ];
    }

    const target = stacking ? stackTarget(state, frame) : frame;
    if (stacking && !target.stack) {
        throw new Error('This frame has no stack. Choose Row or Column in the Inspector first.');
    }
    for (const axis of ['width', 'height'] as const) {
        if (axis in values && (frame.sizing?.[axis]?.mode ?? 'fixed') !== 'fixed') {
            throw new Error(
                `${axis} uses ${frame.sizing![axis]!.mode} sizing. Choose Fixed in the Inspector first.`
            );
        }
    }
    const bindings = Object.fromEntries(
        Object.entries(target.bindings ?? {}).filter(([key]) => !(key in values))
    );

    return [
        {
            op: 'updateFrame',
            frame: target.id,
            changes: {
                ...(target.kind !== 'view' ? { bindings } : {}),
                ...(sizing
                    ? {
                          size: {
                              width: values.width ?? frame.size.width,
                              height: values.height ?? frame.size.height
                          }
                      }
                    : {}),
                ...(stacking
                    ? {
                          stack: {
                              ...target.stack!,
                              gap: values.gap ?? target.stack!.gap,
                              padding: values.padding ?? target.stack!.padding
                          }
                      }
                    : {})
            }
        }
    ];
}

function stackTarget(state: Context['state'], frame: Frame): Frame {
    if (frame.kind !== 'view') {
        return frame;
    }

    const placed = editableScreenView(state, {
        documentId: state.currentDocumentId,
        viewId: frame.id
    });
    if (!placed || placed.projection.exceedsNodeLimit) {
        throw new Error('This Screen view’s shared layout is unavailable for editing.');
    }

    return placed.screen;
}
