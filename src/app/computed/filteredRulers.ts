export const filteredRulers = ({ currentDocument: { filter }, rulers }) => {
  return Object.keys(rulers).filter(key => {
    const ruler = rulers[key];

    return ruler && ruler.name && ruler.name.includes(filter);
  });
};
