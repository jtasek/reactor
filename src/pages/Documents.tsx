import React, { FC } from 'react';
import { DocumentList, Layout, MenuBar } from 'src/ui/components';

export const Documents: FC = () => (
    <Layout>
        <MenuBar />
        <DocumentList />
    </Layout>
);
