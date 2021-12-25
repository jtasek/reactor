import React, { FC } from 'react';

import { useActions, useState} from 'src/app/hooks';
import { SearchBox } from './SearchBox';

export const SearchBoxContainer: FC = () => {
  const state = useState();
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
