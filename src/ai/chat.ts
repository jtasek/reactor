import type { BatchResult, OperationsCheck } from 'src/app/operations';
import type { ProposedOperation } from './operations';
import { propose, type ProposalResult, type Send } from './client';

export type Proposal = Extract<ProposalResult, { kind: 'proposed' }>;

export interface ChatTurn {
    id: number;
    prompt: string;
    status: 'proposing' | 'proposed' | 'accepted' | 'discarded' | 'cancelled' | 'failed';
    operations: ProposedOperation[];
    messages: string[];
    proposal?: Proposal;
    problem?: string;
    repairing?: string;
}

interface ChatState {
    draft: string;
    turns: ChatTurn[];
    problem?: string;
}

const sessions = new Map<string, Chat>();

/** A local conversation, never saved or shared. It survives moving its panel between docks. */
export class Chat {
    private state: ChatState = { draft: '', turns: [] };
    private listeners = new Set<() => void>();
    private request?: AbortController;
    private nextId = 0;
    private readers = 0;
    private documentId: string;

    constructor(documentId: string) {
        this.documentId = documentId;
    }

    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    };

    /** Docking remounts the panel in the same commit; closing leaves no reader and aborts it. */
    retain = (onClose?: () => void) => {
        this.readers++;

        return () => {
            this.readers--;
            queueMicrotask(() => {
                if (this.readers === 0) {
                    this.request?.abort();
                    if (sessions.get(this.documentId) === this) {
                        sessions.delete(this.documentId);
                    }
                    onClose?.();
                }
            });
        };
    };

    private publish(state: ChatState) {
        this.state = state;
        this.listeners.forEach((listener) => listener());
    }

    private update(id: number, change: (turn: ChatTurn) => ChatTurn) {
        this.publish({
            ...this.state,
            turns: this.state.turns.map((turn) => (turn.id === id ? change(turn) : turn))
        });
    }

    setDraft = (draft: string) => this.publish({ ...this.state, draft, problem: undefined });
    setProblem = (problem: string) => this.publish({ ...this.state, problem });

    async send({
        context,
        check,
        send
    }: {
        context: object;
        check: (operations: ProposedOperation[]) => OperationsCheck;
        send?: Send;
    }) {
        const prompt = this.state.draft.trim();
        const last = this.state.turns.at(-1);

        if (!prompt || last?.status === 'proposing' || last?.status === 'proposed') {
            return;
        }
        const controller = new AbortController();
        const id = ++this.nextId;

        this.request = controller;
        this.publish({
            draft: '',
            turns: [
                ...this.state.turns,
                {
                    id,
                    prompt,
                    status: 'proposing',
                    operations: [],
                    messages: []
                }
            ]
        });
        const result = await propose({
            send,
            documentId: this.documentId,
            request: { task: 'edit', prompt, context },
            check,
            signal: controller.signal,
            onEvent: (event) =>
                this.update(id, (turn) => {
                    if (turn.status !== 'proposing') {
                        return turn;
                    }
                    switch (event.type) {
                        case 'operation':
                            return { ...turn, operations: [...turn.operations, event.operation] };
                        case 'message':
                            return { ...turn, messages: [...turn.messages, event.text] };
                        case 'repairing':
                            return { ...turn, operations: [], repairing: event.problem };
                    }
                })
        });

        if (controller.signal.aborted) {
            return;
        }
        this.request = undefined;
        if (result.kind === 'proposed') {
            this.update(id, (turn) => ({
                ...turn,
                status: 'proposed',
                proposal: result,
                operations: result.operations,
                repairing: undefined
            }));
        } else if (result.kind === 'failed') {
            this.update(id, (turn) => ({ ...turn, status: 'failed', problem: result.problem }));
            this.setDraft(prompt);
        }
    }

    stop = () => {
        this.request?.abort();
        this.request = undefined;
        const last = this.state.turns.at(-1);

        if (last?.status === 'proposing') {
            this.update(last.id, (turn) => ({ ...turn, status: 'cancelled' }));
            this.setDraft(last.prompt);
        }
    };

    discard = () => {
        const last = this.state.turns.at(-1);

        if (last?.status === 'proposed') {
            this.update(last.id, (turn) => ({ ...turn, status: 'discarded', proposal: undefined }));
            this.setDraft(last.prompt);
        }
    };

    accept = (apply: (proposal: Proposal) => BatchResult) => {
        const last = this.state.turns.at(-1);

        if (last?.status !== 'proposed' || !last.proposal) {
            return;
        }
        const result = apply(last.proposal);

        this.update(last.id, (turn) =>
            result.applied
                ? { ...turn, status: 'accepted', proposal: undefined }
                : { ...turn, status: 'failed', problem: result.problem, proposal: undefined }
        );
        if (!result.applied) {
            this.setDraft(last.prompt);
        }
    };

    clear = () => {
        this.request?.abort();
        this.request = undefined;
        this.publish({ draft: '', turns: [] });
    };
}

export const chatFor = (documentId: string) => {
    let chat = sessions.get(documentId);

    if (!chat) {
        chat = new Chat(documentId);
        sessions.set(documentId, chat);
    }

    return chat;
};
