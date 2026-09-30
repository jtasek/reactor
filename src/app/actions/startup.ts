import type { Command } from 'src/app/types';
import type { Context } from '../index';
import {
    CloneCommand,
    DeleteCommand,
    GroupCommand,
    LayerCommand,
    UngroupCommand,
    UnlayerCommand,
    ZoomInCommand,
    ZoomOutCommand,
    ZoomResetCommand
} from 'src/commands';

import {
    CircleTool,
    EllipseTool,
    ImageTool,
    LineTool,
    MoveTool,
    PenTool,
    RectTool,
    SelectTool,
    TextTool
} from 'src/tools';

import { Tool } from '../../tools/types';
import { startDocumentSync } from '../services/documentSync';
import { listenToMutations } from '../services/mutations';
import { ownerOf, readAccount } from '../services/accounts';

const commands: Record<string, Command> = {};
const tools: Record<string, Tool> = {};

export function registerCommand(command: Command) {
    if (!commands[command.id]) {
        commands[command.id] = command;
    }
}

export function getCommands(): Command[] {
    return Object.values(commands);
}

export function getCommand(commandId: string) {
    return commands[commandId];
}

export function registerTool(tool: Tool) {
    if (!tools[tool.id]) {
        tools[tool.id] = tool;
    }
}

export function getTools(): Tool[] {
    return Object.values(tools);
}

export function getTool(toolId: string) {
    return tools[toolId];
}

function registerCommands() {
    registerCommand(DeleteCommand);
    registerCommand(CloneCommand);
    registerCommand(GroupCommand);
    registerCommand(UngroupCommand);
    registerCommand(LayerCommand);
    registerCommand(UnlayerCommand);
    registerCommand(ZoomInCommand);
    registerCommand(ZoomOutCommand);
    registerCommand(ZoomResetCommand);
}

function registerTools() {
    registerTool(CircleTool);
    registerTool(EllipseTool);
    registerTool(ImageTool);
    registerTool(LineTool);
    registerTool(MoveTool);
    registerTool(PenTool);
    registerTool(RectTool);
    registerTool(SelectTool);
    registerTool(TextTool);
}

function registerRoutes(effects: Context['effects'], actions: Context['actions']) {
    effects.initializeRoutes({
        '/': actions.showDesigner,
        '/documents': actions.showDocuments,
        '/account': actions.showAccount
    });
}

/**  Do not rename, it's a mandatory action name! */
export const onInitializeOvermind = async (
    context: Context,
    instance: Pick<Context, 'state' | 'actions' | 'addMutationListener'>
) => {
    const { state, effects, actions } = context;
    const addMutationListener = listenToMutations(instance);

    registerCommands();
    registerTools();
    registerRoutes(effects, actions);

    // The documents opened last open while the account is read; the first time, and
    // after signing in or out, the account is read first, as it decides whose open.
    // It is shown with them: a change while the pages first render can miss
    // components that have not subscribed yet.
    const reading = readAccount(effects.accounts);
    const owner = effects.lastOwner() ?? ownerOf(await reading);

    try {
        await startDocumentSync(
            context,
            { state: instance.state, actions: instance.actions, addMutationListener },
            owner
        );
    } catch {
        actions.displayError('Saved documents could not be loaded. Reload the page to try again.');
        actions.setSaveStatus({
            kind: 'notSaving',
            reason: 'Saved documents could not be loaded.'
        });
    } finally {
        state.account = await reading;
        state.loading = false;
    }

    const current = ownerOf(state.account, owner);

    // Signed in or out elsewhere, as by an emailed link, since these documents opened.
    if (effects.shareOwner(current, effects.reloadPage) && current !== owner) {
        effects.reloadPage();

        return;
    }

    // Once startup has ended; an action run while it runs counts as part of it.
    setTimeout(instance.actions.noticeLocalDocuments);
    addMutationListener(({ path, delimiter }) => {
        const [root, documentId, field] = path.split(delimiter);

        // A document was added or removed; checked once the action ends.
        if (root === 'documents' && documentId !== undefined && field === undefined) {
            queueMicrotask(instance.actions.noticeLocalDocuments);
        }
    });
};
