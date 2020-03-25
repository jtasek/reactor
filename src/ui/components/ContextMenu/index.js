
import React from 'react'
import { connect } from '@cerebral/react'
import { props, sequences, state } from 'cerebral'
import Icon from '../Icon'
import styles from './styles.css'
import regeneratorRuntime from 'regenerator-runtime'

function getInlineStyle(size: number, angle: number, active: boolean) {
  return {
    backgroundColor: `rgba(0, 0, 0, ${active ? 0.7 : 0.5})`,
    color: `hsl(${angle}, 100%, ${active ? '75%' : '100%'})`,
    // Rotate the axis
    // Move the item from the center
    // Rotate the item back to its default position
    transform: `rotate(${angle}deg) translate(${size /
      2.5}em) rotate(-${angle}deg)`
  }
}

function* angles(count: number) {
  let index = 0
  let rotation = 0
  const angle = 360 / count

  while (index < count) {
    index++
    yield (rotation += angle)
  }
}

function renderButtons(tools, onClickHandler) {
  const count = Object.keys(tools).length
  const anglegen = angles(count)

  return Object.keys(tools).map((name, index) => {
    let angle = anglegen.next().value
    let tool = tools[name]
    let style = getInlineStyle(15, angle, tool.active)

    return (
      <ContextMenuButton
        key={index}
        tool={tool}
        inlineStyles={style}
        onClickHandler={() => onClickHandler({ name: name })}
      />
    )
  })
}

const ContextMenuButton = ({ tool, inlineStyles, onClickHandler }) => (
  <li className={styles.contextMenuButton} style={inlineStyles}>
    <a
      href="#"
      onClick={e => {
        e.preventDefault()
        onClickHandler()
      }}
      title={tool.description}
    >
      <Icon {...tool.icon} />
    </a>
  </li>
)

const ContextMenu = ({ visible, position, tools, toolActivated }) => (
  <ul
    className={styles.contextMenu}
    style={
      !visible
        ? { display: 'none' }
        : {
            display: 'block',
            position: 'absolute',
            top: position.y,
            left: position.x
          }
    }
  >
    {renderButtons(tools, toolActivated)}
  </ul>
)

export default connect(
  {
    visible: state`ui.controls.contextmenu.visible`,
    position: state`ui.controls.contextmenu.position`,
    tools: state`tools`,
    toolActivated: sequences`tools.toolActivated`
  },
  ContextMenu
)
