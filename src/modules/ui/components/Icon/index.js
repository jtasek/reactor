import React from 'react'

const Icon = ({group, name, color, size}) => (
    <svg stroke={color} fill={color} height={size} width={size}>
    	<use xlinkHref={`/icons/svg-sprite-${group}-symbol.svg#ic_${name}_24px`} fill="currentColor" />
    </svg>
)

export default Icon