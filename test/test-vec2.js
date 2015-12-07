var expect = require('chai').expect;
var Vec2 = require('../src/vec2');

describe("Vec2", function() {
  it("should construct vector from string", function() {
    var data = [
      { s: "(  1,  1)", x: 1, y: 1 },
      { s: "( -1,  1)", x: -1, y: 1 },
      { s: "(  1, -1)", x: 1, y: -1 },
      { s: "(0.5,  1)", x: 0.5, y: 1 },
      { s: "(  1,0.5)", x: 1, y: 0.5 },
      { s: "(  1,  1)", x: 1, y: 1 },
    ];
    data.forEach(function (experiment) {
      var vec = Vec2.fromString(experiment.s);
      expect(vec.x).to.equal(experiment.x);
      expect(vec.y).to.equal(experiment.y);
    });
  });

  describe("addition", function() {
    it("should add two vectors", function() {
      // Adding two vectors.
      var vec1 = Vec2.fromString("(1,0)");
      var vec2 = Vec2.fromString("(0,2)");
      vec1.add(vec2);
      expect(vec1.x).to.equal(1);
      expect(vec1.y).to.equal(2);
    });

    it("should add a vector and a constant", function() {

    });

    it("should add a vector and ")
  });
  it("should add", function() {
    

    // Adding vector with constant.
    
    // Adding two vectors and returning new.
    // Adding vector with constant and returning new.
  });

  it("should subtract");

  it("should multiply");

  it("should compute the dot product");

  it("should compute the cross product");

  it("should calculate length");

  it("should give angles");

  it("should give a norm");

  it("should compute distances");

  it("should be serializable");

  it("should be comparable");
});
