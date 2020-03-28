import {createGroup} from '../app/factories'

export default ({props, state}) => {
    const group = createGroup(props)

    state.push(`workspace.groups.${group.id}`, group)

    output({ id: group.id })
}