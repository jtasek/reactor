import {ApplicationState, IApplicationState} from '../src/core'
import * as chai from 'chai'

let should = chai.should()

let state = null

describe('Application State', () => {
  before(function() {
    // runs before all tests in this block
    state = new ApplicationState()
  })

  it('should not be null', () => {
    should.exist(state)
  })

  it('activeCommand should be null', () => {
    should.not.exist(state.activeCommand)
  })

  it('isDragging should be false', () => {
    state.isDragging.should.be.equal(false)
  })

  it('isEditable should be true', () => {
    state.isEditable.should.be.equal(true)
  })

  it('selection should be null', () => {
    should.not.exist(state.selection)
  })

  it('workspaces should exist', () => {
    should.exist(state.workspaces)
  })
})