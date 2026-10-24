import React, { FC } from 'react';

import { useActions, useDocumentFilter } from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC<{ label?: string }> = ({ label }) => {
    const filter = useDocumentFilter();
    const actions = useActions();

    return (
        <SearchBox
            label={label}
            filter={filter}
            onSearch={(value: string) => actions.search(value)}
        />
    );
};
