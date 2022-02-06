import React, { FC } from 'react';

import {
  CommandLine,
  ContextMenu,
  ControlPanel,
  Cursor,
  DataView,
  Dialog,
  DocumentInfo,
  Explorer,
  GroupPanel,
  LayerPanel,
  MenuBar,
  Minimap,
  NavBar,
  PropertyPanel,
  SearchBox,
  SideBar,
  StatusBar,
  Surface,
  Switch,
  ToolBar,
  Layout
} from 'src/ui/components';

export const Designer: FC = () => (
  <Layout>
    <MenuBar />
    <CommandLine />
    <Switch value={true} onChange={() => console.log('Testing switch')} />
    <SideBar>
      <ToolBar />
      <Explorer>
        <SearchBox />
        <NavBar />
      </Explorer>
    </SideBar>
    <Surface />
    <ContextMenu />
    <Minimap />
    <DataView />
    <DocumentInfo />
    <ControlPanel />
    <PropertyPanel />
    <LayerPanel />
    <GroupPanel />

    {/* <Cursor /> */}
    {/* <Dialog
        description="Description"
        visible={true}
        title={'Tohle je modalni dialog'}
        // onCancel={() => alert('cancel')}
        //  onSubmit={() => alert('submit')}
      >
        <p>Nejake kecicky....</p>
      </Dialog> */}
    <StatusBar />
  </Layout>
);