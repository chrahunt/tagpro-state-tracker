(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var PowerupTracker = require('./powerup-tracker');
var TagPro = require('./tagpro');

TagPro.on('user.playing', function () {
  var tracker = new PowerupTracker();
  
});

},{"./powerup-tracker":2,"./tagpro":4}],2:[function(require,module,exports){
var Solver = require('./solver');
var TileEvents = require('./tile-events');

module.exports = PowerupTracker;
// Interface that takes in source information and puts it into solver format.
function PowerupTracker() {
  var self = this;
  // handle mapupdate, tile tracking
  // Player listening
  this.socket.on('p', function (event) {
    var updates = event.u || event;
    updates.forEach(function (update) {
      if (update['s-powerups']) {
        var id = update.id;
        if (this.players[id].draw) {
          // Get powerup tile and send observation.
        }
      }
    });
  });

  this.tile_events = new TileEvents();
  var pups = [];
  tagpro.map.forEach(function (row, x) {
    row.forEach(function (tile, y) {
      if (Math.floor(tile) !== 6) return;
      var powerup = {
        x: x,
        y: y
      };
      pups.push(powerup);
    });
  });

  pups.forEach(function (pup) {
    tracker.addListener(pup, seeAlert);
  });

  this.solver = new Solver();
}

// TODO: Initialization and state management in case solver goes crazy.

// Takes a variable change event.
PowerupTracker.prototype.change = function(info) {
  if (info.variable) {

  }
};

// Takes a variable observation event.
PowerupTracker.prototype.observe = function() {
  
};

PowerupTracker.prototype.state = function(first_argument) {
  // body...
};

// Do updating.
PowerupTracker.prototype.update = function(first_argument) {
  // body...
};

},{"./solver":3,"./tile-events":5}],3:[function(require,module,exports){
// Time for state to change back.
var STATE_CHANGE = 6e4;
var EPSILON = 2e3;

// Comparison operations.
function lt(a, b) {
  return a - b < EPSILON;
}

function gt(a, b) {
  return b - a < EPSILON;
}

function eq(a, b) {
  return Math.abs(a - b) < EPSILON;
}

// Object clone.
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = Solver;

/**
 * Solver solves boolean dynamic state.
 * @param {Array<string>} variables - array of variable names.
 */
function Solver(variables) {
  this.variables = {};
  this.states = [];
  this._time = null;
  var state = {};
  var time = Date.now();
  var self = this;
  // TODO: Handle unknown or variable start.
  variables.forEach(function (variable) {
    self.variables[variable] = {
      observed: false
    };
    state[variable] = {
      state: true,
      intervals: [{
        state: true,
        start: time,
        observed: false,
        end: null
      }]
    };
  });
  this.states.push(state);
}

// Set subset of variables as observed, the rest assumed not.
Solver.prototype.setObserved = function(variables) {
  var unobserved_variables = Object.keys(this.variables).filter(function (variable) {
    return variables.indexOf(variable) === -1;
  });
  var self = this;
  variables.forEach(function (variable) {
    self.variables[variable].observed = true;
  });
  unobserved_variables.forEach(function (variable) {
    self.variables[variable].observed = false;
  });
};

// Hypothesis has time, state.
Solver.prototype.addHypothesis = function(h) {
  this.updateVariables();
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newStates = this.applyHypothesis(this.states[i], h);
    if (newStates)
      Array.prototype.push.apply(states, newStates);
  }
  this.states = states;
};

// Observation has time, state, variable.
Solver.prototype.addObservation = function(o) {
  this.updateVariables();
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newState = this.applyObservation(this.states[i], o);
    if (newState)
      states.push(newState);
  }
  this.states = states;
};

// Get set of possible states.
Solver.prototype.getStates = function() {
  this.updateVariables();
  return this.states.slice();
};

// Get consolidated state.
// Each variable has state (true|false|null), change (if false). change
// is number or array (if there is disagreement)
Solver.prototype.getState = function() {
  this.updateVariables();
  // Construct output.
  var out = {};
  var state = this.states[0];
  for (var name in state) {
    var variable = state[name];
    if (variable.state) {
      out[name] = {
        state: variable.state
      };
    } else {
      var time = variable.intervals[variable.intervals.length - 1].end;
      out[name] = {
        state: variable.state,
        time: time
      };
    }
  }
  // Compare results across all states.
  return this.states.slice(1).reduce(function (out, state) {
    for (var name in out) {
      var out_variable = out[name],
          variable = state[name];
      // Check for matching states.
      if (out_variable.state === variable.state) {
        // Falsy check time.
        if (!out_variable.state) {
          // TODO: check undefined in case interval not updated?
          var change = variable.intervals[variable.intervals.length - 1].end;
          if (out_variable.time instanceof Array) {
            if (out_variable.time.indexOf(change) === -1) {
              out_variable.push(change);
            }
          } else if (out_variable.time !== change) {
            var times = [out_variable.time, change];
            out_variable.time = times;
          } // Else matches, so no problem.
        }
      } else {
        // Conflicted states.
        out_variable.state = null;
        // In case it was set.
        delete out_variable.time;
      }
    }
    return out;
  }, out);
};

// Update `false` state variables based on false end
// time, if present.
Solver.prototype.updateVariables = function() {
  var time = this._time || Date.now();
  for (var i = 0; i < this.states.length; i++) {
    var state = this.states[i];
    for (var name in state) {
      var variable = state[name];
      // Update changeback.
      if (!variable.state) {
        if (variable.intervals.length > 0) {
          var last = variable.intervals[variable.intervals.length - 1];
          if (last.end && last.end <= time) {
            // update to true.
            variable.state = true;
            variable.intervals.push({
              state: true,
              start: time,
              end: null
            });
          }
        }
      }
    }
  }
};

// Return state with observation applied or null if invalid.
Solver.prototype.applyObservation = function(state, observation) {
  var variable = state[observation.variable];
  if (variable.state && !observation.state) {
    // Change in observed variable true -> false
    variable.state = observation.state;
    variable.intervals.push({
      state: variable.state,
      start: observation.time,
      end: observation.time + STATE_CHANGE
    });
    return state;
  } else if (variable.state && observation.state) {
    // Expected state.
    return state;
  } else if (!variable.state && observation.state) {
    // Potentially updating variable.
    var time = variable.intervals[variable.intervals.length - 1];
    if (eq(time, observation.time)) {
      // update state.
      variable.state = observation.state;
      variable.intervals.push({
        state: observation.state,
        start: observation.time,
        end: null
      });
      return state;
    } else {
      // Could not update this variable.
      return null;
    }
  } else if (!variable.state && !observation.state) {
    // Expected state.
    return state;
  }
};

