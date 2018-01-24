export default ({props, state, services}) => {
    //console.log(services)
    services.core.executeCommand(props.command)
}