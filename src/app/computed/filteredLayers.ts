export const filteredLayers = ({ currentDocument: { filter }, layers }) => {
  return Object.keys(layers).filter(key => {
    const layer = layers[key];

    return layer.name?.includes(filter);
  });
};
