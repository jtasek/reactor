import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { GroupPanel, Props } from './GroupPanel';
import { createGroup } from 'src/app/factories';

export default {
  title: 'Example/GroupPanel',
  component: GroupPanel
} as Meta;

const Template: Story<Props> = (args) => <GroupPanel {...args} />;

export const Default = Template.bind({});
Default.args = {
  groups: [createGroup(), createGroup(), createGroup()]
};
