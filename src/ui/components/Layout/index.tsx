import React from 'react';

import CommandLine from '../CommandLine';
import ContextMenu from '../ContextMenu';
import ControlPanel from '../ControlPanel';
import Cursor from '../Cursor';
import Dialog from '../Dialog';
import DataView from '../DataView';
import Explorer from '../Explorer';
import GroupPanel from '../GroupPanel';
import LayerPanel from '../LayerPanel';
import MenuBar from '../MenuBar';
import Minimap from '../Minimap';
import NavBar from '../NavBar';
import Overlay from '../Overlay';
import PropertyPanel from '../PropertyPanel';
import SearchBox from '../SearchBox';
import SideBar from '../SideBar';
import StatusBar from '../StatusBar';
import Surface from '../Surface';
import Switch from '../Switch';
import ToolBar from '../ToolBar';
import DocumentInfo from '../DocumentInfo';
import styles from './styles.css';

export const Layout = () => (
  <div className={styles.layout}>
    <MenuBar
      actions={[
        { id: 1, name: 'Home' },
        { id: 2, name: 'About' },
        { id: 4, name: 'Contact' }
      ]}
    />
    <CommandLine />
    <Switch value={true} />
    <SideBar>
      <ToolBar />
      <Explorer>
        <SearchBox />
        <NavBar />
      </Explorer>
    </SideBar>
    <Surface />
    <ContextMenu />
    <Minimap visible />
    <DataView />
    <DocumentInfo />
    <ControlPanel />
    <PropertyPanel />
    <LayerPanel />
    <GroupPanel />

    {/* <Cursor /> */}
    {/* <Dialog
      id="modalDialog"
      visible={true}
      title={'Tohle je modalni dialog'}
      content={'Nejake kecicky....'}
      onCancel={() => alert('cancel')}
      onSubmit={() => alert('submit')}
    /> */}
    <StatusBar />
  </div>
);
