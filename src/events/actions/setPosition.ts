export const setPosition = ({ state }, args) => {
  state.events.pointer.position = args.coords;
};
