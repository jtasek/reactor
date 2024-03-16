import React, { FC } from 'react';
import { Layout, MenuBar } from 'src/ui/components';

export const Documents: FC = () => (
    <Layout>
        <MenuBar />
        <h1 style={{ color: 'black' }}>Documents</h1>
    </Layout>
);
