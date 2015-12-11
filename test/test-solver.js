var expect = require('chai').expect;
var Solver = require('../src/solver');

describe('Solver', function() {
  var t = Date.now();
  var p_1 = "p_1",
      p_2 = "p_2",
      p_3 = "p_3";

  // Create solver with all three variables true.
  function allTrueInit(time) {
    if (typeof time == "undefined") time = t;
    return new Solver([
      { name: p_1, state: "present" },
      { name: p_2, state: "present" },
      { name: p_3, state: "present" }
    ], {
      time: time,
      observedStart: true
    });
  }

  function AllVariablesExist(state) {
    return [p_1, p_2, p_3].every(function (v) {
      return state.hasOwnProperty(v);
    });
  }

  it("should work in trivial case", function() {
    var solver = allTrueInit();
    var result = solver.getState();
    expect(result[p_1].state).to.equal("present");
    expect(result[p_2].state).to.equal("present");
    expect(result[p_3].state).to.equal("present");
  });

  it("requires variables are observed in order to add observation", function() {
    var solver = allTrueInit();
    var update = function() {
      solver.addObservation(p_1, "absent", t);
    };

    expect(update).to.throw(Error);
  });

  it("cannot accept notification that is not \"absent\"", function() {
    var solver = allTrueInit();
    var update = function() {
      solver.addNotification({
        state: false,
        time: t
      });
    };
    expect(update).to.throw(Error);
  });

  it("cannot accept update that is not one of \"absent\" or \"present\"", function() {
    var solver = allTrueInit();
    var update = function() {
      solver.setObserved([p_1]);
      solver.addObservation(p_1, false, t);
    };

    expect(update).to.throw(Error);
  });

  it("should recognize a visible changed variable", function() {
    var solver = allTrueInit();
    solver.setObserved([p_1, p_2]);
    solver._time = t + 5e3;
    solver.addObservation(p_1, "absent", t + 5e3);

    var result = solver.getState();
    expect(result[p_1].state).to.equal("absent");
    expect(result[p_1].time).to.equal(t + 65e3);
    expect(result[p_2].state).to.equal("present");
  });

  it("should change the only unobserved variable", function() {
    var solver = allTrueInit();
    solver.setObserved([p_1, p_2]);
    solver._time = t + 5e3;
    solver.addNotification({
      state: "absent",
      time: t + 5e3
    });

    var result = solver.getState();
    expect(result[p_1].state).to.equal("present");
    expect(result[p_2].state).to.equal("present");
    expect(result[p_3].state).to.equal("absent");
    expect(result[p_3].time).to.equal(t + 65e3);
  });

  it("should not apply hypotheses to known or observed variables", function() {
    var solver = allTrueInit(t - 30e3);
    solver.setObserved([p_2]);
    solver.addObservation(p_2, "absent", t - 30e3);
    solver._time = t - 15e3;
    solver.setObserved([p_1]);
    solver._time = t;
    solver.addNotification({
      state: "absent",
      time: t
    });

    var result = solver.getState();

    expect(result[p_1].state).to.equal("present");
    expect(result[p_2].state).to.equal("absent");
    expect(result[p_2].time).to.equal(t + 30e3);
    expect(result[p_3].state).to.equal("absent");
    expect(result[p_3].time).to.equal(t + 60e3);
  });

  it("should handle direct change observations correctly if within epsilon before", function() {
    var solver = allTrueInit(t - 60e3);
    solver.setObserved([p_1]);
    solver.addObservation(p_1, "absent", t - 60e3);
    solver._time = t - 1e3;
    solver.addObservation(p_1, "present", t - 1e3);
    var result = solver.getState();
    expect(AllVariablesExist(result)).to.be.true;
    expect(result[p_1].state).to.equal("present");
    expect(result[p_2].state).to.equal("present");
    expect(result[p_3].state).to.equal("present");
  });

  it("should handle respawn observations correctly if within epsilon after", function() {
    var solver = allTrueInit(t - 60e3);
    solver.setObserved([p_1]);
    solver.addObservation(p_1, "absent", t - 60e3);
    solver._time = t + 1e3;
    solver.addObservation(p_1, "present", t + 1e3);
    var result = solver.getState();
    expect(result[p_1].state).to.equal("present");
    expect(result[p_2].state).to.equal("present");
    expect(result[p_3].state).to.equal("present");
  });

  it("should not resolve ambiguous situations involving unobserved active variables", function() {
    var solver = allTrueInit(t - 80e3);
    solver.setObserved([p_3]);
    solver.addObservation(p_3, "absent", t - 80e3);
    solver.setObserved([p_2]);
    solver._time = t - 75e3;
    solver.addObservation(p_2, "absent", t - 75e3);
    solver.setObserved([p_1]);
    solver._time = t - 30e3;
    solver.addObservation(p_1, "absent", t - 30e3);
    solver.setObserved([]);
    solver._time = t;
    solver.addNotification({
      state: "absent",
      time: t
    });
    var result = solver.getState();
    expect(result[p_1].state).to.equal("absent");
    expect(result[p_1].time).to.equal(t + 30e3);
    expect(result[p_2].state).to.equal("unknown");
    expect(result[p_3].state).to.equal("unknown");
  });

  it("should resolve ambiguous situations when more information is available", function() {
    /*
     T - 80: p_3 seen non-present
     T - 75: p_2 seen non-present
     T - 30: p_1 seen non-present
     T     : change notification
     T +  1: p_2 seen present
     => p_3 not present, p_2 present, p_1
     */
    var solver = allTrueInit(t - 80e3);
    solver.setObserved([p_3]);
    solver.addObservation(p_3, "absent", t - 80e3);
    solver.setObserved([p_2]);
    solver._time = t - 75e3;
    solver.addObservation(p_2, "absent", t - 75e3);
    solver.setObserved([p_1]);
    solver._time = t - 30e3;
    solver.addObservation(p_1, "absent", t - 30e3);
    solver.setObserved([]);
    solver._time = t;
    solver.addNotification({
      state: "absent",
      time: t
    });
    // Observation that resolves ambiguity.
    solver.setObserved([p_2]);
    solver._time = t + 1;
    solver.addObservation(p_2, "present");
    var result = solver.getState();
    expect(result[p_1].state).to.equal("absent");
    expect(result[p_1].time).to.equal(t + 30e3);
    expect(result[p_2].state).to.equal("present");
    expect(result[p_3].state).to.equal("absent");
    expect(result[p_3].time).to.equal(t + 60e3);
  });

  it("should resolve ambiguous situations when enough time passes", function() {
    var solver = allTrueInit();
    solver._time = t;
    solver.addNotification({
      state: "absent",
      time: t
    });
    solver._time = t + 5e3;
    solver.addNotification({
      state: "absent",
      time: t + 5e3
    });
    solver._time = t + 10e3;
    solver.addNotification({
      state: "absent",
      time: t + 10e3
    });
    solver._time = t + 75e3;
    var result = solver.getState();
    expect(result[p_1].state).to.equal("present");
    expect(result[p_2].state).to.equal("present");
    expect(result[p_3].state).to.equal("present");
  });

  describe("with initially unknown variable states", function() {
    it("should recognize that an initially-unknown variable will change back after a given time", function() {
      var solver = new Solver([
        { name: p_1, state: "unknown" }
      ], {
        time: t,
        observedStart: true
      });
      solver._time = t + 65e3;
      var result = solver.getState();
      expect(result[p_1].state).to.equal("present");
    });

    it("should be able to update an initially unknown variable", function() {
      var solver = new Solver([
        { name: p_1, state: "unknown" }
      ], {
        time: t,
        observedStart: true
      });
      solver._time = t + 1e3;
      solver.setObserved([p_1]);
      solver.addObservation(p_1, "present");
      var result = solver.getState();
      expect(result[p_1].state).to.equal("present");
    });

    it("should handle case where hypothesis actually applies to initially unknown variable", function() {
      var solver = new Solver([
        { name: p_1, state: "present" },
        { name: p_2, state: "present" },
        { name: p_3, state: "unknown" }
      ], {
        time: t,
        observedStart: true
      });
      solver.setObserved([p_1]);
      solver._time = t + 5e3;
      solver.addNotification({
        state: "absent",
        time: t + 5e3
      });
      solver.setObserved([p_2]);
      solver._time = t + 10e3;
      solver.addObservation(p_2, "present");
      var result = solver.getState();
      expect(result[p_1].state).to.equal("present");
      expect(result[p_2].state).to.equal("present");
      expect(result[p_3].state).to.equal("absent");
      expect(result[p_3].time).to.equal(t + 65e3);
    });

    it("should not assume an end to variable state when unknown start", function() {
      var solver = new Solver([
        { name: p_1, state: "unknown" }
      ], {
        time: t,
        observedStart: true
      });
      solver.setObserved([p_1]);
      solver.addObservation(p_1, "absent");
      var result = solver.getState();
      expect(result[p_1].state).to.equal("absent");
      expect(result[p_1].time).to.be.null;
    });

    it("should not assume an end to an unknown variable state when other variables are observed");
  });

  it("should not crash with many unresolved hypotheses");
});
