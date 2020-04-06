import { Action } from 'overmind';

export const registerRoutes: Action = ({ actions, effects }) => {
  effects.router.initialize({
    '/': () => actions.changeFilter('all'),
    '/login': () => actions.login(),
    '/reset': () => actions.reset(),
    '/signup': () => actions.singup(),
    '/logout': () => actions.logour(),
    '/terms': () => actions.terms(),
    '/privacy': () => actions.privacy(),
    '/export': () => actions.export(),
    '/import': () => actions.import(),
    '/about': () => actions.about()
  });
};
