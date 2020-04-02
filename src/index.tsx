import React from 'react';
import { render } from 'react-dom';
// import { AppContainer } from 'react-hot-loader';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';

import { config } from './app';
import { Layout } from './ui/components/Layout';

const app = createOvermind(config, {
  devtools: true
});

render(
  <Provider value={app}>
    <Layout />
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
