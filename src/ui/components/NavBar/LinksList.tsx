import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useCurrentDocument, useLink } from 'src/app/hooks';

const LinkListItem = ({ linkId }) => {
  const link = useLink(linkId);
  const { toggleLinkSelected } = useActions();

  return (
    <NavBarListItem
      key={linkId}
      id={linkId}
      name={link.name}
      selected={link.selected}
      onClick={toggleLinkSelected}
    />
  );
};

export const LinksList = () => {
  const { linksIds } = useCurrentDocument();

  if (linksIds?.length === 0) {
    return null;
  }

  return (
    <NavBarList name="Links">
      {linksIds.map((linkId) => (
        <LinkListItem key={linkId} linkId={linkId} />
      ))}
    </NavBarList>
  );
};
