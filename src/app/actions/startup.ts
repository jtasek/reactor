import type { Command } from 'src/app/types';
import type { Context } from '../index';
import { Overmind } from 'overmind';
import {
    CloneCommand,
    DeleteCommand,
    GroupCommand,
    LayerCommand,
    MoveCommand,
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
    PenTool,
    RectTool,
    SelectTool,
    TextTool
} from 'src/tools';

import { Tool } from '../../tools/types';

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

function registerCommands(state, instance) {
    console.log('register commands');

    registerCommand(DeleteCommand);
    registerCommand(CloneCommand);
    registerCommand(MoveCommand);
    registerCommand(GroupCommand);
    registerCommand(UngroupCommand);
    registerCommand(LayerCommand);
    registerCommand(UnlayerCommand);
    registerCommand(ZoomInCommand);
    registerCommand(ZoomOutCommand);
    registerCommand(ZoomResetCommand);
}

function registerTools(state, instance) {
    console.log('register tools');

    registerTool(CircleTool);
    registerTool(EllipseTool);
    registerTool(ImageTool);
    registerTool(LineTool);
    registerTool(PenTool);
    registerTool(RectTool);
    registerTool(SelectTool);
    registerTool(TextTool);
}

function loadLocalData(effects, state) {
    const savedApp = effects.loadState('reactor');
    if (savedApp) {
        state.documents = savedApp.documents;
    }
}

function activateAutosave(instance, effects) {
    console.log('Autosave is on');

    instance.reaction(
        (state) => state.currentDocument,
        (document) => effects.saveState('reactor', document),
        { nested: true }
    );
}

function registerRoutes(effects, actions) {
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
