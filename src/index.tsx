import React from 'react';
import { render } from 'react-dom';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import { Shell } from './app/components/Shell';
import { config } from './app';

const overmind = createOvermind(config, {
  devtools: true
});

render(
  <Provider value={overmind}>
    <Shell />
  </Provider>,
  document.getElementById('app')
);

// export async function init(): Promise<void> {
//   const { App } = await import('./app/components/App');
//   render(
//     // <AppContainer>
//     <Provider value={overmind}>
//       <App />
//     </Provider>,
//     // </AppContainer>,
//     document.getElementById('app')
//   );
// }

// init();

// if (module.hot) {
//   module.hot.accept('./app/components/App', () => init());
// }
