import React, { FC } from 'react';
import { DocumentList, Layout, MenuBar } from 'src/ui/components';
import { MoveDocuments } from 'src/ui/components/MoveDocuments';

export const Documents: FC = () => (
    <Layout>
        <MenuBar />
        <DocumentList />
        <MoveDocuments />
    </Layout>
);
