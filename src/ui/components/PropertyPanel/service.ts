import { Shape } from '../../../app/types';

export function getCommonProperties(shapes: Shape[]): [string, any][] {
  if (!shapes || shapes.length == 0) {
    return [];
  }

  if (shapes.length === 1) {
    return Object.entries(shapes[0]);
  }

  const properties = Object.entries(shapes[0]);

  // TODO: Implement algo

  return properties;
}

// export function intersect(arrays: Array<Array<string>>): any[] {
//   const result = arrays.shift().reduce(function (res, v) {
//     if (
//       res.indexOf(v) === -1 &&
//       arrays.every(function (a) {
//         return a.indexOf(v) !== -1;
//       })
//     ) {
//       res.push(v);
//     }
//     return res;
//   }, []);

//   return result;
// }
