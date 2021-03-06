var C = require('./constants');
var TileEvents = require('./tile-events');
var Compare = require('./compare');
var Vec2 = require('./vec2');

var compare = new Compare(0.1);

module.exports = SightTracker;
/**
 * opts type
 * respawn
 * map
 * socket
 * tile id
 */
// opts needs socket, map, tile type
// assuming bombs for now
function SightTracker(opts) {
  // get list of the tiles to be tracked
  var map = opts.map;
  var socket = opts.socket;
  var tile = opts.tile;
  this.state = {};
  this.respawn = C.RESPAWN[tile];
  var self = this;

  map.forEach(function (row, x) {
    row.forEach(function (v, y) {
      if (C.TILES[tile].id.indexOf(v) !== -1) {
        self.state[new Vec2(x, y).toString()] = {
          state: "present",
          time: null
        };
      }
    });
  });

  // TODO: general events, not bomb-specific.
  this.events = new TileEvents({
    tile: tile,
    map: map,
    socket: socket
  });

  this.events.on("tile.update", function (info) {
    // on mapupdate, if tile is in view then consider it good.
    var id = info.location.toString();
    if (info.state) {
      self.state[id].state = "present";
      self.state[id].time = null;
    } else {
      var in_view = self.events.getInView();
      if (in_view.indexOf(id) !== -1) {
        // in view, just taken
        self.state[id].state = "absent:known";
        self.state[id].time = Date.now();
      } else {
        // not in view, who knows
        self.state[id].state = "absent:unknown";
        self.state[id].time = Date.now();
      }
    }
  });

  // Check if an entering tile is correct, even if a mapupdate wasn't sent for it.
  this.events.on("tile.enter", function (info) {
    var id = info.location.toString();
    var last_state = self.state[id].state;
    var this_state = info.state ? "present"
                                : "absent";
    var now = Date.now();
    if (last_state === "present") {
      if (this_state === "present") {
        // tag: no change
      } else if (this_state === "absent") {
        // tag: weird
        // desc: wouldn't it have sent a mapupdate?
        console.warn("weird state");
      }
    } else if (last_state === "absent:known") {
      if (this_state === "present") {
        // tag: weird
        // desc: wouldn't it have sent a mapupdate?
      } else if (this_state === "absent") {
        // check if it could have respawned and been used again.
        if (compare.gt(now, self.state[id].time + self.respawn)) {
          // could have respawned
          self.state[id].state = "absent:unknown";
          self.state[id].time = now;
        } else {
          // did not respawn (known)
        }
      }
    } else if (last_state === "absent:unknown") {
      if (this_state === "present") {
        self.state[id].state = "present";
        self.state[id].time = null;
      } else if (this_state === "absent") {
        // check if relatively greater than respawn time
        if (compare.gt(now, self.state[id].time + self.respawn)) {
          // could have respawned
          self.state[id].state = "absent:unknown";
          self.state[id].time = now;
        } else {
          // may not have respawned (unknown)
        }
      }
    }
  });
}

SightTracker.prototype.getTiles = function() {
  var tiles = [];
  for (var variable in this.state) {
    var state = this.state[variable];
    var loc = Vec2.fromString(variable);
    var tile = {
      x: loc.x * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      y: loc.y * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      content: "",
      hideIndicator: true
    };

    if (state.state === "present") {
      tile.hideOverlay = true;
    } else {
      var respawn_time = state.time + this.respawn - Date.now();
      if (state.state === "absent:known") {
        tile.content = (respawn_time / 1e3).toFixed(1);
      } else if (state.state === "absent:unknown") {
        tile.content = "< " + (respawn_time / 1e3).toFixed(1);
      }
    }
    tiles.push(tile);
  }
  return tiles;
};
