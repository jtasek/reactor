export const setInitialPosition = ({ state }, args) => {
  state.events.pointer.initialPosition = args.coords;
};
