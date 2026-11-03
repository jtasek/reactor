import React, { FC } from 'react';
import {
    useActions,
    useAppState,
    useCommands,
    useCommandsEnabled,
    useControls,
    useEffects
} from 'src/app/hooks';
import { takesEditorInput } from 'src/events/input';
import { screenViewName } from 'src/app/screenViews';
import { getTools } from 'src/app/actions/startup';
import { screenToWorld } from 'src/app/camera';
import { CommandLine } from './CommandLine';
import { creationTarget } from './creationTarget';
import { CREATIONS, CREATION_PATTERN, creationOperation } from './creation';

export const ConnectedCommandLine: FC = () => {
    const { commandLine } = useControls();

    return commandLine.visible ? <ActiveCommandLine /> : null;
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

            const target = creationTarget(state, center);
            const operation = creationOperation(input, target.center, target);

            if (!operation) {
                return actions.submitCommandLine(input);
            }

            if (!canCreate) {
                return 'Creation is unavailable. Return to an editable canvas and finish the current gesture.';
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
        : `${document.selectedShapesIds.length} selected`;

    return (
        <CommandLine
            onSubmit={submit}
            onClose={() => actions.ui.toggleControlVisibility('commandLine')}
            context={`${selection} · New shapes ${frame ? 'inside this container' : 'on canvas'}`}
            placement={
                frame
                    ? 'Container center. Optional x/y are relative to its top-left; stack layout controls placement where applicable. Screen view edits update the shared layout.'
                    : undefined
            }
            suggestions={[
                ...getTools().map((tool) => ({
                    id: `${tool.name} tool`,
                    name: `${tool.name} tool`,
                    description: 'Activate drawing on the canvas',
                    enabled: canCreate
                })),
                ...CREATIONS.map((command) => ({ ...command, enabled: canCreate })),
                ...commands
                    .filter((command) => !['rectangle', 'circle', 'text'].includes(command.id))
                    .map((command) => ({
                        id: command.id,
                        name: command.name,
                        description: command.description ?? '',
                        enabled: enabled[commands.indexOf(command)]
                    }))
            ]}
            onAskAi={state.ai === 'available' && canEdit ? askAi : undefined}
        />
    );
};

export default ConnectedCommandLine;
