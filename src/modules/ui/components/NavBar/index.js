import React, { Component, PropTypes } from 'react'
import { connect } from '@cerebral/react'
import { props, signal, state } from 'cerebral/tags'
//import { DragSource } from 'react-dnd'
import styles from './styles.css'
import filteredShapes from '../../../app/computed/filteredShapes'
import filteredGroups from '../../../app/computed/filteredGroups'
import filteredLayers from '../../../app/computed/filteredLayers'
import filteredLinks from '../../../app/computed/filteredLinks'
import filteredRulers from '../../../app/computed/filteredRulers'
import shapeDragSource from './shapeDragSource'

// @DragSource('shape', shapeDragSource, (connect, monitor) => ({
//   // Call this function inside render()
//   // to let React DnD handle the drag events:
//   connectDragSource: connect.dragSource(),
//   // You can ask the monitor about the current drag state:
//   isDragging: monitor.isDragging()
// }))
const NavBarItem = connect({
  shape: state`workspace.${props`name`}.${props`item`}`
}, ({ /*isDragging, connectDragSource,*/ shape, handler }) => (
  /* connectDragSource(*/
  <li className={styles.active}><a onClick={() => handler({ id: shape.id })}>{shape.name}</a></li>
)
)

const NavBarList = ({ name, items, handler }) => (
  <li>{name}
    <ul>
      {items.map(item => <NavBarItem key={item} name={name} item={item} handler={handler} />)}
    </ul>
  </li>
)

const NavBar = ({ shapes, filter, groups, layers, links, rulers, shapeSelectionChanged, visible }) => (
  <ul className={styles.navBar} style={!visible ? { display: 'none' } : { display: 'block' }}>
    <NavBarList key="shapes" name="shapes" items={shapes} handler={shapeSelectionChanged} />
    <NavBarList key="groups" name="groups" items={groups} />
    <NavBarList key="layers" name="layers" items={layers} />
    <NavBarList key="links" name="links" items={links} />
    <NavBarList key="rulers" name="rulers" items={rulers} />
  </ul>
)

export default connect({
  filter: state`workspace.filter`,
  visible: state`ui.controls.navbar.visible`,
  shapes: filteredShapes,
  groups: filteredGroups,
  layers: filteredLayers,
  links: filteredLinks,
  rulers: filteredRulers,
  shapeSelectionChanged: signal`ui.shapeSelectionChanged`
}, NavBar)