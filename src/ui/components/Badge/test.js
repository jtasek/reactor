import React from 'react';
import Badge from './index';
import renderer from 'react-test-renderer';

describe('<Badge />', () => {
  it('should render without crashing', () => {
    const component = renderer.create(<Badge />);
    const tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
