var Solver = require('./solver');
var TileEvents = require('./tile-events');
var Vec2 = require('./vec2');

var TILE_WIDTH = 40;

// Interface that takes in source information and puts it into solver format.
// Must be initialized with socket prior to "map" and "time" events in initialization.
function PowerupTracker(socket) {
  var self = this;
  this.socket = socket;

  // handle mapupdate, tile tracking
  // Listen for player powerup grabs.
  socket.on('p', function (event) {
    // Just in case, but solver should be initialized prior to any p message.
    if (!self.hasOwnProperty("solver")) return;
    var updates = event.u || event;
    var time = Date.now();
    updates.forEach(function (update) {
      if (update['s-powerups']) {
        var id = update.id;
        if (tagpro.players[id] && tagpro.players[id].draw) {
          // Player is visible, get powerup tile and send observation.
          var position = new Vec2(tagpro.players[id].x, tagpro.players[id].y);
          var found = false;
          for (var i = 0; i < self.powerup_locations.length; i++) {
            var powerup = self.powerup_locations[i];
            // TODO: More specific powerup finding location.
            if (position.dist(powerup) < 40) {
              var variable = self.powerups[i].toString();
              self.solver.addObservation(variable, false, time);
              found = true;
              break;
            }
          }
          if (!found) {
            console.error("Couldn't find adjacent powerup!");
          }
        } else if (tagpro.players[id]) {
          // Player not visible, send information.
          self.solver.addNotification({
            state: false,
            time: time
          });
        }
      }
    });
  });

  this.powerups = [];
  this.powerup_locations = [];

  if (tagpro.map || tagpro.state || tagpro.id) {
    // Delayed start, not supported.
    throw new Error("Delayed start is not supported.");
  } else {
    // Do map-related initializations.
    socket.on('map', function (map) {
      // Actual map values.
      map = map.tiles;
      self.map = map;

      var present = [];
      // Get powerup tiles.
      map.forEach(function (row, x) {
        row.forEach(function (tile, y) {
          if (Math.floor(tile) !== 6) return;
          var powerup = new Vec2(x, y);
          self.powerups.push(powerup);
          present.push(tile == 6);
          self.powerup_locations.push(powerup.mulc(TILE_WIDTH, true));
        });
      });

      // Initialize solver to unknown state.
      // Game not started, assume map is true representation of powerup state.
      var variables = self.powerups.map(function (powerup, i) {
        return {
          name: powerup.toString(),
          present: present[i]
        };
      });

      self.solver = new Solver(variables);
    });

    // Updates the state of the game, occurs almost immediately after `map` message.
    socket.on("time", function (info) {
      var state = info.state;
      if (state === 3 && info.time > 2000) {
        // Game not started and game start not close enough to be less
        // than socket timeout, then assume map is true representation
        // of powerup state.
        var variables = self.powerups.map(function (powerup, i) {
          return powerup.toString();
        });

        self.solver.setObserved(variables);
        variables.forEach(function (variable) {
          self.solver.addObservation(variable, true);
        });
      } else if (state === 1) {
        // Game active, don't trust map data. Let tile events naturally
        // figure out values.
        console.error("Post game-start initialization not supported.");
      }
    });
  }
}
module.exports = PowerupTracker;

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
    setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);
  });

  this.tile_events.on("tile.leave", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
  });

  this.tile_events.on("tile.update", function (info) {
    setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);
  });
};

// TODO: Initialization and state management in case solver goes crazy.

PowerupTracker.prototype.getPowerups = function() {
  var state = this.solver.getState();
  var in_view = this.tile_events.getInView();
  var powerups = [];
  for (var variable in state) {
    powerups.push({
      id: variable,
      location: Vec2.fromString(variable),
      visible: this.tile_events.in_view.indexOf(variable) !== -1,
      state: state[variable].state,
      time: state[variable].time
    });
  }
  return powerups;
};

/**
 * Check whether there are powerup tiles adjacent to the given tile.
 * @param {object} loc - Object with x and y properties corresponding
 *   to array location to look around.
 * @return {boolean} - Whether or not any adjacent tiles are powerups.
 */
PowerupTracker.prototype.adjacentPowerup = function(loc) {
  var offsets = [-1, 0, 1];
  var x = loc.x;
  var y = loc.y;
  for (var i = 0; i < offsets.length; i++) {
    for (var j = 0; j < offsets.length; j++) {
      var thisX = x + offsets[i],
          thisY = y + offsets[j];
      if ((thisX < 0 || thisX > this.map.length - 1) ||
        (thisY < 0 || thisY > this.map.length - 1) ||
        (thisX === x && thisY === y)) {
        continue;
      } else if (Math.floor(this.map[thisX][thisY]) == 6) {
        return true;
      }
    }
  }
  return false;
};
