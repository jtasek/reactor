export const onInitialize = ({ state, actions, effects }, instance) => {
  // Register commands

  // Load data from storage
  state.todos = effects.storage.getTodos();
  // Activate autosave
  instance.reaction(
    ({ todos }) => todos,
    (todos) => effects.storage.saveTodos(todos),
    { nested: true }
  );
  // Activate routing
  actions.registerRouters();
};
