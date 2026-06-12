import React, { FC } from 'react';
import { Provider } from 'overmind-react';
import { Shell } from './app/components/Shell';
import { config } from './app';
import { createOvermind } from 'overmind';
import { createRoot } from 'react-dom/client';

const overmind = createOvermind(config, {
    devtools: process.env.NODE_ENV !== 'production'
});

const App: FC = () => (
    <Provider value={overmind}>
        <Shell />
    </Provider>
);

const container = document.getElementById('app');
const root = createRoot(container!);
root.render(<App />);
