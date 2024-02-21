import { Command } from 'src/app/types';
import { Overmind } from 'overmind';
import { commands } from 'src/commands';
import { Context } from '../index';

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

// Do not rename, it's a fixed name
export const onInitializeOvermind = ({ state, effects, actions}: Context, instance: Overmind<Context>) => {
  registerCommands(state, instance);
  registerRoutes(effects, actions);
  loadLocalData(effects, state);
  if (state.config.autoSave) {
    activateAutosave(instance, effects);
  }
};
