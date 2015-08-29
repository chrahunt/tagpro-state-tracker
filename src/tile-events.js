var Vec2 = require('./vec2');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var TILE_WIDTH = 40;

var tileIds = [5, 6, 10, 14, 15];
var tileStrings = {
  5: "boost",
  6: "powerup",
  10: "bomb",
  14: "boost",
  15: "boost"
};

var tileTypes = {
  powerup: {
    active: [6.1, 6.2, 6.3, 6.4],
    inactive: [6]
  },
  bomb: {
    active: [10],
    inactive: [10.1]
  },
  boost: {
    active: [5, 14, 15],
    inactive: [5.1, 14.1, 15.1]
  }
};

// Tile events can take a specific tile or a tile type, probably.
// Allows adding listener for tiles coming into view.
// Browser-specific.
// events put out are like n.enter, n.leave, n.update where n is floor of tile id you're interested in
// callback gets tile vec with x, y, and boolean for active
// default listens for boost, bomb, powerup.
function TileEvents() {
  EventEmitter.apply(this, arguments);
  var self = this;
  // Types to listen for.
  this.tiles = [];
  this.listeners = {};
  this.in_view = [];
  this.checkInterval = 250;
  this.interval = setInterval(this._interval.bind(this), this.checkInterval);
  this.range = {
    x: 660,
    y: 420
  };
  tagpro.map.forEach(function (row, x) {
    row.forEach(function (v, y) {
      if (Math.floor(v) === 6) {
        self.tiles.push(new Vec2(x, y));
      }
    });
  });
  // only do pups now
  tagpro.socket.on('mapupdate', function (updates) {
    if (!Array.isArray(updates)) {
      updates = [updates];
    }
    updates.forEach(function (event) {
      if (Math.floor(event.v) === 6) {
        var e = {
          location: new Vec2(event.x, event.y),
          state: event.v !== 6,
          time: Date.now()
        };
        self.emit("powerup.update", e);
      }
    });
  });
}

util.inherits(TileEvents, EventEmitter);
module.exports = TileEvents;

// Get player location.
// @private
TileEvents.prototype.center = function() {
  return new Vec2(tagpro.players[tagpro.playerId].x,
    tagpro.players[tagpro.playerId].y);
};

// Function run in an interval.
// @private
TileEvents.prototype._interval = function() {
  var location = this.center();
  var enter = [];
  var leave = [];
  var self = this;
  var time = Date.now();
  this.tiles.forEach(function (tile) {
    var diff = tile.mulc(TILE_WIDTH, true).sub(location).abs();
    var in_view = (diff.x < this.range.x && diff.y < this.range.y);
    var id = tile.toString();
    var already_in_view = self.in_view.indexOf(id) !== -1;
    if (in_view && !already_in_view) {
      self.in_view.push(id);
      enter.push(tile.clone());
    } else if (!in_view && already_in_view) {
      leave.push(tile);
      var i = self.in_view.indexOf(id);
      self.in_view.splice(i, 1);
    }
  }, this);
  enter.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("powerup.enter", {
      location: tile,
      state: val !== 6,
      time: time
    });
  });
  leave.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("powerup.leave", {
      location: tile,
      state: val !== 6,
      time: time
    });
  });
};
