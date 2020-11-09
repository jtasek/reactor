import React, { FC } from 'react';

import { useApp } from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC = () => {
  const { actions, state } = useApp();

  if (!state.ui.searchBox.visible) {
    return null;
  }

  return (
    <SearchBox
      filter={state.currentDocument.filter}
      onSearch={(value: string) => actions.search(value)}
    />
  );
};
