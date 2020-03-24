import React from 'react'
import { connect } from '@cerebral/react'
import { props, sequences, state } from 'cerebral'

const LoginBox = ({ name, email, onLogin, onLogout, onSignup, onError }) => (
  <form>
    <input name="name" type="text" />
    <input name="email" type="email" />
  </form>
)

export default connect(
  {
    user: state`user`,
    onLogin: sequences`userLoggedIn`,
    onLogout: sequences`userLoggedOut`,
    onSignup: sequences`userSignedUp`,
    onError: signlas`userError`
  },
  LoginBox
)
