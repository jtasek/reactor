import React, { FC } from 'react';
import {
    RectangleHorizontal,
    Circle,
    Type,
    Scaling,
    Radius,
    Move,
    Palette,
    Link,
    Unlink,
    BetweenHorizontalStart
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    useActions,
    useAppState,
    useCommands,
    useCommandsEnabled,
    useEffects
} from 'src/app/hooks';
import { takesEditorInput } from 'src/events/input';
import { viewLayoutRoot } from 'src/app/screenLayouts';
import { screenViewName } from 'src/app/screenViews';
import { isFrameLocked, isFrameVisible } from 'src/app/frameState';
import { getTools } from 'src/app/actions/startup';
import { screenToWorld } from 'src/app/camera';
import { SHAPE_PROPERTIES, canEdit as canEditProperty } from 'src/app/properties';
import { SHAPE_BINDING_KEYS } from './bindings';
import { FRAME_NUMBER_KEYS, acceptsFrameNumber, frameNumber } from 'src/app/frameVariables';
import { EDIT_ACTIONS, parameterLabel } from './parameters';
import { CommandLine } from './CommandLine';
import {
    SELECTION_HELP,
    SELECTION_PATTERN,
    SHARED_ARTWORK_HELP,
    selectionOperations
} from './selection';
import { FRAME_SELECTION_HELP, VIEW_SELECTION_HELP } from './frameSelection';
import { creationTarget } from './creationTarget';
import { CREATIONS, CREATION_PATTERN, creationOperation } from './creation';

const GUIDED_ICONS: Record<string, LucideIcon> = {
    'create rectangle': RectangleHorizontal,
    'create circle': Circle,
    'create text': Type,
    'edit size': Scaling,
    'edit radius': Radius,
    'edit position': Move,
    'edit stack': BetweenHorizontalStart,
    'edit colors': Palette,
    'edit text': Type,
    'bind variable': Link,
    'unbind variable': Unlink
};

