import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Switch, Props } from './Switch';

export default {
  title: 'Example/Switch',
  component: Switch
} as Meta;

const Template: Story<Props> = (args) => <Switch {...args} />;

export const On = Template.bind({});
On.args = {
  value: true
};

export const Off = Template.bind({});
Off.args = {
  value: false
};