// Returns multiple states or null if invalid
Solver.prototype.applyHypothesis = function(state, hypothesis) {
  hypothesis = clone(hypothesis);
  var states = [];
  for (var name in state) {
    // Skip observed variables, no guessing with them.
    if (this.variables[name].observed)
      continue;
    var newState = clone(state);
    var variable = newState[name];
    // Hypothesis is always false.
    if (variable.state) {
      // Change in observed variable true -> false
      variable.state = hypothesis.state;
      variable.intervals.push({
        state: variable.state,
        start: hypothesis.time,
        end: hypothesis.time + STATE_CHANGE
      });
    } else {
      newState = null;
    }
    if (newState !== null) {
      states.push(newState);
    }
  }
  if (states.length === 0) {
    return null;
  } else {
    return states;
  }
};

},{}],4:[function(require,module,exports){
// tagpro startup helpers.
/**
 * EventEmitter interface.
 * Events:
 * - ready: tagpro.ready
 * - start: tagpro object exists
 * - spectating: joined as spectator
 * - join: joined game as player, or from spectator mode.
 */
var TagPro = (function () {
  function setImmediate(fn) {
    setTimeout(function() {
      fn();
    }, 0);
  }

  function findIndex(arr, fn) {
    for (var i = 0; i < arr.length; i++) {
      if (fn(arr[i])) {
        return i;
      }
    }
    return -1;
  }

  function onTagPro(fn, notFirst) {
    if (typeof tagpro !== 'undefined') {
      if (!notFirst) {
        // Force to be async.
        setImmediate(fn);
      } else {
        fn();
      }
    } else {
      setTimeout(function () {
        onTagPro(fn, true);
      }, 20);
    }
  }

  function TagPro() {
    var self = this;
    onTagPro(function () {
      self._init();
      self.emit('start');
    });
  }

  // Initialize listeners for states.
  TagPro.prototype._init = function() {
    var self = this;
    var socket = tagpro.rawSocket;
    this.callbacks = {
      "tagpro.exists": [],
      "tagpro.ready": [],
      "tagpro.initialized": [],
      "user.spectating": [],
      "user.playing": [],
      "game.pre": [],
      "game.start": [],
      "game.end": [],
      "group": []
    };

    // Track states.
    this.state = {
      "tagpro.start": false,
      "tagpro.ready": false,
      "tagpro.initialized": false,
      "user.spectating": false,
      "user.playing": false,
      "game.pre": false,
      "game.start": false,
      "game.end": false,
      "group": false
    };

    function set(type, val) {
      if (!this.state.hasOwnProperty(type)) return;
      this.state[type] = val;
      var arg;
      if (type == "user.playing") {
        if (this.state["user.spectating"]) {
          arg = true;
        }
      }
      self.emit(type);
    }

    function get(type) {
      return this.state[type];
    }

    this.on('ready', function () {
      // Initialize
      var timeout;
      if (tagpro.spectator) {
        self.state.spectating = true;
        self.emit('spectating');
      } else {
        // Emit playing if not spectator.
        timeout = setTimeout(function () {
          self.emit('playing');
        }, 2e3);
      }
      // Set up socket listeners.
      tagpro.socket.on('spectator', function (spectating) {
        if (spectating) {
          self.state.spectating = true;
          if (timeout) {
            // Don't emit playing.
            clearTimeout(timeout);
          }
          self.emit('spectating');
        } else {
          // Joining game from spectating.
          if (self.state.spectating) {
            self.state.spectating = false;
            self.emit('playing');
          }
        }
      });
    });

    setImmediate(function () {
      tagpro.ready(function () {
        self.emit('ready');
      });
    });
  };

  TagPro.prototype.on = function(name, fn) {
    if (!this.callbacks.hasOwnProperty(name)) {
      this.callbacks[name] = [];
    }
    this.callbacks[name].push(fn);
  };

  TagPro.prototype.off = function(name, fn) {
    if (this.callbacks.hasOwnProperty(name)) {
      var i = findIndex(this.callbacks[name], function (elt) {
        if (typeof elt == "object") {
          return elt.fn === fn;
        } else {
          return elt === fn;
        }
      });
      if (i !== -1) {
        this.callbacks[name].splice(i, 1);
      }
    }
  };

  TagPro.prototype.once = function(name, fn) {
    if (!this.callbacks.hasOwnProperty(name)) {
      this.callbacks[name] = [];
    }
    this.callbacks[name].push({
      fn: fn
    });
  };

  // @private
  TagPro.prototype.emit = function(name) {
    if (this.callbacks.hasOwnProperty(name)) {
      var callbacks = this.callbacks[name];
      for (var i = 0; i < callbacks.length; i++) {
        var fn = callbacks[i];
        // Handle 'once' items.
        if (typeof fn == "object") {
          callbacks.splice(i, 1);
          i--;
          fn = fn.fn;
        }
        fn();
      }
    }
  };

  return new TagPro();
})();

module.exports = TagPro;

},{}],5:[function(require,module,exports){
module.exports = TileEvents;

// Allows adding listener for tiles coming into view.
// Browser-specific.
function TileEvents() {
  this.tiles = [];
  this.listeners = {};
  this.checkInterval = 250;
  this.interval = setInterval(this._interval.bind(this), this.checkInterval);
  this.range = {
    x: 660,
    y: 420
  };
}

// Add listener for a tile visibility event, whether coming into view or leaving view.
// Callback receives a message with x, y, in_view, and v showing last value.
TileEvents.prototype.addListener = function(tile, callback) {
  var id = getId(tile);
  if (!this.listeners.hasOwnProperty(id)) {
    this.listeners[id] = [];
    this.tiles.push({
      id: id,
      loc: tile,
      world_loc: {x: tile.x * TILE_WIDTH, y: tile.y * TILE_WIDTH},
      in_view: false
    });
  }
  this.listeners[id].push(callback);
};

// Remove a function from listeners.
TileEvents.prototype.removeListener = function(tile, callback) {
  // body...
};

// Get player location.
TileEvents.prototype._loc = function() {
  return {
    x: tagpro.players[tagpro.playerId].x,
    y: tagpro.players[tagpro.playerId].y
  };
};

// Function run in an interval.
TileEvents.prototype._interval = function() {
  var loc = this._loc();
  var newTiles = [];
  this.tiles.forEach(function (tile) {
    var in_view = (Math.abs(tile.world_loc.x - loc.x) < this.range.x &&
      Math.abs(tile.world_loc.y - loc.y) < this.range.y);
    if (in_view && !tile.in_view) {
      newTiles.push(tile);
      tile.in_view = true;
    } else if (!in_view && tile.in_view) {
      newTiles.push(tile);
      tile.in_view = false;
    } 
  }, this);
  newTiles.forEach(function (tile) {
    // todo: add buffer?
    
    var val = tagpro.map[tile.loc.x][tile.loc.y];
    var event = {
      x: tile.loc.x,
      y: tile.loc.y,
      v: val,
      visible: tile.in_view
    };
    // Notify callbacks.
    this.listeners[tile.id].forEach(function (listener) {
      listener(event);
    });
  }, this);
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbWFpbi5qcyIsInNyYy9wb3dlcnVwLXRyYWNrZXIuanMiLCJzcmMvc29sdmVyLmpzIiwic3JjL3RhZ3Byby5qcyIsInNyYy90aWxlLWV2ZW50cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIFBvd2VydXBUcmFja2VyID0gcmVxdWlyZSgnLi9wb3dlcnVwLXRyYWNrZXInKTtcclxudmFyIFRhZ1BybyA9IHJlcXVpcmUoJy4vdGFncHJvJyk7XHJcblxyXG5UYWdQcm8ub24oJ3VzZXIucGxheWluZycsIGZ1bmN0aW9uICgpIHtcclxuICB2YXIgdHJhY2tlciA9IG5ldyBQb3dlcnVwVHJhY2tlcigpO1xyXG4gIFxyXG59KTtcclxuIiwidmFyIFNvbHZlciA9IHJlcXVpcmUoJy4vc29sdmVyJyk7XHJcbnZhciBUaWxlRXZlbnRzID0gcmVxdWlyZSgnLi90aWxlLWV2ZW50cycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBQb3dlcnVwVHJhY2tlcjtcclxuLy8gSW50ZXJmYWNlIHRoYXQgdGFrZXMgaW4gc291cmNlIGluZm9ybWF0aW9uIGFuZCBwdXRzIGl0IGludG8gc29sdmVyIGZvcm1hdC5cclxuZnVuY3Rpb24gUG93ZXJ1cFRyYWNrZXIoKSB7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIC8vIGhhbmRsZSBtYXB1cGRhdGUsIHRpbGUgdHJhY2tpbmdcclxuICAvLyBQbGF5ZXIgbGlzdGVuaW5nXHJcbiAgdGhpcy5zb2NrZXQub24oJ3AnLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgIHZhciB1cGRhdGVzID0gZXZlbnQudSB8fCBldmVudDtcclxuICAgIHVwZGF0ZXMuZm9yRWFjaChmdW5jdGlvbiAodXBkYXRlKSB7XHJcbiAgICAgIGlmICh1cGRhdGVbJ3MtcG93ZXJ1cHMnXSkge1xyXG4gICAgICAgIHZhciBpZCA9IHVwZGF0ZS5pZDtcclxuICAgICAgICBpZiAodGhpcy5wbGF5ZXJzW2lkXS5kcmF3KSB7XHJcbiAgICAgICAgICAvLyBHZXQgcG93ZXJ1cCB0aWxlIGFuZCBzZW5kIG9ic2VydmF0aW9uLlxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHRoaXMudGlsZV9ldmVudHMgPSBuZXcgVGlsZUV2ZW50cygpO1xyXG4gIHZhciBwdXBzID0gW107XHJcbiAgdGFncHJvLm1hcC5mb3JFYWNoKGZ1bmN0aW9uIChyb3csIHgpIHtcclxuICAgIHJvdy5mb3JFYWNoKGZ1bmN0aW9uICh0aWxlLCB5KSB7XHJcbiAgICAgIGlmIChNYXRoLmZsb29yKHRpbGUpICE9PSA2KSByZXR1cm47XHJcbiAgICAgIHZhciBwb3dlcnVwID0ge1xyXG4gICAgICAgIHg6IHgsXHJcbiAgICAgICAgeTogeVxyXG4gICAgICB9O1xyXG4gICAgICBwdXBzLnB1c2gocG93ZXJ1cCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgcHVwcy5mb3JFYWNoKGZ1bmN0aW9uIChwdXApIHtcclxuICAgIHRyYWNrZXIuYWRkTGlzdGVuZXIocHVwLCBzZWVBbGVydCk7XHJcbiAgfSk7XHJcblxyXG4gIHRoaXMuc29sdmVyID0gbmV3IFNvbHZlcigpO1xyXG59XHJcblxyXG4vLyBUT0RPOiBJbml0aWFsaXphdGlvbiBhbmQgc3RhdGUgbWFuYWdlbWVudCBpbiBjYXNlIHNvbHZlciBnb2VzIGNyYXp5LlxyXG5cclxuLy8gVGFrZXMgYSB2YXJpYWJsZSBjaGFuZ2UgZXZlbnQuXHJcblBvd2VydXBUcmFja2VyLnByb3RvdHlwZS5jaGFuZ2UgPSBmdW5jdGlvbihpbmZvKSB7XHJcbiAgaWYgKGluZm8udmFyaWFibGUpIHtcclxuXHJcbiAgfVxyXG59O1xyXG5cclxuLy8gVGFrZXMgYSB2YXJpYWJsZSBvYnNlcnZhdGlvbiBldmVudC5cclxuUG93ZXJ1cFRyYWNrZXIucHJvdG90eXBlLm9ic2VydmUgPSBmdW5jdGlvbigpIHtcclxuICBcclxufTtcclxuXHJcblBvd2VydXBUcmFja2VyLnByb3RvdHlwZS5zdGF0ZSA9IGZ1bmN0aW9uKGZpcnN0X2FyZ3VtZW50KSB7XHJcbiAgLy8gYm9keS4uLlxyXG59O1xyXG5cclxuLy8gRG8gdXBkYXRpbmcuXHJcblBvd2VydXBUcmFja2VyLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihmaXJzdF9hcmd1bWVudCkge1xyXG4gIC8vIGJvZHkuLi5cclxufTtcclxuIiwiLy8gVGltZSBmb3Igc3RhdGUgdG8gY2hhbmdlIGJhY2suXHJcbnZhciBTVEFURV9DSEFOR0UgPSA2ZTQ7XHJcbnZhciBFUFNJTE9OID0gMmUzO1xyXG5cclxuLy8gQ29tcGFyaXNvbiBvcGVyYXRpb25zLlxyXG5mdW5jdGlvbiBsdChhLCBiKSB7XHJcbiAgcmV0dXJuIGEgLSBiIDwgRVBTSUxPTjtcclxufVxyXG5cclxuZnVuY3Rpb24gZ3QoYSwgYikge1xyXG4gIHJldHVybiBiIC0gYSA8IEVQU0lMT047XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVxKGEsIGIpIHtcclxuICByZXR1cm4gTWF0aC5hYnMoYSAtIGIpIDwgRVBTSUxPTjtcclxufVxyXG5cclxuLy8gT2JqZWN0IGNsb25lLlxyXG5mdW5jdGlvbiBjbG9uZShvYmopIHtcclxuICByZXR1cm4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTb2x2ZXI7XHJcblxyXG4vKipcclxuICogU29sdmVyIHNvbHZlcyBib29sZWFuIGR5bmFtaWMgc3RhdGUuXHJcbiAqIEBwYXJhbSB7QXJyYXk8c3RyaW5nPn0gdmFyaWFibGVzIC0gYXJyYXkgb2YgdmFyaWFibGUgbmFtZXMuXHJcbiAqL1xyXG5mdW5jdGlvbiBTb2x2ZXIodmFyaWFibGVzKSB7XHJcbiAgdGhpcy52YXJpYWJsZXMgPSB7fTtcclxuICB0aGlzLnN0YXRlcyA9IFtdO1xyXG4gIHRoaXMuX3RpbWUgPSBudWxsO1xyXG4gIHZhciBzdGF0ZSA9IHt9O1xyXG4gIHZhciB0aW1lID0gRGF0ZS5ub3coKTtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgLy8gVE9ETzogSGFuZGxlIHVua25vd24gb3IgdmFyaWFibGUgc3RhcnQuXHJcbiAgdmFyaWFibGVzLmZvckVhY2goZnVuY3Rpb24gKHZhcmlhYmxlKSB7XHJcbiAgICBzZWxmLnZhcmlhYmxlc1t2YXJpYWJsZV0gPSB7XHJcbiAgICAgIG9ic2VydmVkOiBmYWxzZVxyXG4gICAgfTtcclxuICAgIHN0YXRlW3ZhcmlhYmxlXSA9IHtcclxuICAgICAgc3RhdGU6IHRydWUsXHJcbiAgICAgIGludGVydmFsczogW3tcclxuICAgICAgICBzdGF0ZTogdHJ1ZSxcclxuICAgICAgICBzdGFydDogdGltZSxcclxuICAgICAgICBvYnNlcnZlZDogZmFsc2UsXHJcbiAgICAgICAgZW5kOiBudWxsXHJcbiAgICAgIH1dXHJcbiAgICB9O1xyXG4gIH0pO1xyXG4gIHRoaXMuc3RhdGVzLnB1c2goc3RhdGUpO1xyXG59XHJcblxyXG4vLyBTZXQgc3Vic2V0IG9mIHZhcmlhYmxlcyBhcyBvYnNlcnZlZCwgdGhlIHJlc3QgYXNzdW1lZCBub3QuXHJcblNvbHZlci5wcm90b3R5cGUuc2V0T2JzZXJ2ZWQgPSBmdW5jdGlvbih2YXJpYWJsZXMpIHtcclxuICB2YXIgdW5vYnNlcnZlZF92YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnZhcmlhYmxlcykuZmlsdGVyKGZ1bmN0aW9uICh2YXJpYWJsZSkge1xyXG4gICAgcmV0dXJuIHZhcmlhYmxlcy5pbmRleE9mKHZhcmlhYmxlKSA9PT0gLTE7XHJcbiAgfSk7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIHZhcmlhYmxlcy5mb3JFYWNoKGZ1bmN0aW9uICh2YXJpYWJsZSkge1xyXG4gICAgc2VsZi52YXJpYWJsZXNbdmFyaWFibGVdLm9ic2VydmVkID0gdHJ1ZTtcclxuICB9KTtcclxuICB1bm9ic2VydmVkX3ZhcmlhYmxlcy5mb3JFYWNoKGZ1bmN0aW9uICh2YXJpYWJsZSkge1xyXG4gICAgc2VsZi52YXJpYWJsZXNbdmFyaWFibGVdLm9ic2VydmVkID0gZmFsc2U7XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vLyBIeXBvdGhlc2lzIGhhcyB0aW1lLCBzdGF0ZS5cclxuU29sdmVyLnByb3RvdHlwZS5hZGRIeXBvdGhlc2lzID0gZnVuY3Rpb24oaCkge1xyXG4gIHRoaXMudXBkYXRlVmFyaWFibGVzKCk7XHJcbiAgdmFyIHN0YXRlcyA9IFtdO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdGF0ZXMubGVuZ3RoOyBpKyspIHtcclxuICAgIHZhciBuZXdTdGF0ZXMgPSB0aGlzLmFwcGx5SHlwb3RoZXNpcyh0aGlzLnN0YXRlc1tpXSwgaCk7XHJcbiAgICBpZiAobmV3U3RhdGVzKVxyXG4gICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShzdGF0ZXMsIG5ld1N0YXRlcyk7XHJcbiAgfVxyXG4gIHRoaXMuc3RhdGVzID0gc3RhdGVzO1xyXG59O1xyXG5cclxuLy8gT2JzZXJ2YXRpb24gaGFzIHRpbWUsIHN0YXRlLCB2YXJpYWJsZS5cclxuU29sdmVyLnByb3RvdHlwZS5hZGRPYnNlcnZhdGlvbiA9IGZ1bmN0aW9uKG8pIHtcclxuICB0aGlzLnVwZGF0ZVZhcmlhYmxlcygpO1xyXG4gIHZhciBzdGF0ZXMgPSBbXTtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3RhdGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICB2YXIgbmV3U3RhdGUgPSB0aGlzLmFwcGx5T2JzZXJ2YXRpb24odGhpcy5zdGF0ZXNbaV0sIG8pO1xyXG4gICAgaWYgKG5ld1N0YXRlKVxyXG4gICAgICBzdGF0ZXMucHVzaChuZXdTdGF0ZSk7XHJcbiAgfVxyXG4gIHRoaXMuc3RhdGVzID0gc3RhdGVzO1xyXG59O1xyXG5cclxuLy8gR2V0IHNldCBvZiBwb3NzaWJsZSBzdGF0ZXMuXHJcblNvbHZlci5wcm90b3R5cGUuZ2V0U3RhdGVzID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy51cGRhdGVWYXJpYWJsZXMoKTtcclxuICByZXR1cm4gdGhpcy5zdGF0ZXMuc2xpY2UoKTtcclxufTtcclxuXHJcbi8vIEdldCBjb25zb2xpZGF0ZWQgc3RhdGUuXHJcbi8vIEVhY2ggdmFyaWFibGUgaGFzIHN0YXRlICh0cnVlfGZhbHNlfG51bGwpLCBjaGFuZ2UgKGlmIGZhbHNlKS4gY2hhbmdlXHJcbi8vIGlzIG51bWJlciBvciBhcnJheSAoaWYgdGhlcmUgaXMgZGlzYWdyZWVtZW50KVxyXG5Tb2x2ZXIucHJvdG90eXBlLmdldFN0YXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy51cGRhdGVWYXJpYWJsZXMoKTtcclxuICAvLyBDb25zdHJ1Y3Qgb3V0cHV0LlxyXG4gIHZhciBvdXQgPSB7fTtcclxuICB2YXIgc3RhdGUgPSB0aGlzLnN0YXRlc1swXTtcclxuICBmb3IgKHZhciBuYW1lIGluIHN0YXRlKSB7XHJcbiAgICB2YXIgdmFyaWFibGUgPSBzdGF0ZVtuYW1lXTtcclxuICAgIGlmICh2YXJpYWJsZS5zdGF0ZSkge1xyXG4gICAgICBvdXRbbmFtZV0gPSB7XHJcbiAgICAgICAgc3RhdGU6IHZhcmlhYmxlLnN0YXRlXHJcbiAgICAgIH07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB2YXIgdGltZSA9IHZhcmlhYmxlLmludGVydmFsc1t2YXJpYWJsZS5pbnRlcnZhbHMubGVuZ3RoIC0gMV0uZW5kO1xyXG4gICAgICBvdXRbbmFtZV0gPSB7XHJcbiAgICAgICAgc3RhdGU6IHZhcmlhYmxlLnN0YXRlLFxyXG4gICAgICAgIHRpbWU6IHRpbWVcclxuICAgICAgfTtcclxuICAgIH1cclxuICB9XHJcbiAgLy8gQ29tcGFyZSByZXN1bHRzIGFjcm9zcyBhbGwgc3RhdGVzLlxyXG4gIHJldHVybiB0aGlzLnN0YXRlcy5zbGljZSgxKS5yZWR1Y2UoZnVuY3Rpb24gKG91dCwgc3RhdGUpIHtcclxuICAgIGZvciAodmFyIG5hbWUgaW4gb3V0KSB7XHJcbiAgICAgIHZhciBvdXRfdmFyaWFibGUgPSBvdXRbbmFtZV0sXHJcbiAgICAgICAgICB2YXJpYWJsZSA9IHN0YXRlW25hbWVdO1xyXG4gICAgICAvLyBDaGVjayBmb3IgbWF0Y2hpbmcgc3RhdGVzLlxyXG4gICAgICBpZiAob3V0X3ZhcmlhYmxlLnN0YXRlID09PSB2YXJpYWJsZS5zdGF0ZSkge1xyXG4gICAgICAgIC8vIEZhbHN5IGNoZWNrIHRpbWUuXHJcbiAgICAgICAgaWYgKCFvdXRfdmFyaWFibGUuc3RhdGUpIHtcclxuICAgICAgICAgIC8vIFRPRE86IGNoZWNrIHVuZGVmaW5lZCBpbiBjYXNlIGludGVydmFsIG5vdCB1cGRhdGVkP1xyXG4gICAgICAgICAgdmFyIGNoYW5nZSA9IHZhcmlhYmxlLmludGVydmFsc1t2YXJpYWJsZS5pbnRlcnZhbHMubGVuZ3RoIC0gMV0uZW5kO1xyXG4gICAgICAgICAgaWYgKG91dF92YXJpYWJsZS50aW1lIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuICAgICAgICAgICAgaWYgKG91dF92YXJpYWJsZS50aW1lLmluZGV4T2YoY2hhbmdlKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICBvdXRfdmFyaWFibGUucHVzaChjaGFuZ2UpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKG91dF92YXJpYWJsZS50aW1lICE9PSBjaGFuZ2UpIHtcclxuICAgICAgICAgICAgdmFyIHRpbWVzID0gW291dF92YXJpYWJsZS50aW1lLCBjaGFuZ2VdO1xyXG4gICAgICAgICAgICBvdXRfdmFyaWFibGUudGltZSA9IHRpbWVzO1xyXG4gICAgICAgICAgfSAvLyBFbHNlIG1hdGNoZXMsIHNvIG5vIHByb2JsZW0uXHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIENvbmZsaWN0ZWQgc3RhdGVzLlxyXG4gICAgICAgIG91dF92YXJpYWJsZS5zdGF0ZSA9IG51bGw7XHJcbiAgICAgICAgLy8gSW4gY2FzZSBpdCB3YXMgc2V0LlxyXG4gICAgICAgIGRlbGV0ZSBvdXRfdmFyaWFibGUudGltZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG91dDtcclxuICB9LCBvdXQpO1xyXG59O1xyXG5cclxuLy8gVXBkYXRlIGBmYWxzZWAgc3RhdGUgdmFyaWFibGVzIGJhc2VkIG9uIGZhbHNlIGVuZFxyXG4vLyB0aW1lLCBpZiBwcmVzZW50LlxyXG5Tb2x2ZXIucHJvdG90eXBlLnVwZGF0ZVZhcmlhYmxlcyA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciB0aW1lID0gdGhpcy5fdGltZSB8fCBEYXRlLm5vdygpO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdGF0ZXMubGVuZ3RoOyBpKyspIHtcclxuICAgIHZhciBzdGF0ZSA9IHRoaXMuc3RhdGVzW2ldO1xyXG4gICAgZm9yICh2YXIgbmFtZSBpbiBzdGF0ZSkge1xyXG4gICAgICB2YXIgdmFyaWFibGUgPSBzdGF0ZVtuYW1lXTtcclxuICAgICAgLy8gVXBkYXRlIGNoYW5nZWJhY2suXHJcbiAgICAgIGlmICghdmFyaWFibGUuc3RhdGUpIHtcclxuICAgICAgICBpZiAodmFyaWFibGUuaW50ZXJ2YWxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHZhciBsYXN0ID0gdmFyaWFibGUuaW50ZXJ2YWxzW3ZhcmlhYmxlLmludGVydmFscy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgIGlmIChsYXN0LmVuZCAmJiBsYXN0LmVuZCA8PSB0aW1lKSB7XHJcbiAgICAgICAgICAgIC8vIHVwZGF0ZSB0byB0cnVlLlxyXG4gICAgICAgICAgICB2YXJpYWJsZS5zdGF0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgIHZhcmlhYmxlLmludGVydmFscy5wdXNoKHtcclxuICAgICAgICAgICAgICBzdGF0ZTogdHJ1ZSxcclxuICAgICAgICAgICAgICBzdGFydDogdGltZSxcclxuICAgICAgICAgICAgICBlbmQ6IG51bGxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gUmV0dXJuIHN0YXRlIHdpdGggb2JzZXJ2YXRpb24gYXBwbGllZCBvciBudWxsIGlmIGludmFsaWQuXHJcblNvbHZlci5wcm90b3R5cGUuYXBwbHlPYnNlcnZhdGlvbiA9IGZ1bmN0aW9uKHN0YXRlLCBvYnNlcnZhdGlvbikge1xyXG4gIHZhciB2YXJpYWJsZSA9IHN0YXRlW29ic2VydmF0aW9uLnZhcmlhYmxlXTtcclxuICBpZiAodmFyaWFibGUuc3RhdGUgJiYgIW9ic2VydmF0aW9uLnN0YXRlKSB7XHJcbiAgICAvLyBDaGFuZ2UgaW4gb2JzZXJ2ZWQgdmFyaWFibGUgdHJ1ZSAtPiBmYWxzZVxyXG4gICAgdmFyaWFibGUuc3RhdGUgPSBvYnNlcnZhdGlvbi5zdGF0ZTtcclxuICAgIHZhcmlhYmxlLmludGVydmFscy5wdXNoKHtcclxuICAgICAgc3RhdGU6IHZhcmlhYmxlLnN0YXRlLFxyXG4gICAgICBzdGFydDogb2JzZXJ2YXRpb24udGltZSxcclxuICAgICAgZW5kOiBvYnNlcnZhdGlvbi50aW1lICsgU1RBVEVfQ0hBTkdFXHJcbiAgICB9KTtcclxuICAgIHJldHVybiBzdGF0ZTtcclxuICB9IGVsc2UgaWYgKHZhcmlhYmxlLnN0YXRlICYmIG9ic2VydmF0aW9uLnN0YXRlKSB7XHJcbiAgICAvLyBFeHBlY3RlZCBzdGF0ZS5cclxuICAgIHJldHVybiBzdGF0ZTtcclxuICB9IGVsc2UgaWYgKCF2YXJpYWJsZS5zdGF0ZSAmJiBvYnNlcnZhdGlvbi5zdGF0ZSkge1xyXG4gICAgLy8gUG90ZW50aWFsbHkgdXBkYXRpbmcgdmFyaWFibGUuXHJcbiAgICB2YXIgdGltZSA9IHZhcmlhYmxlLmludGVydmFsc1t2YXJpYWJsZS5pbnRlcnZhbHMubGVuZ3RoIC0gMV07XHJcbiAgICBpZiAoZXEodGltZSwgb2JzZXJ2YXRpb24udGltZSkpIHtcclxuICAgICAgLy8gdXBkYXRlIHN0YXRlLlxyXG4gICAgICB2YXJpYWJsZS5zdGF0ZSA9IG9ic2VydmF0aW9uLnN0YXRlO1xyXG4gICAgICB2YXJpYWJsZS5pbnRlcnZhbHMucHVzaCh7XHJcbiAgICAgICAgc3RhdGU6IG9ic2VydmF0aW9uLnN0YXRlLFxyXG4gICAgICAgIHN0YXJ0OiBvYnNlcnZhdGlvbi50aW1lLFxyXG4gICAgICAgIGVuZDogbnVsbFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHN0YXRlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gQ291bGQgbm90IHVwZGF0ZSB0aGlzIHZhcmlhYmxlLlxyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9IGVsc2UgaWYgKCF2YXJpYWJsZS5zdGF0ZSAmJiAhb2JzZXJ2YXRpb24uc3RhdGUpIHtcclxuICAgIC8vIEV4cGVjdGVkIHN0YXRlLlxyXG4gICAgcmV0dXJuIHN0YXRlO1xyXG4gIH1cclxufTtcclxuXHJcbi8vIFJldHVybnMgbXVsdGlwbGUgc3RhdGVzIG9yIG51bGwgaWYgaW52YWxpZFxyXG5Tb2x2ZXIucHJvdG90eXBlLmFwcGx5SHlwb3RoZXNpcyA9IGZ1bmN0aW9uKHN0YXRlLCBoeXBvdGhlc2lzKSB7XHJcbiAgaHlwb3RoZXNpcyA9IGNsb25lKGh5cG90aGVzaXMpO1xyXG4gIHZhciBzdGF0ZXMgPSBbXTtcclxuICBmb3IgKHZhciBuYW1lIGluIHN0YXRlKSB7XHJcbiAgICAvLyBTa2lwIG9ic2VydmVkIHZhcmlhYmxlcywgbm8gZ3Vlc3Npbmcgd2l0aCB0aGVtLlxyXG4gICAgaWYgKHRoaXMudmFyaWFibGVzW25hbWVdLm9ic2VydmVkKVxyXG4gICAgICBjb250aW51ZTtcclxuICAgIHZhciBuZXdTdGF0ZSA9IGNsb25lKHN0YXRlKTtcclxuICAgIHZhciB2YXJpYWJsZSA9IG5ld1N0YXRlW25hbWVdO1xyXG4gICAgLy8gSHlwb3RoZXNpcyBpcyBhbHdheXMgZmFsc2UuXHJcbiAgICBpZiAodmFyaWFibGUuc3RhdGUpIHtcclxuICAgICAgLy8gQ2hhbmdlIGluIG9ic2VydmVkIHZhcmlhYmxlIHRydWUgLT4gZmFsc2VcclxuICAgICAgdmFyaWFibGUuc3RhdGUgPSBoeXBvdGhlc2lzLnN0YXRlO1xyXG4gICAgICB2YXJpYWJsZS5pbnRlcnZhbHMucHVzaCh7XHJcbiAgICAgICAgc3RhdGU6IHZhcmlhYmxlLnN0YXRlLFxyXG4gICAgICAgIHN0YXJ0OiBoeXBvdGhlc2lzLnRpbWUsXHJcbiAgICAgICAgZW5kOiBoeXBvdGhlc2lzLnRpbWUgKyBTVEFURV9DSEFOR0VcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBuZXdTdGF0ZSA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAobmV3U3RhdGUgIT09IG51bGwpIHtcclxuICAgICAgc3RhdGVzLnB1c2gobmV3U3RhdGUpO1xyXG4gICAgfVxyXG4gIH1cclxuICBpZiAoc3RhdGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiBzdGF0ZXM7XHJcbiAgfVxyXG59O1xyXG4iLCIvLyB0YWdwcm8gc3RhcnR1cCBoZWxwZXJzLlxyXG4vKipcclxuICogRXZlbnRFbWl0dGVyIGludGVyZmFjZS5cclxuICogRXZlbnRzOlxyXG4gKiAtIHJlYWR5OiB0YWdwcm8ucmVhZHlcclxuICogLSBzdGFydDogdGFncHJvIG9iamVjdCBleGlzdHNcclxuICogLSBzcGVjdGF0aW5nOiBqb2luZWQgYXMgc3BlY3RhdG9yXHJcbiAqIC0gam9pbjogam9pbmVkIGdhbWUgYXMgcGxheWVyLCBvciBmcm9tIHNwZWN0YXRvciBtb2RlLlxyXG4gKi9cclxudmFyIFRhZ1BybyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgZnVuY3Rpb24gc2V0SW1tZWRpYXRlKGZuKSB7XHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICBmbigpO1xyXG4gICAgfSwgMCk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBmaW5kSW5kZXgoYXJyLCBmbikge1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYgKGZuKGFycltpXSkpIHtcclxuICAgICAgICByZXR1cm4gaTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIC0xO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gb25UYWdQcm8oZm4sIG5vdEZpcnN0KSB7XHJcbiAgICBpZiAodHlwZW9mIHRhZ3BybyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgaWYgKCFub3RGaXJzdCkge1xyXG4gICAgICAgIC8vIEZvcmNlIHRvIGJlIGFzeW5jLlxyXG4gICAgICAgIHNldEltbWVkaWF0ZShmbik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm4oKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgb25UYWdQcm8oZm4sIHRydWUpO1xyXG4gICAgICB9LCAyMCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBUYWdQcm8oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICBvblRhZ1BybyhmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHNlbGYuX2luaXQoKTtcclxuICAgICAgc2VsZi5lbWl0KCdzdGFydCcpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBJbml0aWFsaXplIGxpc3RlbmVycyBmb3Igc3RhdGVzLlxyXG4gIFRhZ1Byby5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHZhciBzb2NrZXQgPSB0YWdwcm8ucmF3U29ja2V0O1xyXG4gICAgdGhpcy5jYWxsYmFja3MgPSB7XHJcbiAgICAgIFwidGFncHJvLmV4aXN0c1wiOiBbXSxcclxuICAgICAgXCJ0YWdwcm8ucmVhZHlcIjogW10sXHJcbiAgICAgIFwidGFncHJvLmluaXRpYWxpemVkXCI6IFtdLFxyXG4gICAgICBcInVzZXIuc3BlY3RhdGluZ1wiOiBbXSxcclxuICAgICAgXCJ1c2VyLnBsYXlpbmdcIjogW10sXHJcbiAgICAgIFwiZ2FtZS5wcmVcIjogW10sXHJcbiAgICAgIFwiZ2FtZS5zdGFydFwiOiBbXSxcclxuICAgICAgXCJnYW1lLmVuZFwiOiBbXSxcclxuICAgICAgXCJncm91cFwiOiBbXVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBUcmFjayBzdGF0ZXMuXHJcbiAgICB0aGlzLnN0YXRlID0ge1xyXG4gICAgICBcInRhZ3Byby5zdGFydFwiOiBmYWxzZSxcclxuICAgICAgXCJ0YWdwcm8ucmVhZHlcIjogZmFsc2UsXHJcbiAgICAgIFwidGFncHJvLmluaXRpYWxpemVkXCI6IGZhbHNlLFxyXG4gICAgICBcInVzZXIuc3BlY3RhdGluZ1wiOiBmYWxzZSxcclxuICAgICAgXCJ1c2VyLnBsYXlpbmdcIjogZmFsc2UsXHJcbiAgICAgIFwiZ2FtZS5wcmVcIjogZmFsc2UsXHJcbiAgICAgIFwiZ2FtZS5zdGFydFwiOiBmYWxzZSxcclxuICAgICAgXCJnYW1lLmVuZFwiOiBmYWxzZSxcclxuICAgICAgXCJncm91cFwiOiBmYWxzZVxyXG4gICAgfTtcclxuXHJcbiAgICBmdW5jdGlvbiBzZXQodHlwZSwgdmFsKSB7XHJcbiAgICAgIGlmICghdGhpcy5zdGF0ZS5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkgcmV0dXJuO1xyXG4gICAgICB0aGlzLnN0YXRlW3R5cGVdID0gdmFsO1xyXG4gICAgICB2YXIgYXJnO1xyXG4gICAgICBpZiAodHlwZSA9PSBcInVzZXIucGxheWluZ1wiKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGVbXCJ1c2VyLnNwZWN0YXRpbmdcIl0pIHtcclxuICAgICAgICAgIGFyZyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHNlbGYuZW1pdCh0eXBlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBnZXQodHlwZSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5zdGF0ZVt0eXBlXTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm9uKCdyZWFkeScsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgLy8gSW5pdGlhbGl6ZVxyXG4gICAgICB2YXIgdGltZW91dDtcclxuICAgICAgaWYgKHRhZ3Byby5zcGVjdGF0b3IpIHtcclxuICAgICAgICBzZWxmLnN0YXRlLnNwZWN0YXRpbmcgPSB0cnVlO1xyXG4gICAgICAgIHNlbGYuZW1pdCgnc3BlY3RhdGluZycpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEVtaXQgcGxheWluZyBpZiBub3Qgc3BlY3RhdG9yLlxyXG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHNlbGYuZW1pdCgncGxheWluZycpO1xyXG4gICAgICAgIH0sIDJlMyk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gU2V0IHVwIHNvY2tldCBsaXN0ZW5lcnMuXHJcbiAgICAgIHRhZ3Byby5zb2NrZXQub24oJ3NwZWN0YXRvcicsIGZ1bmN0aW9uIChzcGVjdGF0aW5nKSB7XHJcbiAgICAgICAgaWYgKHNwZWN0YXRpbmcpIHtcclxuICAgICAgICAgIHNlbGYuc3RhdGUuc3BlY3RhdGluZyA9IHRydWU7XHJcbiAgICAgICAgICBpZiAodGltZW91dCkge1xyXG4gICAgICAgICAgICAvLyBEb24ndCBlbWl0IHBsYXlpbmcuXHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHNlbGYuZW1pdCgnc3BlY3RhdGluZycpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBKb2luaW5nIGdhbWUgZnJvbSBzcGVjdGF0aW5nLlxyXG4gICAgICAgICAgaWYgKHNlbGYuc3RhdGUuc3BlY3RhdGluZykge1xyXG4gICAgICAgICAgICBzZWxmLnN0YXRlLnNwZWN0YXRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgc2VsZi5lbWl0KCdwbGF5aW5nJyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHRhZ3Byby5yZWFkeShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgc2VsZi5lbWl0KCdyZWFkeScpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIFRhZ1Byby5wcm90b3R5cGUub24gPSBmdW5jdGlvbihuYW1lLCBmbikge1xyXG4gICAgaWYgKCF0aGlzLmNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xyXG4gICAgICB0aGlzLmNhbGxiYWNrc1tuYW1lXSA9IFtdO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jYWxsYmFja3NbbmFtZV0ucHVzaChmbik7XHJcbiAgfTtcclxuXHJcbiAgVGFnUHJvLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihuYW1lLCBmbikge1xyXG4gICAgaWYgKHRoaXMuY2FsbGJhY2tzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XHJcbiAgICAgIHZhciBpID0gZmluZEluZGV4KHRoaXMuY2FsbGJhY2tzW25hbWVdLCBmdW5jdGlvbiAoZWx0KSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBlbHQgPT0gXCJvYmplY3RcIikge1xyXG4gICAgICAgICAgcmV0dXJuIGVsdC5mbiA9PT0gZm47XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiBlbHQgPT09IGZuO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIGlmIChpICE9PSAtMSkge1xyXG4gICAgICAgIHRoaXMuY2FsbGJhY2tzW25hbWVdLnNwbGljZShpLCAxKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIFRhZ1Byby5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XHJcbiAgICBpZiAoIXRoaXMuY2FsbGJhY2tzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XHJcbiAgICAgIHRoaXMuY2FsbGJhY2tzW25hbWVdID0gW107XHJcbiAgICB9XHJcbiAgICB0aGlzLmNhbGxiYWNrc1tuYW1lXS5wdXNoKHtcclxuICAgICAgZm46IGZuXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICAvLyBAcHJpdmF0ZVxyXG4gIFRhZ1Byby5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgIGlmICh0aGlzLmNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xyXG4gICAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5jYWxsYmFja3NbbmFtZV07XHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIGZuID0gY2FsbGJhY2tzW2ldO1xyXG4gICAgICAgIC8vIEhhbmRsZSAnb25jZScgaXRlbXMuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBmbiA9PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgaS0tO1xyXG4gICAgICAgICAgZm4gPSBmbi5mbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm4oKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIHJldHVybiBuZXcgVGFnUHJvKCk7XHJcbn0pKCk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFRhZ1BybztcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBUaWxlRXZlbnRzO1xyXG5cclxuLy8gQWxsb3dzIGFkZGluZyBsaXN0ZW5lciBmb3IgdGlsZXMgY29taW5nIGludG8gdmlldy5cclxuLy8gQnJvd3Nlci1zcGVjaWZpYy5cclxuZnVuY3Rpb24gVGlsZUV2ZW50cygpIHtcclxuICB0aGlzLnRpbGVzID0gW107XHJcbiAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcclxuICB0aGlzLmNoZWNrSW50ZXJ2YWwgPSAyNTA7XHJcbiAgdGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKHRoaXMuX2ludGVydmFsLmJpbmQodGhpcyksIHRoaXMuY2hlY2tJbnRlcnZhbCk7XHJcbiAgdGhpcy5yYW5nZSA9IHtcclxuICAgIHg6IDY2MCxcclxuICAgIHk6IDQyMFxyXG4gIH07XHJcbn1cclxuXHJcbi8vIEFkZCBsaXN0ZW5lciBmb3IgYSB0aWxlIHZpc2liaWxpdHkgZXZlbnQsIHdoZXRoZXIgY29taW5nIGludG8gdmlldyBvciBsZWF2aW5nIHZpZXcuXHJcbi8vIENhbGxiYWNrIHJlY2VpdmVzIGEgbWVzc2FnZSB3aXRoIHgsIHksIGluX3ZpZXcsIGFuZCB2IHNob3dpbmcgbGFzdCB2YWx1ZS5cclxuVGlsZUV2ZW50cy5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0aWxlLCBjYWxsYmFjaykge1xyXG4gIHZhciBpZCA9IGdldElkKHRpbGUpO1xyXG4gIGlmICghdGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoaWQpKSB7XHJcbiAgICB0aGlzLmxpc3RlbmVyc1tpZF0gPSBbXTtcclxuICAgIHRoaXMudGlsZXMucHVzaCh7XHJcbiAgICAgIGlkOiBpZCxcclxuICAgICAgbG9jOiB0aWxlLFxyXG4gICAgICB3b3JsZF9sb2M6IHt4OiB0aWxlLnggKiBUSUxFX1dJRFRILCB5OiB0aWxlLnkgKiBUSUxFX1dJRFRIfSxcclxuICAgICAgaW5fdmlldzogZmFsc2VcclxuICAgIH0pO1xyXG4gIH1cclxuICB0aGlzLmxpc3RlbmVyc1tpZF0ucHVzaChjYWxsYmFjayk7XHJcbn07XHJcblxyXG4vLyBSZW1vdmUgYSBmdW5jdGlvbiBmcm9tIGxpc3RlbmVycy5cclxuVGlsZUV2ZW50cy5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0aWxlLCBjYWxsYmFjaykge1xyXG4gIC8vIGJvZHkuLi5cclxufTtcclxuXHJcbi8vIEdldCBwbGF5ZXIgbG9jYXRpb24uXHJcblRpbGVFdmVudHMucHJvdG90eXBlLl9sb2MgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4ge1xyXG4gICAgeDogdGFncHJvLnBsYXllcnNbdGFncHJvLnBsYXllcklkXS54LFxyXG4gICAgeTogdGFncHJvLnBsYXllcnNbdGFncHJvLnBsYXllcklkXS55XHJcbiAgfTtcclxufTtcclxuXHJcbi8vIEZ1bmN0aW9uIHJ1biBpbiBhbiBpbnRlcnZhbC5cclxuVGlsZUV2ZW50cy5wcm90b3R5cGUuX2ludGVydmFsID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGxvYyA9IHRoaXMuX2xvYygpO1xyXG4gIHZhciBuZXdUaWxlcyA9IFtdO1xyXG4gIHRoaXMudGlsZXMuZm9yRWFjaChmdW5jdGlvbiAodGlsZSkge1xyXG4gICAgdmFyIGluX3ZpZXcgPSAoTWF0aC5hYnModGlsZS53b3JsZF9sb2MueCAtIGxvYy54KSA8IHRoaXMucmFuZ2UueCAmJlxyXG4gICAgICBNYXRoLmFicyh0aWxlLndvcmxkX2xvYy55IC0gbG9jLnkpIDwgdGhpcy5yYW5nZS55KTtcclxuICAgIGlmIChpbl92aWV3ICYmICF0aWxlLmluX3ZpZXcpIHtcclxuICAgICAgbmV3VGlsZXMucHVzaCh0aWxlKTtcclxuICAgICAgdGlsZS5pbl92aWV3ID0gdHJ1ZTtcclxuICAgIH0gZWxzZSBpZiAoIWluX3ZpZXcgJiYgdGlsZS5pbl92aWV3KSB7XHJcbiAgICAgIG5ld1RpbGVzLnB1c2godGlsZSk7XHJcbiAgICAgIHRpbGUuaW5fdmlldyA9IGZhbHNlO1xyXG4gICAgfSBcclxuICB9LCB0aGlzKTtcclxuICBuZXdUaWxlcy5mb3JFYWNoKGZ1bmN0aW9uICh0aWxlKSB7XHJcbiAgICAvLyB0b2RvOiBhZGQgYnVmZmVyP1xyXG4gICAgXHJcbiAgICB2YXIgdmFsID0gdGFncHJvLm1hcFt0aWxlLmxvYy54XVt0aWxlLmxvYy55XTtcclxuICAgIHZhciBldmVudCA9IHtcclxuICAgICAgeDogdGlsZS5sb2MueCxcclxuICAgICAgeTogdGlsZS5sb2MueSxcclxuICAgICAgdjogdmFsLFxyXG4gICAgICB2aXNpYmxlOiB0aWxlLmluX3ZpZXdcclxuICAgIH07XHJcbiAgICAvLyBOb3RpZnkgY2FsbGJhY2tzLlxyXG4gICAgdGhpcy5saXN0ZW5lcnNbdGlsZS5pZF0uZm9yRWFjaChmdW5jdGlvbiAobGlzdGVuZXIpIHtcclxuICAgICAgbGlzdGVuZXIoZXZlbnQpO1xyXG4gICAgfSk7XHJcbiAgfSwgdGhpcyk7XHJcbn07XHJcbiJdfQ==
