import {v4} from 'uuid'

export default ({props, state}) => {
    const workspace = state.get(`workspaces.${props.id}`)
    workspace.id = v4()

    state.push(`workspaces.${workspace.id}`, workspace)

    output({ id: workspace.id })
}