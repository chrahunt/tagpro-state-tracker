var Solver = require('../src/solver');

var p_1 = "p_1",
    p_2 = "p_2",
    p_3 = "p_3";
var solver = new Solver([p_1, p_2, p_3]);

var t = Date.now();

solver.setObserved([p_1, p_2, p_3]);
solver._time = t + 5e3;
solver.addObservation({
  variable: p_1,
  state: false,
  time: t + 5e3
});

var result = solver.getState();
if (!result[p_1].state && result[p_1].time === t + 65e3 &&
    result[p_2].state &&
    result[p_3].state) {
  console.log("PASS: Test 1.");
} else {
  console.log("FAIL: Test 1.");
}

solver = new Solver([p_1, p_2, p_3]);
solver.setObserved([p_1, p_2]);
solver._time = t + 5e3;
solver.addHypothesis({
  state: false,
  time: t + 5e3
});

result = solver.getState();
if (result[p_1].state &&
    result[p_2].state &&
    !result[p_3].state && result[p_3].time === t + 65e3) {
  console.log("PASS: Test 2.");
} else {
  console.log("FAIL: Test 2.");
}

solver = new Solver([p_1, p_2, p_3]);
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
if (result[p_1].state &&
    !result[p_2].state && result[p_2].time === t + 30e3 &&
    !result[p_3].state && result[p_3].time === t + 60e3) {
  console.log("PASS: Test 3.");
} else {
  console.log("FAIL: Test 3.");
}

solver = new Solver([p_1, p_2, p_3]);
solver._time = t - 80e3;
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
result = solver.getState();
if (!result[p_1].state && result[p_1].time === t + 30e3 &&
    result[p_2].state === null &&
    result[p_3].state === null) {
  console.log("PASS: Test 4.");
} else {
  console.log("FAIL: Test 4.");
}
solver._time = t + 1;
solver.addObservation({
  variable: p_2,
  time: t + 1,
  state: true
});
var result = solver.getState();
if (!result[p_1].state && result[p_1].time === t + 30e3 &&
    result[p_2].state &&
    !result[p_3].state && result[p_3].time === t + 60e3) {
  console.log("PASS: Test 5.");
} else {
  console.log("FAIL: Test 5.");
}

solver = new Solver([p_1, p_2, p_3]);
solver.addHypothesis({
  state: false,
  time: t
});

solver._time = t + 1;
solver.addAssertion({
  variable: p_2,
  state: false
});

var result = solver.getState();
if (result[p_1].state &&
    !result[p_2].state && result[p_2].time === t + 60e3 &&
    result[p_3].state) {
  console.log("PASS: Test 6.");
} else {
  console.log("FAIL: Test 6.");
}

// Non-true start.
solver = new Solver([p_1, p_2, p_3]);
