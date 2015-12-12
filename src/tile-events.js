var Vec2 = require('./vec2');
var C = require('./constants');

var EventEmitter = require('events').EventEmitter;
var util = require('util');

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
    inactive: [6],
    id: [6]
  },
  bomb: {
    active: [10],
    inactive: [10.1],
    id: [10]
  },
  boost: {
    active: [5, 14, 15],
    inactive: [5.1, 14.1, 15.1],
    id: [5, 14, 15]
  }
};

// Tile events can take a specific tile or a tile type, probably.
// Allows adding listener for tiles coming into view.
// Browser-specific.
// events put out are like n.enter, n.leave, n.update where n is floor of tile id you're interested in
// callback gets tile vec with x, y, and boolean for active
// default listens for boost, bomb, powerup.
// opts has keys socket, map, tile.
function TileEvents(opts) {
  EventEmitter.apply(this, arguments);
  var tile = opts.tile;
  var map = opts.map;
  var socket = opts.socket;

  this.tile = tileTypes[tile];
  var self = this;
  // Locations to listen for.
  this.tiles = [];
  this.in_view = [];
  this.checkInterval = 250;
  this.interval = setInterval(this._interval.bind(this), this.checkInterval);
  this.range = {
    x: 660,
    y: 420
  };
  map.forEach(function (row, x) {
    row.forEach(function (v, y) {
      if (self.isType(v)) {
        self.tiles.push(new Vec2(x, y));
      }
    });
  });

  // Listen for mapupdate.
  socket.on('mapupdate', function (updates) {
    if (!Array.isArray(updates)) {
      updates = [updates];
    }
    updates.forEach(function (event) {
      if (self.isType(event.v)) {
        var e = {
          location: new Vec2(event.x, event.y),
          state: self.isActive(event.v),
          time: Date.now()
        };
        self.emit("tile.update", e);
      }
    });
  });
}

util.inherits(TileEvents, EventEmitter);
module.exports = TileEvents;

TileEvents.prototype.getInView = function() {
  return this.in_view.slice();
};

// @private
TileEvents.prototype.isType = function(v) {
  return this.tile.id.indexOf(Math.floor(v)) !== -1;
};

// @private
TileEvents.prototype.isActive = function(v) {
  return this.tile.active.indexOf(v) !== -1;
};

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
    var diff = tile.c().mulc(C.TILE_WIDTH).sub(location).abs();
    var in_view = (diff.x < this.range.x && diff.y < this.range.y);
    var id = tile.toString();
    var already_in_view = self.in_view.indexOf(id) !== -1;
    if (in_view && !already_in_view) {
      self.in_view.push(id);
      enter.push(tile);
    } else if (!in_view && already_in_view) {
      leave.push(tile);
      var i = self.in_view.indexOf(id);
      self.in_view.splice(i, 1);
    }
  }, this);
  enter.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("tile.enter", {
      location: tile.clone(),
      state: self.isActive(val),
      time: time
    });
  });
  leave.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("tile.leave", {
      location: tile.clone(),
      state: self.isActive(val),
      time: time
    });
  });
};
