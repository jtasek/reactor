import React, { Component } from 'react'

import CommandLine from '../CommandLine'
import ContextMenu from '../ContextMenu'
import ControlPanel from '../ControlPanel'
import Cursor from '../Cursor'
import Dialog from '../Dialog'
import DataView from '../DataView'
import Explorer from '../Explorer'
import GroupPanel from '../GroupPanel'
import LayerPanel from '../LayerPanel'
import MenuBar from '../MenuBar'
import MinimapPanel from '../MinimapPanel'
import NavBar from '../NavBar'
import Overlay from '../Overlay'
import PropertyPanel from '../PropertyPanel'
import SearchBox from '../SearchBox'
import SideBar from '../SideBar'
import StatusBar from '../StatusBar'
import Surface from '../Surface'
import Switch from '../Switch'
import ToolBar from '../ToolBar'
import WorkspaceInfo from '../WorkspaceInfo'
import styles from './styles.css'

export default () => (
  <div className={styles.layout}>
    <MenuBar
      id="menubar"
      actions={[
        { id: 1, name: 'Home' },
        { id: 2, name: 'About' },
        { id: 4, name: 'Contact' }
      ]}
    />
    <CommandLine id="commandline" />
    <Switch value={true} />
    <SideBar id="sidebar">
      <ToolBar id="toolbar" />
      <Explorer>
        <SearchBox />
        <NavBar />
      </Explorer>
    </SideBar>
    <Surface key="surface" />
    <ContextMenu id="contextMenu" />
    <MinimapPanel id="minimapPanel" />
    <DataView id="dataview" />
    <WorkspaceInfo id="workspaceInfo" />
    <ControlPanel id="controlPanel" />
    <PropertyPanel id="propertyPanel" />
    <LayerPanel id="layerPanel" />
    <GroupPanel id="groupPanel" />

    {/* <Cursor /> */}
    {/* <Dialog
      id="modalDialog"
      visible={true}
      title={'Tohle je modalni dialog'}
      content={'Nejake kecicky....'}
      onCancel={() => alert('cancel')}
      onSubmit={() => alert('submit')}
    /> */}
    <StatusBar id="statusbar" />
  </div>
)
