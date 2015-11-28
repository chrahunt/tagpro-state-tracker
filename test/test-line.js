var expect = require("chai").expect;
var Line = require("../src/line");
var Vec2 = require("../src/vec2");

describe("Line", function() {
  it("should be initializable from array and Vec2 \"points\"", function() {
    var p1 = new Vec2(0, 1);
    var p2 = new Vec2(2, 3);
    var line1 = new Line(p1, p2);
    expect(line1.p1.x).to.equal(0);
    expect(line1.p1.y).to.equal(1);
    expect(line1.p2.x).to.equal(2);
    expect(line1.p2.y).to.equal(3);
    var line2 = new Line([0, 1, 2, 3]);
    expect(line2.p1.x).to.equal(0);
    expect(line2.p1.y).to.equal(1);
    expect(line2.p2.x).to.equal(2);
    expect(line2.p2.y).to.equal(3);
  });

  it("should calculate intersection");
  it("should be translatable");
  it("should be scalable");
});
