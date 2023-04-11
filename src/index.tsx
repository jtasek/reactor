import React, { useEffect } from 'react';
import { render } from 'react-dom';
import { Provider } from 'overmind-react';
import { Shell } from './app/components/Shell';
import { config } from './app';
import { createOvermind } from 'overmind';

const overmind = createOvermind(config, {
  devtools: true
});

const App = () => (
  <Provider value={overmind}>
    <Shell />
  </Provider>
);

render(<App />, document.getElementById('app'));

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
