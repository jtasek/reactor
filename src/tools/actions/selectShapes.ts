import {v4} from 'uuid';

export default ({props, state}) => {
    const ref = v4();

    const shape = state.get(`workspace.shapes.${props.id}`);

    state.push(`workspace.shapes.${ref}`, shape);

    output({ ref });
};