// @flow
import { Controller } from 'cerebral'
import { set, debounce } from 'cerebral/operators'
import { state } from 'cerebral/tags'
// system modules
import Devtools from 'cerebral/devtools'
// application modules
import app from './modules/app'

const controller = Controller(app, {
  devtools:
    process.env.NODE_ENV === 'production'
      ? null
      : Devtools({
          host: 'localhost:8585',
          reconnect: false
        })
})

export default controller
