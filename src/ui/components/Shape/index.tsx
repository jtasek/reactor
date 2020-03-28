import React, {Component, PropTypes} from 'react';
import {DragSource} from 'react-dnd';
import styles from './styles.css';
import collect from './collect';
import shapeSource from './shapeSource';

export default DragSource('shape', shapeSource, collect)(
    class ShapeX extends Component {
        onClick(event) {
            alert('click');
        }
        onDoubleClick(event) {
            alert('double click');
        }
        render() {
            // Your component receives its own props as usual
            const { id } = this.props;

            // These props are injected by React DnD,
            // as defined by your `collect` function above:
            const { isDragging, connectDragSource } = this.props;

            return connectDragSource(
                <rect className="shape" fill={this.props.color} stroke="grey" strokeWidth="2" x={this.props.shape.position.x} y={this.props.shape.position.y} width={this.props.shape.size.width} height={this.props.shape.size.height} onClick={this.onClick} onDoubleClick={this.onDoubleClick}>
                    <text>{this.props.shape.name}</text>
                </rect>
            );
        }
    }
);