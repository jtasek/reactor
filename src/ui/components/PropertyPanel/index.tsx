import React, { Component } from 'react';

import { getPropValue } from 'src/app/utils';
import styles from './styles.css';

function getCommonProperties(shapes: Array<Shape>) {
  if (!shapes || shapes.length == 0) return { empty: true };

  if (shapes.length == 1) return shapes[0];

  let properties = Object.keys(shapes[0]);
  let result = [];
  let value = 'value';

  properties.forEach(property => {
    if (shapes.filter(shape => shape[property]).length == shapes.length) {
      result[property] = value;
    }
  });

  return result;
}

function intersect(arrays: Array<Array<string>>) {
  var result = arrays.shift().reduce(function(res, v) {
    if (
      res.indexOf(v) === -1 &&
      arrays.every(function(a) {
        return a.indexOf(v) !== -1;
      })
    )
      res.push(v);
    return res;
  }, []);

  return result;
}

const PropertyPanelItem = ({ name, value }) => (
  <tr>
    <td>{name}: </td>
    <td>{value}</td>
  </tr>
);

const PropertyGroupItem = ({ name, children }) => (
  <tr>
    <td>{name}</td>
    <td>
      <table>
        <tbody>{children}</tbody>
      </table>
    </td>
  </tr>
);

const PropertyList = ({ isroot: boolean, name, value }) => {
  if (typeof value === 'object') {
    return (
      <PropertyGroupItem key={name} name={name}>
        {Object.keys(value).map(key => (
          <PropertyList key={key} name={key} value={value[key]} />
        ))}
      </PropertyGroupItem>
    );
  } else {
    return (
      <PropertyPanelItem key={name} name={name} value={getPropValue(value)} />
    );
  }
};

const PropertyPanel = ({ visible, shapes }) => (
  <table
    className={styles.propertyPanel}
    style={!visible ? { display: 'none' } : { display: 'block' }}
  >
    <tbody>
      <PropertyList
        key="properties"
        name="properties"
        value={getCommonProperties(shapes)}
      />
    </tbody>
    <tfoot>
      <tr>
        <td>Selected: </td>
        <td>{shapes.length}</td>
      </tr>
    </tfoot>
  </table>
);

export default connect(
  {
    visible: state`ui.controls.propertypanel.visible`,
    shapes: selectedShapes,
    controlVisibilityChanged: signal`ui.controlVisibilityChanged`
  },
  PropertyPanel
);
