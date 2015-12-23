var Vec2 = require('./vec2');
var C = require('./constants');

function dim(arr, i) {
  if (i === 0) {
    return arr.length;
  } else if (i === 1) {
    return arr[0].length;
  }
}

module.exports = T;
function T(map) {
  var points = [];
  points.push({
    x: 0, y: 0
  });
  points.push({
    x: map.length * C.TILE_WIDTH, y: 0
  });
  points.push({
    x: map.length * C.TILE_WIDTH, y: map[0].length * C.TILE_WIDTH
  });
  points.push({
    x: 0, y: map[0].length * C.TILE_WIDTH
  });
  this.points = points.map(function (o) {
    o.indicator = true;
    o.content = ":)";
    o.x += C.TILE_WIDTH / 2;
    o.y += C.TILE_WIDTH / 2;
    return o;
  });
}

T.prototype.getTiles = function(first_argument) {
  return this.points;
};
