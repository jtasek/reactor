export const radius = ({ centre, initialPosition }) => {
  const a = centre.x - initialPosition.x;
  const b = centre.y - initialPosition.y;

  return Math.sqrt(a * a + b * b);
};
