export const filteresShapes = ({ currentDocument: { filter }, shapes }) => {
  return Object.keys(shapes).filter(key => {
    const shape = shapes[key];

    return shape.name?.includes(filter);
  });
};
