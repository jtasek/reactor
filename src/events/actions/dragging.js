export const drag = ({ actions }, args) => {
  actions.setPosition(args.coords);
  actions.updatePath(args.coords);
};
