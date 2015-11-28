function Vec2(x, y) {
    this.x = x;
    this.y = y;
}

module.exports = Vec2;

Vec2.toString = function(v) {
    return "(" + v.x + "," + v.y + ")";
};

// TODO: Exception handling, format validation.
Vec2.fromString = function(s) {
    var coords = s.slice(1, -1).split(',').map(Number);
    return new Vec2(coords[0], coords[1]);
};

Vec2.prototype.add = function(v, returnNew) {
    if (returnNew) {
        return new Vec2(this.x + v.x, this.y + v.y);
    } else {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
};

Vec2.prototype.addc = function(c, returnNew) {
    if (returnNew) {
        return new Vec2(this.x + c, this.y + c);
    } else {
        this.x += c;
        this.y += c;
        return this;
    }
};

Vec2.prototype.sub = function(v, returnNew) {
    if (returnNew) {
        return new Vec2(this.x - v.x, this.y - v.y);
    } else {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
};

Vec2.prototype.subc = function(c, returnNew) {
    if (returnNew) {
        return new Vec2(this.x - c, this.y - c);
    } else {
        this.x -= c;
        this.y -= c;
        return this;
    }
};

Vec2.prototype.mul = function(v, returnNew) {
    if (returnNew) {
        return new Vec2(this.x * v.x, this.y * v.y);
    } else {
        this.x *= v.x;
        this.y *= v.y;
        return this;
    }
};

Vec2.prototype.mulc = function(c, returnNew) {
    if (returnNew) {
        return new Vec2(this.x * c, this.y * c);
    } else {
        this.x *= c;
        this.y *= c;
        return this;
    }
};

Vec2.prototype.div = function(v, returnNew) {
    if (returnNew) {
        return new Vec2(this.x / v.x, this.y / v.y);
    } else {
        this.x /= v.x;
        this.y /= v.y;
        return this;
    }
};

Vec2.prototype.divc = function(c, returnNew) {
    if (returnNew) {
        return new Vec2(this.x / c, this.y / c);
    } else {
        this.x /= c;
        this.y /= c;
        return this;
    }
};

Vec2.prototype.dot = function(v) {
    return this.x * v.x + this.y * v.y;
};

Vec2.prototype.cross = function(v) {
    return this.x * v.y - this.y * v.x;
};

Vec2.prototype.len = function() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
};

Vec2.prototype.angle = function() {
    return Math.atan2(this.y, this.x);
};

Vec2.prototype.norm = function(returnNew) {
    var len = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    if (returnNew) {
        return new Vec2(this.x / len, this.y / len);
    } else {
        this.x /= len;
        this.y /= len;
    }
};

Vec2.prototype.lt = function(v) {
    return this.x < v.x && this.y < v.y;
};

Vec2.prototype.lte = function(v) {
    return this.x <= v.x && this.y <= v.y;
};

Vec2.prototype.gt = function(v) {
    return this.x > v.x && this.y > v.y;
};

Vec2.prototype.gte = function(v) {
    return this.x >= v.x && this.y >= v.y;
};

Vec2.prototype.eq = function(v) {
    return this.x === v.x && this.y === v.y;
};

Vec2.prototype.neq = function(v) {
    return this.x !== v.x || this.y !== v.y;
};

Vec2.prototype.clone = function() {
    return new Vec2(this.x, this.y);
};

Vec2.prototype.abs = function(returnNew) {
    if (returnNew) {
        return new Vec2(Math.abs(this.x), Math.abs(this.y));
    } else {
        this.x = Math.abs(this.x);
        this.y = Math.abs(this.y);
        return this;
    }
};

Vec2.prototype.max = function(c) {
    return new Vec2(Math.max(this.x, c), Math.max(this.y, c));
};

Vec2.prototype.dist = function(v) {
  return Math.sqrt(Math.pow(v.x - this.x, 2) + Math.pow(v.y - this.y, 2));
};

Vec2.prototype.toString = function() {
  return "(" + this.x + "," + this.y + ")";
};
