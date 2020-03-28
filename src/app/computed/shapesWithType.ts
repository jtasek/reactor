export const shapesWithTypes = ({ shapes }) => {
  return Object.keys(shapes).map(key => {
    const shape = shapes[key];

    return {
      id: shape.id,
      type: shape.type
    };
  });
};
