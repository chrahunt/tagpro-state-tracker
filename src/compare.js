module.exports = Compare;

/**
 * eps should be positive
 */
function Compare(eps) {
  this.epsilon = eps;
}

Compare.prototype.gt = function(a, b) {
  return b - a < this.epsilon;
};

Compare.prototype.lt = function(a, b) {
  return a - b < this.epsilon;
};

Compare.prototype.eq = function(a, b) {
  return Math.abs(a - b) < this.epsilon;
};
