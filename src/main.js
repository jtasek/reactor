import React from 'react'
import app from './controller'
import { AppContainer } from 'react-hot-loader'
import { Container } from '@cerebral/react'
import ReactDOM from 'react-dom'

const init = () => {
  const { App } = require('./components/App')
  ReactDOM.render(
    <AppContainer>
      <Container app={app}>
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
