var expect = require('chai').expect;
var Solver = require('../src/solver');

describe('Solver', function() {
  var t = Date.now();
  var p_1 = "p_1",
      p_2 = "p_2",
      p_3 = "p_3";

  // Create solver with all three variables true.
  function allTrueInit() {
    return new Solver([
      { name: p_1, state: true },
      { name: p_2, state: true },
      { name: p_3, state: true }
    ]);
  }

  it("should recognize a visible changed variable", function() {
    var solver = allTrueInit();
    solver.setObserved([p_1, p_2, p_3]);
    solver._time = t + 5e3;
    solver.addObservation({
      variable: p_1,
      state: false,
      time: t + 5e3
    });

    var result = solver.getState();
    expect(result[p_1].state).to.be.false;
    expect(result[p_1].time).to.equal(t + 65e3);
    expect(result[p_2].state).to.be.true;
    expect(result[p_3].state).to.be.true;
  });

  it("should change the only unobserved variable", function() {
    var solver = allTrueInit();
    solver.setObserved([p_1, p_2]);
    solver._time = t + 5e3;
    solver.addHypothesis({
      state: false,
      time: t + 5e3
    });

    var result = solver.getState();
    expect(result[p_1].state).to.be.true;
    expect(result[p_2].state).to.be.true;
    expect(result[p_3].state).to.be.false;
    expect(result[p_3].time).to.equal(t + 65e3);
  });

  it("should not apply hypotheses to known variables", function() {
    var solver = allTrueInit();
    solver.setObserved([p_1]);
    solver._time = t - 30e3;
    solver.addObservation({
      variable: p_2,
      time: t - 30e3,
      state: false
    });
    solver._time = t;
    solver.addHypothesis({
      state: false,
      time: t
    });

    var result = solver.getState();

    expect(result[p_1].state).to.be.true;
    expect(result[p_2].state).to.be.false;
    expect(result[p_2].time).to.equal(t + 30e3);
    expect(result[p_3].state).to.be.false;
    expect(result[p_3].time).to.equal(t + 60e3);
  });

  it("should not resolve ambiguous situations involving unobserved active variables", function() {
    var solver = allTrueInit();
    solver.addObservation({
      variable: p_3,
      time: t - 80e3,
      state: false
    });
    solver._time = t - 75e3;
    solver.addObservation({
      variable: p_2,
      time: t - 75e3,
      state: false
    });
    solver._time = t - 30e3;
    solver.addObservation({
      variable: p_1,
      time: t - 30e3,
      state: false
    });
    solver._time = t;
    solver.addHypothesis({
      state: false,
      time: t
    });
    var result = solver.getState();
    expect(result[p_1].state).to.be.false;
    expect(result[p_1].time).to.equal(t + 30e3);
    expect(result[p_2].state).to.be.null;
    expect(result[p_3].state).to.be.null;
  });

  it("should resolve ambiguous situations when more information is available", function() {
    var solver = allTrueInit();
    solver.addObservation({
      variable: p_3,
      time: t - 80e3,
      state: false
    });
    solver._time = t - 75e3;
    solver.addObservation({
      variable: p_2,
      time: t - 75e3,
      state: false
    });
    solver._time = t - 30e3;
    solver.addObservation({
      variable: p_1,
      time: t - 30e3,
      state: false
    });
    solver._time = t;
    solver.addHypothesis({
      state: false,
      time: t
    });
    // Observation that resolves ambiguity.
    solver._time = t + 1;
    solver.addObservation({
      variable: p_2,
      time: t + 1,
      state: true
    });
    var result = solver.getState();
    expect(result[p_1].state).to.be.false;
    expect(result[p_1].time).to.equal(t + 30e3);
    expect(result[p_2].state).to.be.true;
    expect(result[p_3].state).to.be.false;
    expect(result[p_3].time).to.equal(t + 60e3);
  });

  it("should be able to handle non-present start");

  it("should not crash with many unresolved hypotheses");
});
