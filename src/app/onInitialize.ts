export const onInitialize = ({ state, actions, effects }, instance) => {
  state.todos = effects.storage.getTodos();

  instance.reaction(
    ({ todos }) => todos,
    todos => effects.storage.saveTodos(todos),
    { nested: true }
  );

  effects.router.initialize({
    '/': () => actions.changeFilter('all'),
    '/active': () => actions.changeFilter('active'),
    '/completed': () => actions.changeFilter('completed')
  });
};
