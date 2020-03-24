// @flow
import contextMenuDisplayed from '../../app/signals/contextMenuDisplayed'
import controlVisibilityChanged from '../../app/signals/controlVisibilityChanged'
import displayStatusMessage from '../../app/signals/displayStatusMessage'
import groupVisibilityChanged from '../../app/signals/groupVisibilityChanged'
import layerVisibilityChanged from '../../app/signals/layerVisibilityChanged'
import shapeSelectionChanged from '../../app/signals/shapeSelectionChanged'
import state from './state'

export default {
  state: state,

  // Add signals
  signals: {
    contextMenuDisplayed,
    controlVisibilityChanged,
    groupVisibilityChanged,
    layerVisibilityChanged,
    shapeSelectionChanged,
    displayStatusMessage
  },

  // Add services
  services: {
    hello() {
      console.log('hello from service')
    }
  }
}
