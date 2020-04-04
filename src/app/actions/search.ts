export const search = ({ state }, value) => {
  state.currentDocument.filter = value;
};
