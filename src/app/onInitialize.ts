import { OnInitialize } from 'overmind';

export const onInitialize: OnInitialize = ({ state, actions, effects }, instance) => {
  // Register commands

  // Load data from storage
  const savedApp = effects.loadState('reactor');
  if (savedApp) {
    state.documents = savedApp.documents;
  }

  // Activate autosave
  instance.reaction(
    (state) => state,
    (state) => effects.saveState('reactor', state),
    { nested: true }
  );

  // Activate routing
  effects.registerRouters({
    '/': () => actions.showHomePage(),
    '/about': () => actions.aboutPage(),
    '/export': () => actions.exportPage(),
    '/import': () => actions.importPage(),
    '/login': () => actions.showLoginPage(),
    '/logout': () => actions.showLogoutPage(),
    '/privacy': () => actions.privacyPage(),
    '/reset': () => actions.showResetPage(),
    '/signup': () => actions.showSingupPage(),
    '/terms': () => actions.showTermsPage()
  });
};

export default onInitialize;
