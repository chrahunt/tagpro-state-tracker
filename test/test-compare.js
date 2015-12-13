var expect = require('chai').expect;
var Solver = require('../src/solver');

var Compare = require('../src/compare');

describe("Compare", function () {
  describe("equality", function () {
    it("should consider close points equal", function () {
      var cmp = new Compare(1);
      var tests = [
        [-0.4, 0.4],
        [0, 0.9],
        [-0.9, 0]
      ];
      tests.forEach(function (test) {
        expect(cmp.eq(test[0], test[1])).to.be.true;
        expect(cmp.eq(test[1], test[0])).to.be.true;
      });
    });
    
    it("should consider far points inequal", function () {
      var cmp = new Compare(1);
      var tests = [
        [-0.5, 0.5],
        [0, 5],
        [-1, 0]
      ];
      tests.forEach(function (test) {
        expect(cmp.eq(test[0], test[1])).to.be.false;
        expect(cmp.eq(test[1], test[0])).to.be.false;
      });
    });
  });

  describe("less than", function () {
    it("should consider a < b if a < b + epsilon", function () {
      var cmp = new Compare(1);
      var tests = [
        [1, 2],
        [3.5, 3],
        [-3, -3.5]
      ];
      tests.forEach(function (test) {
        expect(cmp.lt(test[0], test[1])).to.be.true;
      });
    });

    it("should not consider a < b if a > b + epsilon", function () {
      var cmp = new Compare(1);
      var tests = [
        [5, 3],
        [2, 0],
        [-2, -3.5]
      ];
      tests.forEach(function (test) {
        expect(cmp.lt(test[0], test[1])).to.be.false;
      });
    });
  });

  describe("greater than", function () {
    it("should consider a > b if a + epsilon > b");

    it("should not consider a > b if a + epsilon < b");
  });
});
