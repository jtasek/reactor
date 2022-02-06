import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useComponent } from 'src/app/hooks';

const ComponentListItem = ({ componentId }) => {
  const component = useComponent(componentId);
  const { toggleComponentSelected } = useActions();

  return (
    <NavBarListItem
      key={componentId}
      id={componentId}
      name={component.name}
      selected={component.selected}
      onClick={toggleComponentSelected}
    />
  );
};

export const ComponentsList = () => {
  const { componentsIds } = useCurrentDocument();

  if (componentsIds?.length === 0) {
    return null;
  }

  return (
    <NavBarList name="Components">
      {componentsIds.map((componentId) => (
        <ComponentListItem key={componentId} componentId={componentId} />
      ))}
    </NavBarList>
  );
};
