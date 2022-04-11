import React, { FC } from 'react';

import { useActions, useControls, useCurrentDocument } from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC = () => {
  const { searchBox } = useControls();
  const { filter } = useCurrentDocument();
  const actions = useActions();

  if (!searchBox.visible) {
    return null;
  }

  return <SearchBox filter={filter} onSearch={(value: string) => actions.search(value)} />;
};
