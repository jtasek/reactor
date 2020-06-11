import React from 'react';
import { render } from 'react-dom';
// import { AppContainer } from 'react-hot-loader';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';

import { config } from './app';
import { App } from './app/components/App';

const overmind = createOvermind(config, {
  devtools: true
});

render(
  <Provider value={overmind}>
    <App />
  </Provider>,
  document.getElementById('app')
);

// export const init = () => {
//   const { Layout } = require('./modules/ui/components/Layout');
//   render(
//     <AppContainer>
//       <Provider value={overmind}>
//         <Layout />
//         </Provider>
//     </AppContainer>,
//     document.getElementById('app');
//   );
// };

// init();

// if (module.hot) {
//   module.hot.accept('./modules/ui/components/Layout', () =>
//     requestAnimationFrame(() => init())
//   );
// }
