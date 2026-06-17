import type { Command } from 'src/app/types';
import type { Context } from '../index';
import { Overmind } from 'overmind';
import {
    CloneCommand,
    DeleteCommand,
    GroupCommand,
    LayerCommand,
    MoveCommand,
    PanCommand,
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
import { debounce } from '../utils';
import {
    PERSISTENCE_KEY,
    migratePersistedState,
    serializePersistedState
} from '../services/persistence';

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

function registerCommands(state: Context['state'], instance: Overmind<Context>) {
    console.log('register commands');

    registerCommand(DeleteCommand);
    registerCommand(CloneCommand);
    registerCommand(MoveCommand);
    registerCommand(PanCommand);
    registerCommand(GroupCommand);
    registerCommand(UngroupCommand);
    registerCommand(LayerCommand);
    registerCommand(UnlayerCommand);
    registerCommand(ZoomInCommand);
    registerCommand(ZoomOutCommand);
    registerCommand(ZoomResetCommand);
}

function registerTools(state: Context['state'], instance: Overmind<Context>) {
    console.log('register tools');

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

function loadLocalData(effects: Context['effects'], state: Context['state']) {
    const persisted = migratePersistedState(effects.loadState(PERSISTENCE_KEY));

    if (persisted) {
        state.documents = persisted.documents;
        state.currentDocumentId = persisted.currentDocumentId;
    }
}

const AUTOSAVE_DELAY_MS = 500;

function activateAutosave(instance: Overmind<Context>, effects: Context['effects']) {
    console.log('Autosave is on');

    const save = debounce(
        () => effects.saveState(PERSISTENCE_KEY, serializePersistedState(instance.state)),
        AUTOSAVE_DELAY_MS
    );

    instance.reaction((state) => state.currentDocument, save, { nested: true });
}

function registerRoutes(effects: Context['effects'], actions: Context['actions']) {
    effects.initializeRoutes({
        '/': actions.showDesigner,
        '/documents': actions.showDocuments
    });
}

/**  Do not rename, it's a mandatory action name! */
export const onInitializeOvermind = (
    { state, effects, actions }: Context,
    instance: Overmind<Context>
) => {
    registerCommands(state, instance);
    registerTools(state, instance);
    registerRoutes(effects, actions);

    loadLocalData(effects, state);

    if (state.config.autoSave) {
        activateAutosave(instance, effects);
    }
};
