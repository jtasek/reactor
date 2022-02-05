import { OnInitialize } from 'src/app/types';

function registerCommands() {
  console.log('register commands');
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
  // registerCommands();
  registerRoutes(effects, actions);
  // loadLocalData(effects, state);
  activateAutosave(instance, effects);
};
