// Time for state to change back.
var STATE_CHANGE = 6e4;
// Possible notification lag.
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
              out_variable.time.push(change);
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

// Like an observation except probably more powerful.
Solver.prototype.addAssertion = function(o) {
  this.updateVariables();
  var self = this;
  this.states = this.states.filter(function (state) {
    return self.checkAssertion(state, o);
  });
};

Solver.prototype.checkAssertion = function(state, assertion) {
  var variable = state[assertion.variable];
  return variable.state === assertion.state;
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
