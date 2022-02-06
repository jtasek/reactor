import { derived } from 'overmind';
import { Application, Command } from 'src/app/types';

function registerCommands(state, instance) {
  console.log('register commands');

  state.commands = {
    'create-group': {
      id: 'create-group',
      name: 'Create group',
      description: 'Create group from selected shapes',
      icon: {
        group: 'action',
        name: 'plus',
        color: 'rgb(95, 216, 240)',
        size: 24
      },
      regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
      shortcut: 'ctrl+l',
      canExecute: derived((_, rootState: Application) => {
        return rootState.currentDocument?.selectedShapesIds?.length > 0;
      }),
      execute: () => {
        alert('Create group');
      }
    } as Command,
    'delete-group': {
      id: 'delete-group',
      name: 'Delete group',
      description: 'Delete selected group',
      icon: {
        group: 'action',
        name: 'minus',
        color: 'rgb(95, 216, 240)',
        size: 24
      },
      regex: /(?<toolCode>line)\((?<x1>\d+),(?<y1>\d+),(?<x2>\d+),(?<y2>\d+)\)/,
      shortcut: 'ctrl+l',
      canExecute: derived((_, rootState: Application) => {
        return rootState.currentDocument?.groupsIds.length > 0;
      }),
      execute: () => {
        alert('Delete group');
      }
    } as Command
  };
}

function loadLocalData(effects, state) {
  const savedApp = effects.loadState('reactor');
  if (savedApp) {
    state.documents = savedApp.documents;
  }
}

function activateAutosave(instance, effects) {
  instance.reaction(
    (state) => state.currentDocument,
    (state) => effects.saveState('reactor', state),
    { nested: true }
  );
}

function registerRoutes(effects, actions) {
  effects.initializeRoutes({
    '/': actions.showDesigner,
    '/documents': actions.showDocuments
  });
}

export const onInitializeOvermind: OnInitialize = ({ state, actions, effects }, instance) => {
  registerCommands(state, instance);
  registerRoutes(effects, actions);
  // loadLocalData(effects, state);
  activateAutosave(instance, effects);
};
