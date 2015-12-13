var Vec2 = require('./vec2');
var C = require('./constants');

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var tileTypes = C.TILES;

/**
 * @typedef {object} TileEventsOptions
 * @property {string} tile - one of "powerup", "bomb", or "boost"
 *   indicating the type of tile to track.
 * @property {TagProMap} map - the TagPro map
 * @property {Socket} socket - the socket.io socket for the game.
 */
/**
 * Contains information about a tile event, whether the tile is
 * present or absent, and its location.
 * @typedef {object} TileEventInfo
 * @property {boolean} state - true for present, false for absent
 * @property {Vec2} location - the x, y location in the map for the
 *   tile in question.
 */
/**
 * @callback TileEventCallback
 * @param {TileEventInfo} info - the information about the tile.
 */
/**
 * Generate abstracted tile events for specific tile types, specified
 * in options.
 *
 * Event listeners are managed through event emitter interface, `on`,
 * `off`, etc. Events that can be listened to include:
 * * tile.update - a tile within view has been updated
 * * tile.enter - a tile has come into view
 * * tile.leave - a tile has left view
 * Events are passed object of type TileEventInfo with event information.
 */
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

/**
 * Get array of string ids for tiles in view.
 * @return {Array.<string>} - the tiles in view.
 */
TileEvents.prototype.getInView = function() {
  return this.in_view.slice();
};

// Check if given tile id corresponds to tile type to be tracked.
// @private
TileEvents.prototype.isType = function(v) {
  return this.tile.id.indexOf(Math.floor(v)) !== -1;
};

// Check whether given tile id indicates tile is "active".
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
