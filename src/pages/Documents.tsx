import React, { FC } from 'react';
import { DocumentList } from 'src/ui/components';
import { MoveDocuments } from 'src/ui/components/MoveDocuments';

export const Documents: FC = () => (
    <div>
        <DocumentList />
        <MoveDocuments />
    </div>
);
