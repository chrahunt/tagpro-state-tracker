var Compare = require('./compare');

// Possible notification lag.
var compare = new Compare(2e3);

// Object clone.
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = Solver;

/**
 * ms timestamp, e.g. output of `Date.now()`
 * @typedef {integer} timestamp
 */
/**
 * @typedef {object} Variable
 * @property {string} name - The name of the variable.
 * @property {string} [state="unknown"] - The initial state of the variable, one
 *   of "present", "absent", or "unknown".
 */
/**
 * @typedef {object} SolverOptions
 * @property {integer} [interval=60e3] - Interval (in ms) after which a
 *   variable changes state back to present.
 * @property {timestamp} [time=Date.now()] - (test only) Current time
 *   to use for the solver, nonzero.
 * @property {boolean} [observedStart=false] - (test only) Whether the
 *   states given with the variables should be used.
 * @property {boolean} [debug=false] - Set debug options, toggles logging
 *   and observation/notification storage.
 */
/**
 * Solver solves boolean dynamic state. Must have known initial states, even
 * with unknown taken times.
 * @param {Array.<Variable>} variables - array of variable names.
 */
function Solver(variables, options) {
  if (typeof options == "undefined") options = {};
  
  // Used for testing, nonzero.
  this._time = options.time || 0;
  // Allows interval of 0.
  this._state_change_interval = options.hasOwnProperty("interval") ? options.interval
                                                                   : 60e3;
  this._debug = options.debug || false;
  this.variables = {};
  this.states = [];
  var state = {};
  var time = this._time || Date.now();
  var self = this;

  variables.forEach(function (variable) {
    var name = variable.name;
    self.variables[name] = {
      observed: false
    };
    var variable_state = variable.state || "unknown";
    var status = options.observedStart ? variable_state
                                       : "unknown";
    state[name] = {
      id: name,
      state: status,
      start: time,
      end: null
    };
  });
  this.states.push(state);
}

/**
 * Set some variables as observed. Any variables not provided are
 * assume not observed.
 * @param {Array.<string>} variables - the names of the variables
 *   to set as observed.
 */
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
  this._log("Variables observed: %s", variables.length !== 0 ? variables.join("; ")
                                                             : "none");
};

/**
 * Inform solver that a variable changed.
 * @param {timestamp} time - when the variable changed.
 */
Solver.prototype.addNotification = function(time) {
  this._log("Notified: %d", time);
  this.updateVariables();
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newStates = this.generateStates(this.states[i], time);
    if (newStates)
      Array.prototype.push.apply(states, newStates);
  }
  this.states = states;
};

/**
 * Generate possible successor states to a given state, given a
 * notification that something changed.
 * @private
 * @param {VariableState} state - the state to generate successors for.
 * @param {timestamp} time - when the change occurred.
 * @return {Array.<VariableState>?} - returns array of successor states,
 *   or null if no successor states were possible.
 */
