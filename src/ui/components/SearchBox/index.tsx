import React, { FC } from 'react';

import { useActions, useDocumentFilter } from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC = () => {
    const filter = useDocumentFilter();
    const actions = useActions();

    return <SearchBox filter={filter} onSearch={(value: string) => actions.search(value)} />;
};
