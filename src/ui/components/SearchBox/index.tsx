import React, { FC } from 'react';

import { useActions, useAppState} from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC = () => {
  const state = useAppState();
  const actions= useActions();

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