Solver.prototype.generateStates = function(state, time) {
  var states = [];
  for (var name in state) {
    // Skip observed variables, they could not have been changed.
    if (this.variables[name].observed)
      continue;
    var newState = clone(state);
    var variable = newState[name];

    if (variable.state === "present") {
      // Change in observed variable true -> false
      variable.state = "absent";
      variable.start = time;
      variable.end = time + this._state_change_interval;
    } else if (variable.state === "unknown") {
      // Status of variable not known. Generate possibilities.
      variable.state = "absent";
      variable.start = time;
      variable.end = time + this._state_change_interval;
    } else if (variable.state === "absent") {
      newState = null;
      // already taken?
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

/**
 * An observation is a known state based on visible information.
 * If the observation is current (the indicated change is something
 * that just occurred), then time is required.
 * @param {string} variable - the name of the variable to update.
 * @param {boolean} state - the state to update the variable to.
 * @param {timestamp} [time] - the time the state changed, if current.
 * @throws {Error} If the given variable is not currently observed.
 */
Solver.prototype.addObservation = function(variable, state, time) {
  this.updateVariables();
  if (!this.variables[variable].observed)
    throw new Error("Variable must be observed to add observation.");
  if (state !== "present" && state !== "absent")
    throw new Error("Update must be either \"present\" or \"absent\".");
  var o = {
    variable: variable,
    state: state
  };
  if (typeof time !== "undefined") o.time = time;
  this._log("Observed v:%s s:%s t:%s", o.variable, o.state, o.time);
  // Generate successor states based on observation.
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newState = this.applyObservation(this.states[i], o);
    if (newState)
      states.push(newState);
  }
  this.states = states;
};

// Given a variable state, return the variable state id.
Solver.prototype.getStateId = function(state) {
  var id = "";
  if (state.state === "present") {
    id += "present:";
    id += this.variables[state.id].observed ? "observed"
                                            : "unobserved";
  } else if (state.state === "absent") {
    id += "absent:";
    id += state.end === null ? "unknown"
                             : "known";
  } else if (state.state === "unknown") {
    id += "unknown";
  }
  return id;
};

function getObservationId(obs) {
  var id = obs.state;
  if (obs.hasOwnProperty("time")) {
    id += ":time";
  }
  return id;
}

function getChangeTime(v) {
  return v.end;
}

/**
 * Return state with observation applied or null if invalid.
 * @private
 * @param {object} state
 * @param {object} observation
 */
Solver.prototype.applyObservation = function(state, observation) {
  var self = this;
  function setPresent(v) {
    v.state = "present";
    v.start = Date.now();
    v.end = null;
  }
  function setAbsent(v, time) {
    if (typeof time == "undefined") time = null;
    v.state = "absent";
    if (time !== null) {
      v.start = time;
      v.end = time + self._state_change_interval;
    } else {
      v.start = Date.now();
      v.end = null;
    }
  }
  var Actions = {
    keep: "keep",
    drop: "drop"
  };
  var current = state[observation.variable];
  var stateId = this.getStateId(current);
  var observationId = getObservationId(observation);
  var action = null;

  if (stateId == "unknown") {
    if (observationId == "present") {
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "present:time") {
      // tag: weird
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "absent") {
      setAbsent(current);
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  } else if (stateId == "absent:unknown") {
    if (observationId == "present") {
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "present:time") {
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "absent") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      // tag: weird
      // desc: perfect grab might result in this
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  } else if (stateId == "absent:known") {
    if (observationId == "present") {
      if (compare.eq(getChangeTime(current), Date.now())) {
        setPresent(current);
        action = Actions.keep;
      } else {
        action = Actions.drop;
      }
    } else if (observationId == "present:time") {
      if (compare.eq(getChangeTime(current), observation.time)) {
        setPresent(current);
        action = Actions.keep;
      } else {
        action = Actions.drop;
      }
    } else if (observationId == "absent") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      // tag:weird
      // desc: perfect grab
      if (compare.eq(getChangeTime(current), observation.time)) {
        setAbsent(current, observation.time);
        action = Actions.keep;
      } else {
        action = Actions.drop;
      }
    }
  } else if (stateId == "present:observed") {
    if (observationId == "present") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "present:time") {
      // tag: weird
      action = Actions.keep;
    } else if (observationId == "absent") {
      // tag: weird
      setAbsent(current);
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  } else if (stateId == "present:unobserved") {
    if (observationId == "present") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "present:time") {
      // tag: weird
      action = Actions.keep;
    } else if (observationId == "absent") {
      // tag: weird
      setAbsent(current);
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  }

  if (action == Actions.keep) {
    return state;
  } else {
    return null;
  }
};

/**
 * Get set of possible states.
 * @private
 * @return {Array.<State>} the current possible states
 */
Solver.prototype.getStates = function() {
  this.updateVariables();
  return this.states.slice();
};

/**
 * Get consolidated state indicating known/unknown variable values.
 * @return {OutState} - State with addtl values, each variable has
 *   state (true|false|null), change (if false). change is number or
 *   array (if there is disagreement).
 */
Solver.prototype.getState = function() {
  this.updateVariables();
  if (this.states.length > 0) {
    // Construct output.
    var out = {};
    var state = this.states[0];
    for (var name in state) {
      var variable = state[name];
      if (variable.state === "present") {
        out[name] = {
          state: variable.state
        };
      } else {
        // intervals, end time
        var time = variable.end;
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
          if (out_variable.state === "absent") {
            // TODO: check undefined in case interval not updated?
            // Get end of most recent applicable interval.
            // intervals: end_time
            var change = variable.end;
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
          out_variable.state = "unknown";
          // In case it was set.
          delete out_variable.time;
        }
      }
      return out;
    }, out);
  } else {
    return null;
  }
};

/**
 * Update `false` state variables based on false end time, if present.
 * @private
 */
Solver.prototype.updateVariables = function() {
  var states = [];
  var time = this._time || Date.now();
  for (var i = 0; i < this.states.length; i++) {
    var state = clone(this.states[i]);
    for (var name in state) {
      var variable = state[name];

      // Update changeback.
      if (variable.state === "absent") {
        if (variable.end && variable.end <= time) {
          // update to true.
          variable.state = "present";
          variable.start = time;
          variable.end = null;
        } else if (variable.end === null) {
          // Near beginning of experiment, unknown variable that does not have
          // a known end time. Create a new state with a different variable that is present
          // for naive approach.
        }
      } else if (variable.state === "unknown") {
        var end = variable.start + this._state_change_interval;
        if (end <= time) {
          variable.state = "present";
          variable.start = time;
          variable.end = null;
        }
      }
    }
    states.push(state);
  }
  this.states = states;
};

/**
 * Same interface as `console.log`.
 * @private
 */
Solver.prototype._log = function() {
  if (this._debug) {
    console.log.apply(console, Array.prototype.slice.call(arguments));
  }
};
