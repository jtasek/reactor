import React, {FC } from 'react';
import styles from './styles.css';
import Icon from '../Icon';
import { useApp } from '../../../app';

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

const ToolBar = ({ tools, action }) => (
  <ul    className={styles.toolBar}  >
    {Object.keys(tools).map((name, index) => (
      <ToolBarButton
        key={index}
        tool={tools[name]}
        onClickHandler={() => action({ name: name })}
      />
    ))}
  </ul>
);

export default () => {
  const {actions = {activateTool},state = {tools}} = useApp();

  return  <ToolBar action={activateTool} tools={tools} />
);
