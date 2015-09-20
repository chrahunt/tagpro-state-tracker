var Solver = require('./solver');
var TileEvents = require('./tile-events');
var Vec2 = require('./vec2');

var TILE_WIDTH = 40;

// Interface that takes in source information and puts it into solver format.
function PowerupTracker() {
  var self = this;
  // handle mapupdate, tile tracking
  // Listen for player powerup grabs.
  tagpro.socket.on('p', function (event) {
    var updates = event.u || event;
    var time = Date.now();
    updates.forEach(function (update) {
      if (update['s-powerups']) {
        var id = update.id;
        if (tagpro.players[id].draw) {
          // Player is visible, get powerup tile and send observation.
          var position = new Vec2(tagpro.players[id].x, tagpro.players[id].y);
          var found = false;
          for (var i = 0; i < self.powerup_locations.length; i++) {
            var powerup = self.powerup_locations[i];
            // TODO: More specific powerup finding location.
            if (position.dist(powerup) < 40) {
              self.solver.addObservation({
                time: time,
                state: false,
                variable: self.powerups[i].toString()
              });
              found = true;
              break;
            }
          }
          if (!found) {
            console.warn("Couldn't find adjacent powerup!");
          }
        } else {
          // Player not visible, send information.
          self.solver.addHypothesis({
            state: false,
            time: time
          });
        }
      }
    });
  });

  this.tile_events = new TileEvents("powerup");
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

  this.powerups = [];
  this.powerup_locations = [];
  tagpro.map.forEach(function (row, x) {
    row.forEach(function (tile, y) {
      if (Math.floor(tile) !== 6) return;
      var powerup = new Vec2(x, y);
      self.powerups.push(powerup);
      self.powerup_locations.push(powerup.mulc(TILE_WIDTH, true));
    });
  });

  var variables = self.powerups.map(function (powerup) {
    return powerup.toString();
  });
  this.solver = new Solver(variables);
}
module.exports = PowerupTracker;

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
