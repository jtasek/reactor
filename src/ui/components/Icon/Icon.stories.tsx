import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Icon, Props } from '.';

export default {
  title: 'Example/Icon',
  component: Icon
} as Meta;

const Template: Story<Props> = (args) => <Icon {...args} />;

export const Default = Template.bind({});
Default.args = {
  group: 'action',
  name: 'visibility',
  color: 'rgba(255,255,255)',
  size: 16
};
