import { useCallback, useSyncExternalStore } from 'react';
import { chatFor } from 'src/ai/chat';
import type { Send } from 'src/ai/client';
import { ContextTooLarge, documentContext } from 'src/ai/context';
import { useActions, useAppState, useCurrentDocument, useSelectedShapesIds } from 'src/app/hooks';
import { useSelectedFrameId } from 'src/app/frameHooks';
import { authoringKeys } from 'src/app/screenAuthoring';
import { selectionIdentity } from '../selectionIdentity';

/** The local test model, loaded only when the chat uses it. */
const sendToLocalModel: Send = (path, body, signal) =>
    import('src/ai/localModel').then(({ localSend }) => localSend(path, body, signal));

/** What a request shares with AI, named for the chip next to the prompt. */
export interface ChatScope {
    label: string;
    title: string;
    whole: boolean;
}

function useScope(): ChatScope {
    const selected = useSelectedShapesIds();
    const selectedFrameId = useSelectedFrameId();
    const name = useAppState((state) => {
        const document = state.currentDocument;

        if (document.selectedFrameId) {
            return document.frames[document.selectedFrameId]?.name;
        }

        return document.selectedShapesIds.length > 0
            ? selectionIdentity(document)?.name
            : undefined;
    });

    if (selectedFrameId) {
        return {
            label: name ?? 'Selected frame',
            title: 'Shares the selected frame or page, its page’s designs and sizes, and the document’s variables and components.',
            whole: false
        };
    }
    if (selected.length > 0) {
        return {
            label: selected.length === 1 ? (name ?? '1 item') : `${selected.length} items`,
            title: 'Shares the selected items, their groups, owning frames and the variables and components they use.',
            whole: false
        };
    }

    return {
        label: 'Whole document',
        title: 'Shares this document. Select items first to share a smaller part.',
        whole: true
    };
}

/** The document's chat, shared by the chat panel and the canvas bar. */
export function useChat(documentId: string) {
    const document = useCurrentDocument();
    const { applyOperations, checkOperations } = useActions();
    const local = useAppState((state) => state.ai === 'local');
    const chat = chatFor(documentId);
    const { draft, turns, problem } = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
    const scope = useScope();
    const current = turns.at(-1);
    const pending = current?.status === 'proposing' || current?.status === 'proposed';

    const ask = () => {
        if (pending || !draft.trim()) {
            return false;
        }
        let context: ReturnType<typeof documentContext>;

        try {
            context = documentContext(document);
        } catch (error) {
            if (!(error instanceof ContextTooLarge)) {
                throw error;
            }
            chat.setProblem(error.message);

            return false;
        }
        void chat.send({
            context,
            reservedKeys: authoringKeys(document),
            send: local ? sendToLocalModel : undefined,
            check: (operations) => checkOperations({ documentId, operations })
        });

        return true;
    };
    const accept = useCallback(
        () =>
            chat.accept((proposal) =>
                applyOperations({
                    documentId,
                    by: { kind: 'ai', model: proposal.model, requestId: proposal.requestId },
                    operations: proposal.operations
                })
            ),
        [chat, applyOperations, documentId]
    );

    return { chat, draft, turns, problem, current, pending, local, scope, ask, accept };
}
