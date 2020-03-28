import React from 'react';
import styles from './styles.css';
import Icon from '../Icon';

const ToolBarButton = ({ tool, onClickHandler }) => (
  <li
    className={styles.toolBarButton}
    style={tool.active ? { opacity: '1' } : {}}
  >
    <a href="#" onClick={e => onClickHandler()} title={tool.description}>
      <Icon {...tool.icon} />
    </a>
  </li>
);

const ToolBar = ({ visible, tools, toolActivated }) => (
  <ul
    className={styles.toolBar}
    style={!visible ? { display: 'none' } : { display: 'flex' }}
  >
    {Object.keys(tools).map((name, index) => (
      <ToolBarButton
        key={index}
        tool={tools[name]}
        onClickHandler={() => toolActivated({ name: name })}
      />
    ))}
  </ul>
);

export default connect(
  {
    visible: state`ui.controls.toolbar.visible`,
    tools: state`tools`,
    toolActivated: signal`tools.toolActivated`
  },
  ToolBar
);
