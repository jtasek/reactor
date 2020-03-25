
import App from 'cerebral'
// system modules
import Devtools from 'cerebral/devtools'

const app = App(app, {
  devtools:
    process.env.NODE_ENV === 'production'
      ? null
      : Devtools({
          host: 'localhost:8585',
          reconnect: false
        })
})

export default app
