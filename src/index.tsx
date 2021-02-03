import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';

import { config } from './app';

const overmind = createOvermind(config, {
  devtools: true
});

// render(
//   <Provider value={overmind}>
//     <App />
//   </Provider>,
//   document.getElementById('app')
// );

export async function init(): Promise<void> {
  const { App } = await import('./app/components/App');
  render(
    <AppContainer>
      <Provider value={overmind}>
        <App />
      </Provider>
    </AppContainer>,
    document.getElementById('app')
  );
}

init();

if (module.hot) {
  module.hot.accept('./app/components/App', () => requestAnimationFrame(() => init()));
}
