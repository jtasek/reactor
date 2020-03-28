export const filteredLinks = ({ currentDocument: { filter }, links }) => {
  return Object.keys(links).filter(key => {
    const link = links[key];

    return link.name?.includes(filter);
  });
};
