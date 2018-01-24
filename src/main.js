import React from 'react'
import controller from './controller'
import { AppContainer } from 'react-hot-loader'
import { Container } from '@cerebral/react'
import ReactDOM from 'react-dom'

const init = () => {
  const App = require('./components/App').default
  ReactDOM.render(
    <AppContainer>
      <Container controller={controller}>
        <App />
      </Container>
    </AppContainer>,
    document.querySelector('#app')
  )
}

init()

if (module.hot) {
  module.hot.accept('./components/App', () =>
    requestAnimationFrame(() => init())
  )
}