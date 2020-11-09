import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Badge, Props } from './Badge';

export default {
  title: 'Example/Badge',
  component: Badge
} as Meta;

const Template: Story<Props> = (args) => <Badge {...args} />;

export const Small = Template.bind({});
Small.args = {
  text: '1',
  color: 'red',
  size: 15
};

export const Medium = Template.bind({});
Medium.args = {
  text: '1',
  color: 'red',
  size: 20
};

export const Large = Template.bind({});
Large.args = {
  text: '1',
  color: 'red',
  size: 25
};
