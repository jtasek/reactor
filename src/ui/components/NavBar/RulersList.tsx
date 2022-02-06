import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useRuler } from 'src/app/hooks';

const RulerListItem = ({ rulerId }) => {
  const ruler = useRuler(rulerId);
  const { toggleRulerSelected } = useActions();

  return (
    <NavBarListItem
      key={rulerId}
      id={rulerId}
      name={ruler.name}
      selected={ruler.selected}
      onClick={toggleRulerSelected}
    />
  );
};

export const RulersList = () => {
  const { rulersIds } = useCurrentDocument();

  if (rulersIds?.length === 0) {
    return null;
  }

  return (
    <NavBarList name="Rulers">
      {rulersIds.map((rulerId) => (
        <RulerListItem key={rulerId} rulerId={rulerId} />
      ))}
    </NavBarList>
  );
};
