import { newid } from '../../app/factories';

export const addLine = ({ props, state }) => {
  const id = newid();

  const line = {
    id: id,
    name: `line-${id}`,
    description: 'This is shape no 1',
    start: {
      x: x1,
      y: y1
    },
    end: {
      x: x2,
      y: y2
    },
    locked: false,
    visible: true,
    selected: true,
    created: new Date(),
    createdBy: state.get('user.name'),
    modified: new Date(),
    modifiedBy: state.get('user.name')
  };

  state.push(`workspace.shapes.${id}`, line);

  output({ id });
};
