export const updatePath = ({ state }, args) => {
  state.events.pointer.path.push(args.coords);
};
