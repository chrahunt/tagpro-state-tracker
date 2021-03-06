var Solver = require('./solver');
var TileEvents = require('./tile-events');
var Vec2 = require('./vec2');
var C = require('./constants');

module.exports = PowerupTracker;

// Interface that takes in source information and puts it into solver format.
// Must be initialized with socket prior to "map" and "time" events in initialization.
function PowerupTracker(socket) {
  var self = this;
  this.socket = socket;
  this.empty = false;
  this.seen = {};

  // handle mapupdate, tile tracking
  // Listen for player powerup grabs.
  socket.on('p', function (event) {
    // Just in case, but solver should be initialized prior to any p message.
    if (!self.hasOwnProperty("solver")) return;
    var updates = event.u || event;
    var time = Date.now();
    updates.forEach(function (update) {
      var id = update.id;
      // skip first update.
      if (self.seen[id]) {
        if (update['s-powerups']) {
          if (tagpro.players[id] && tagpro.players[id].draw) {
            // Player is visible, get powerup tile and send observation.
            var position = new Vec2(tagpro.players[id].x, tagpro.players[id].y);
            var found = false;
            for (var i = 0; i < self.powerup_locations.length; i++) {
              var powerup = self.powerup_locations[i];
              // TODO: More specific powerup finding location.
              if (position.dist(powerup) < 40) {
                var variable = self.powerups[i].toString();
                self.solver.addObservation(variable, "absent", time);
                found = true;
                break;
              }
            }
            if (!found) {
              console.error("Couldn't find adjacent powerup!");
            }
          } else if (tagpro.players[id]) {
            // Player not visible, send information.
            console.log("Sending powerup notification.");
            self.solver.addNotification(time);
          }
        }
      } else {
        self.seen[id] = true;
      }
    });
  });

  this.powerups = [];
  this.powerup_locations = [];

  if (tagpro.map || tagpro.gameEndsAt || tagpro.id) {
    console.warn("Post-initialization start, %o:%o:%o", tagpro.map, tagpro.state, tagpro.id);
    this._onMap({
      tiles: tagpro.map
    });
    if (tagpro.state === 1 && tagpro.gameEndsAt === null) {
      socket.on("time", this._onTime.bind(this));
    } else if (tagpro.state !== 1 && tagpro.gameEndsAt === null) {
      console.error("Game ended.");
    } else {
      this._onState(tagpro.state, tagpro.gameEndsAt - Date.now());
    }
  } else {
    // Do map-related initializations.
    socket.on('map', this._onMap.bind(this));

    // Updates the state of the game, occurs almost immediately after `map` message.
    socket.on("time", this._onTime.bind(this));
  }
}

PowerupTracker.prototype._onMap = function(map) {
  // Actual map values.
  map = map.tiles;
  this.map = map;
  var self = this;

  var present = [];
  // Get powerup tiles.
  map.forEach(function (row, x) {
    row.forEach(function (tile, y) {
      if (Math.floor(tile) !== 6) return;
      var powerup = new Vec2(x, y);
      self.powerups.push(powerup);
      present.push(tile == 6);
      self.powerup_locations.push(powerup.c().mulc(C.TILE_WIDTH));
    });
  });

  // Initialize solver to unknown state.
  // Game not started, assume map is true representation of powerup state.
  var variables = this.powerups.map(function (powerup, i) {
    return {
      name: powerup.toString(),
      present: present[i]
    };
  });

  this.solver = new Solver(variables, {
    debug: true
  });
};

PowerupTracker.prototype._onState = function(state, time) {
  if (state === 3 && time > 2000) {
    // Game not started and game start not close enough to be less
    // than socket timeout, then assume map is true representation
    // of powerup state.
    var variables = this.powerups.map(function (powerup, i) {
      return powerup.toString();
    });

    this.solver.setObserved(variables);
    var self = this;
    variables.forEach(function (variable) {
      self.solver.addObservation(variable, "present");
    });
    this.solver.setObserved([]);
  } else if (state === 1) {
    // Game active, don't trust map data. Let tile events naturally
    // figure out values.
    console.warn("Post game-start initialization not supported.");
  }
};

PowerupTracker.prototype._onTime = function(info) {
  console.log("Got game state: %d", info.state);
  this.socket.off("time", this._onTime);

  this._onState(info.state, info.time);
};

/**
 * Start the powerup tracker, initializes the tile-tracking subsystem.
 * Must be started after id and player information are available, after player has been determined to be playing.
 * And after solver initialization.
 */
PowerupTracker.prototype.start = function() {
  console.log("Initializing tile events.");
  this.tile_events = new TileEvents({
    tile: "powerup",
    map: this.map,
    socket: this.socket
  });

  var self = this;
  this.tile_events.on("tile.enter", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
    // Delay and assert fact to rule out states.
    /*setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);*/
    setTimeout(function () {
      var state = info.state ? "present"
                             : "absent";
      var id = info.location.toString();
      //console.log("Observed %s: %s", id, state);
      self.solver.addObservation(id, state);
    }, 50);
  });

  this.tile_events.on("tile.leave", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
  });

  this.tile_events.on("tile.update", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
    /*setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);*/
    setTimeout(function () {
      var state = info.state ? "present"
                             : "absent";
      var id = info.location.toString();
      //console.log("Observed %s: %s", id, state);
      self.solver.addObservation(info.location.toString(), state);
    }, 50);
  });
};

PowerupTracker.prototype.getTiles = function() {
  var state = this.solver.getState();
  if (state === null && !this.empty) {
    this.empty = true;
    console.warn("Empty states.");
    return null;
  } else if (state === null && this.empty) {
    return null;
  } else if (state !== null && this.empty) {
    console.log("States re-created.");
    this.empty = false;
  }
  var powerups = [];
  // todo: variable spawn time.
  var respawn = 60e3;
  for (var variable in state) {
    var loc = Vec2.fromString(variable);
    var powerup = state[variable];
    // need x, y, content
    var content;
    if (powerup.state === "present") {
      content = "!";
    } else {
      if (Array.isArray(powerup.time)) {
        content = "?";
      } else {
        var respawn_time = powerup.time && powerup.time - Date.now();
        if (respawn_time && respawn_time > 0) {
          content = (respawn_time / 1e3).toFixed(1);
        } else {
          content = "?";
        }
      }
    }
    // if visible, then no content.
    // variable for content or not setting?
    powerups.push({
      x: loc.x * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      y: loc.y * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      content: content,
      hideOverlay: powerup.state === "present"
    });
  }
  return powerups;
};
