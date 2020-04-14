export const startDragging = ({ actions, state }, args) => {
  state.events.pointer.dragging = true;
  actions.setInitialPosition(args.coords);
  actions.setPosition(args.coords);
  actions.updatePath(args.coords);
};
