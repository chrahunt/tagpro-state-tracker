module.exports = Animate;
/**
 * Run provided function in animation frame.
 * @param {Function} fn [description]
 * @param {boolean} [start=true] - Whether to start the animation loop.
 */
function Animate(fn, start) {
  if (!(this instanceof Animate))
    return new Animate(fn, start);
  if (typeof start == "undefined") start = true;
  this.stopped = !start;
  this.fn = fn;
  if (!this.stopped) {
    this._loop();
  }
}

/**
 * Loop execute the function.
 * @private
 */
Animate.prototype._loop = function() {
  if (!this.stopped) {
    requestAnimationFrame(this._loop.bind(this));
    this.fn();
  }
};

/**
 * Start the animation loop, if not done already.
 */
Animate.prototype.start = function() {
  if (this.stopped) {
    this.stopped = false;
    this._loop();
  }
};

/**
 * Stop the animation, 
 */
Animate.prototype.stop = function() {
  this.stopped = true;
};
