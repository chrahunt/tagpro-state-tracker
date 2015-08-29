var Point = require("./vec2");

/**
 * Edges are used to represent the border between two adjacent
 * polygons. Can be called 2 ways.
 * @constructor
 * @example <caption>Constructing from Point objects.</caption>
 *   var e = new Edge(p1, p2)
 * @example <caption>From an array of values.</caption>
 *   var e = new Edge([x1, y1, x2, y2])
 */
function Line(p1, p2) {
  if (Array.isArray(p1)) {
    var points = p1;
    this.p1 = new Point(points[0], points[1]);
    this.p2 = new Point(points[2], points[3]);
  } else {
    this.p1 = p1.clone();
    this.p2 = p2.clone();
  }
}

module.exports = Line;

Line.prototype._CCW = function(p1, p2, p3) {
  a = p1.x; b = p1.y;
  c = p2.x; d = p2.y;
  e = p3.x; f = p3.y;
  return (f - b) * (c - a) > (d - b) * (e - a);
};

/**
 * from http://stackoverflow.com/a/16725715
 * Checks whether this edge intersects the provided edge.
 * @param {Edge} edge - The edge to check intersection for.
 * @return {boolean} - Whether or not the edges intersect.
 */
Line.prototype.intersects = function(line) {
  var q1 = line.p1, q2 = line.p2;
  if (q1.eq(this.p1) || q1.eq(this.p2) || q2.eq(this.p1) || q2.eq(this.p2)) return false;
  return (this._CCW(this.p1, q1, q2) != this._CCW(this.p2, q1, q2)) &&
    (this._CCW(this.p1, this.p2, q1) != this._CCW(this.p1, this.p2, q2));
};

/**
 * Returns point of intersection, or null if the edges do not
 * intersect.
 * @param {Line} line - The other line to use.
 * @return {Vec2?} - The point of intersection, or null if the edges
 *   do not intersect or if colinear.
 */
Line.prototype.intersection = function(line) {
  var p = this.p1.clone(),
      r = this.p2.sub(this.p1, true),
      q = line.p1.clone(),
      s = line.p2.sub(line.p1, true);
  var denominator = r.cross(s);
  if (denominator !== 0) {
    q.sub(p);
    var t = q.cross(s) / denominator,
        u = q.cross(r) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return p.add(r.mulc(t));
    } else {
      // Don't intersect.
      return null;
    }
  } else {
    // Colinear or parallel.
    return null;
  }
};

/**
 * Translate edge along a vector.
 * @param {Vec2} v - The vector to translate along.
 * @return {Line} - The translated edge.
 */
Line.prototype.translate = function(v, returnNew) {
  if (returnNew) {
    return new Line(this.p1.add(v, true), this.p2.add(v, true));
  } else {
    this.p1.add(v);
    this.p2.add(v);
    return this;
  }
};

/**
 * Scale edge by given value.
 * @param {number} c - Value to scale edge points by.
 * @return {Line} - The scaled edge.
 */
Line.prototype.scale = function(c, returnNew) {
  if (returnNew) {
    return new Line(this.p1.mulc(c, true), this.p2.mulc(c, true));
  } else {
    this.p1.mulc(c);
    this.p2.mulc(c);
    return this;
  }
};

Line.prototype.clone = function() {
  return new Line(this.p1.clone(), this.p2.clone());
};
