import contextMenuDisplayed from '../core/signals/contextMenuDisplayed'
import controlVisibilityChanged from '../core/signals/controlVisibilityChanged'
import displayStatusMessage from '../core/signals/displayStatusMessage'
import groupVisibilityChanged from '../core/signals/groupVisibilityChanged'
import layerVisibilityChanged from '../core/signals/layerVisibilityChanged'
import shapeSelectionChanged from '../core/signals/shapeSelectionChanged'
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