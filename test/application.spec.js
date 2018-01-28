import { Application, IApplication } from '../src/modules/app/'

let app = null

describe('Application', () => {
  before(() => {
    // runs before all tests in this block
    app = new Application('test')
  })

  after(() => {
    // runs after all tests in this block
  })

  beforeEach(() => {
    // runs before each test in this block
  })

  afterEach(() => {
    // runs after each test in this block
  })

  it('should not be null', () => {
    should.exist(app)
  })

  it('should have a collection of registered commands', () => {
    should.exist(app.commands)
  })

  it('should have a configuration', () => {
    should.exist(app.config)
  })

  it('should have a future collection of future application states', () => {
    should.exist(app.future)
  })

  it('should have a history collection of previous application states', () => {
    should.exist(app.history)
  })

  it('should have a name "Test application"', () => {
    app.name = 'Test application'
    app.name.should.be.equal('Test application')
  })

  it('should have a collection of registered packages', () => {
    should.exist(app.packages)
  })

  it('should have a current state', () => {
    should.exist(app.state)
  })
})
