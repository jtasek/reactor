export const onInitialize = ({ state, actions, effects }, instance) => {
  // Register controls
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
  effects.router.initialize({
    '/': () => actions.changeFilter('all'),
    '/active': () => actions.changeFilter('active'),
    '/completed': () => actions.changeFilter('completed')
  });
};
