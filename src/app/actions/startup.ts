import type { Command } from 'src/app/types';
import type { Context } from '../index';
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
import { startAutosave } from '../services/autosave';
import {
    SCHEMA_VERSION,
    PERSISTENCE_KEY,
    migratePersistedState,
    restoreDocuments
} from '../services/documentStorage';

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

function loadLocalData({ effects, state, actions }: Context): boolean {
    try {
        const raw = effects.loadState(PERSISTENCE_KEY);

        if (raw === undefined) {
            return true;
        }

        const persisted = migratePersistedState(raw);

        if (!persisted) {
            effects.backupState(PERSISTENCE_KEY);
            actions.displayError(
                'Saved data could not be loaded. The original is preserved; autosave is disabled for this session.'
            );

            return false;
        }

        if (
            typeof raw === 'object' &&
            raw !== null &&
            'version' in raw &&
            raw.version !== SCHEMA_VERSION
        ) {
            effects.backupState(PERSISTENCE_KEY);
        }

        state.documents = restoreDocuments(persisted);
        state.currentDocumentId = persisted.currentDocumentId;

        return true;
    } catch {
        actions.displayError(
            'Saved data could not be read or backed up. The original is preserved; autosave is disabled for this session.'
        );

        return false;
    }
}

function registerRoutes(effects: Context['effects'], actions: Context['actions']) {
    effects.initializeRoutes({
        '/': actions.showDesigner,
        '/documents': actions.showDocuments
    });
}

/**  Do not rename, it's a mandatory action name! */
export const onInitializeOvermind = (
    context: Context,
    instance: Pick<Context, 'state' | 'reaction'>
) => {
    const { state, effects, actions } = context;

    registerCommands();
    registerTools();
    registerRoutes(effects, actions);

    const canSave = loadLocalData(context);

    if (canSave && state.config.autoSave) {
        startAutosave(instance, effects, actions.displayError);
    }
};
