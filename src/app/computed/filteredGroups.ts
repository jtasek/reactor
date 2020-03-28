export const filteredGroups = ({ currentDocument: { filter }, groups }) => {
  return Object.keys(groups).filter(key => {
    const group = groups[key];

    return group.name?.includes(filter);
  });
};