const ActiveCommandLine: FC = () => {
    const actions = useActions();
    const effects = useEffects();
    const commands = useCommands();
    const enabled = useCommandsEnabled(commands);
    const state = useAppState((state) => state);

    const canEdit = takesEditorInput(state) && !state.currentDocument.locked;
    const canCreate = canEdit && !state.currentDocument.editingComponentId;
    const submit = (input: string) => {
        try {
            const tool = getTools().find(
                (tool) => `${tool.name} tool`.toLowerCase() === input.trim().toLowerCase()
            );

            if (tool) {
                if (!canCreate) {
                    return 'Tools are unavailable right now.';
                }

                actions.tools.activateTool(tool.id);

                return undefined;
            }

            if (SELECTION_PATTERN.test(input.trim())) {
                if (!canEdit) {
                    return 'Selection editing is unavailable right now.';
                }

                const operations = selectionOperations(input, state);
                const result = actions.applyOperations({
                    documentId: state.currentDocumentId,
                    by: { kind: 'person' },
                    operations
                });

                return result.applied ? undefined : result.problem;
            }

            if (!CREATION_PATTERN.test(input.trim())) {
                return actions.submitCommandLine(input);
            }

            const size = effects.viewSize();
            const center = screenToWorld(
                { x: size.width / 2, y: size.height / 2 },
                state.currentDocument.camera
            );
            if (!center) {
                return 'Canvas position is unavailable.';
            }

            if (!canCreate) {
                return 'Creation is unavailable. Return to an editable canvas and finish the current gesture.';
            }

            const target = creationTarget(state, center);
            const operation = creationOperation(input, target.center, target);

            if (!operation) {
                return actions.submitCommandLine(input);
            }

            const result = actions.applyOperations({
                documentId: state.currentDocumentId,
                by: { kind: 'person' },
                operations: [operation]
            });

            return result.applied ? undefined : result.problem;
        } catch (error) {
            return error instanceof Error ? error.message : 'Could not run this command.';
        }
    };
    const askAi = async (input: string) => {
        const documentId = state.currentDocumentId;
        const { chatFor } = await import('src/ai/chat');

        if (documentId !== state.currentDocumentId) {
            return 'The document changed. Try again in the current document.';
        }
        if (state.ai !== 'available' || !takesEditorInput(state) || state.currentDocument.locked) {
            return 'AI chat is unavailable right now.';
        }

        const chat = chatFor(state.currentDocumentId);
        const snapshot = chat.getSnapshot();
        const last = snapshot.turns.at(-1);

        if (snapshot.draft || last?.status === 'proposing' || last?.status === 'proposed') {
            actions.requestAiEdit();

            return 'Your AI chat already has a draft or proposal. Finish it first; your command is kept here.';
        }

        actions.requestAiEdit();

        if (state.aiEditDocumentId !== state.currentDocumentId) {
            return 'AI chat is unavailable right now.';
        }

        chat.setDraft(input);

        return undefined;
    };

    const document = state.currentDocument;
    const frame = document.frames[document.selectedFrameId ?? ''];
    const selection = frame
        ? screenViewName(document, frame)
        : `${document.selectedShapesIds.length} selected${document.selectedShapesIds.length === 1 ? ` · ${document.shapes[document.selectedShapesIds[0]].name}` : ''}`;
    const editable =
        frame && isFrameVisible(document, frame.id) && !isFrameLocked(document, frame.id);
    const placement = !frame
        ? undefined
        : frame.kind === 'view'
          ? "Center of the view, kept inside its Screen. Optional x/y are relative to the Screen's top-left; stack layout controls placement where applicable. Edits update the shared Screen layout."
          : 'Frame center. Optional x/y are relative to its top-left; stack layout controls placement where applicable.';

    const layout = frame?.kind === 'view' ? viewLayoutRoot(document, frame) : frame;
    const targetKey = [
        document.id,
        frame?.id,
        layout?.id,
        state.events.pointer.screenView?.viewId,
        ...document.selectedShapesIds
    ].join(':');

    const selectedShapes = document.selectedShapesIds.map((id) => document.shapes[id]);
    const bindingProperties = frame
        ? FRAME_NUMBER_KEYS.filter((key) => {
              const target = ['gap', 'padding'].includes(key) ? layout : frame;

              const value = target ? frameNumber(target, key) : undefined;

              return target && value !== undefined && acceptsFrameNumber(target, key, value);
          }).map((key) => ({ key, label: parameterLabel(key), kind: 'number' }))
        : SHAPE_PROPERTIES.filter(
              (property) =>
                  SHAPE_BINDING_KEYS.includes(property.key) &&
                  selectedShapes.length > 0 &&
                  selectedShapes.every(
                      (shape) =>
                          property.read(shape, document) !== undefined &&
                          canEditProperty(property, shape, document)
                  )
          ).map(({ key, label, kind }) => ({ key, label, kind }));
    const colorProperties = SHAPE_PROPERTIES.filter(({ key }) => ['fill', 'stroke'].includes(key));
    // Text color lives in Edit text, so offer colors only where fill or stroke applies.
    const colorable = selectedShapes.every((shape) =>
        colorProperties.some(
            (property) =>
                shape &&
                property.read(shape, document) !== undefined &&
                canEditProperty(property, shape, document)
        )
    );
    const edits = EDIT_ACTIONS.filter((item) =>
        frame
            ? !['edit radius', 'edit colors', 'edit text'].includes(item.id)
            : item.id !== 'edit stack'
    ).map((item) => ({
        ...item,
        icon: { component: GUIDED_ICONS[item.id], size: 18 },
        enabled:
            canEdit &&
            Boolean(frame || document.selectedShapesIds.length) &&
            (item.id !== 'edit stack' || Boolean(layout?.stack)) &&
            (item.id !== 'edit text' || selectedShapes.every((shape) => shape.type === 'text')) &&
            (item.id !== 'edit colors' || colorable) &&
            (!['bind variable', 'unbind variable'].includes(item.id) ||
                bindingProperties.length > 0),
        unavailable:
            item.id === 'edit stack' && frame && !layout?.stack
                ? frame.kind === 'view'
                    ? 'Its active layout has no stack. Choose Row or Column in the Inspector first.'
                    : 'This frame has no stack. Choose Row or Column in the Inspector first.'
                : item.id === 'edit colors' && !frame && selectedShapes.length && !colorable
                  ? 'Some selected shapes have no fill or stroke. Text color is in Edit text.'
                  : undefined,
        description:
            item.id === 'edit stack' && frame?.kind === 'view'
                ? 'Edit the active shared layout; resize the view separately'
                : item.description
    }));

    return (
        <CommandLine
            historyKey={document.id}
            bindingProperties={bindingProperties}
            variables={Object.values(document.variables).map(({ id, name, type }) => ({
                id,
                name,
                type
            }))}
            onSubmit={submit}
            onClose={() => actions.ui.toggleControlVisibility('commandLine')}
            context={`${selection}${frame && !editable ? ' · Selection is locked or hidden' : ''}`}
            placement={placement}
            targetKey={targetKey}
            stackContext={
                frame?.kind === 'view' && layout
                    ? `${layout.name} · Shared stack · affects every view using this layout`
                    : undefined
            }
            selectionHelp={
                frame
                    ? frame.kind === 'view'
                        ? VIEW_SELECTION_HELP
                        : FRAME_SELECTION_HELP
                    : document.selectedShapesIds.length > 0
                      ? state.events.pointer.screenView
                          ? `${SELECTION_HELP} ${SHARED_ARTWORK_HELP}`
                          : SELECTION_HELP
                      : undefined
            }
            suggestions={[
                ...edits,
                ...CREATIONS.map((command) => ({
                    ...command,
                    icon: { component: GUIDED_ICONS[command.id], size: 18 },
                    enabled: canCreate
                })),
                ...getTools().map((tool) => ({
                    id: `${tool.name} tool`,
                    name: `${tool.name} tool`,
                    description: 'Activate drawing on the canvas',
                    icon: tool.icon,
                    shortcut: tool.shortcut,
                    enabled: canCreate
                })),
                ...commands
                    .filter(
                        (command) =>
                            !['rectangle', 'circle', 'text', 'open-command-line'].includes(
                                command.id
                            )
                    )
                    .map((command) => ({
                        id: command.id,
                        name: command.name,
                        icon: command.icon,
                        shortcut: command.shortcut,
                        description: command.description ?? '',
                        enabled: enabled[commands.indexOf(command)]
                    }))
            ]}
            onAskAi={state.ai === 'available' && canEdit ? askAi : undefined}
        />
    );
};

export default ActiveCommandLine;
