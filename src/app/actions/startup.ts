import type { Command } from 'src/app/types';
import type { Context } from '../index';
import { Overmind } from 'overmind';
import {
    DeleteCommand,
    CloneCommand,
    MoveCommand,
    GroupCommand,
    UngroupCommand,
    LayerCommand,
    UnlayerCommand,
    ZoomInCommand,
    ZoomOutCommand,
    ZoomResetCommand
} from 'src/commands';

import {
    CircleCommand,
    EllipseCommand,
    ImageCommand,
    LineCommand,
    PenCommand,
    RectCommand,
    SelectCommand,
    TextCommand
} from 'src/tools';

const commands: Record<string, Command> = {};
export function registerCommand(command: Command) {
    if (!commands[command.id]) {
        commands[command.id] = command;
    }
}

export function getCommands() {
    return commands;
}

export function getCommand(commandId: string) {
    return commands[commandId];
}

function registerCommands(state, instance) {
    console.log('register commands');

    registerCommand(CircleCommand);
    registerCommand(EllipseCommand);
    registerCommand(ImageCommand);
    registerCommand(LineCommand);
    registerCommand(PenCommand);
    registerCommand(RectCommand);
    registerCommand(SelectCommand);
    registerCommand(TextCommand);

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
    registerRoutes(effects, actions);
    loadLocalData(effects, state);
    if (state.config.autoSave) {
        activateAutosave(instance, effects);
    }
};
