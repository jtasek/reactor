import {Workspace, IWorkspace} from '../src/core'


let workspace = null

describe('Workspace', () => {
  before(() => {
    // runs before all tests in this block
    workspace = new Workspace()
  })

  it('should not be null', () => {
    should.exist(workspace)
  })

  it('should have a grid', () => {
    should.exist(workspace.grid)
  })

  it('should have a collection of layers', () => {
    should.exist(workspace.layers)
  })

  it('should have a collection of links', () => {
    should.exist(workspace.links)
  })

  it('should have a collection of rulers', () => {
    should.exist(workspace.rulers)
  })

  it('should have a collection of shapes', () => {
    should.exist(workspace.shapes)
  })
})