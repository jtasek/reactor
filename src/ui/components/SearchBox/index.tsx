import React, { FC } from 'react';

import { useActions, useControls, useDocumentFilter } from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC = () => {
    const { searchBox } = useControls();
    const filter = useDocumentFilter();
    const actions = useActions();

    if (!searchBox.visible) {
        return null;
    }

    return <SearchBox filter={filter} onSearch={(value: string) => actions.search(value)} />;
};
