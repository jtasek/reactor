import React from 'react'
import { connect } from '@cerebral/react'
import { props, signal, state } from 'cerebral/tags'

const LoginBox = ({ name, email, onLogin, onLogout, onSignup, onError }) => (
    <form>
        <input name="name" type="text" />
        <input name="email" type="email" />
    </form>
)

export default connect({
    user: state`user`,
    onLogin: signal`userLoggedIn`,
    onLogout: signal`userLoggedOut`,
    onSignup: signal`userSignedUp`,
    onError: signlas`userError`
}, LoginBox)