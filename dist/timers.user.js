// ==UserScript==
// @name          TagPro Tile State Tracker
// @namespace     http://reddit.com/user/snaps_
// @description   Tracks time, so you don't have to.
// @require       https://gist.github.com/chrahunt/4843f0258c516882eea0/raw/loopback.user.js
// @downloadURL   https://github.com/chrahunt/tagpro-state-tracker/raw/master/dist/timers.user.js
// @include       http://tagpro-*.koalabeast.com:*
// @include       http://maptest*.newcompte.fr:*
// @include       http://tangent.jukejuice.com:*
// @license       MIT
// @author        snaps
// @version       0.1.0
// @run-at        document-start
// ==/UserScript==

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"_process":3,"inherits":2}],6:[function(require,module,exports){
module.exports = Animate;

/**
 * Run provided function in animation frame.
 * @param {Function} fn - Function to be executed.
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
module.exports = {
  TILE_WIDTH: 40,
  TILES: {
    powerup: {
      active: [6.1, 6.2, 6.3, 6.4],
      inactive: [6],
      id: [6]
    },
    bomb: {
      active: [10],
      inactive: [10.1],
      id: [10]
    },
    boost: {
      active: [5, 14, 15],
      inactive: [5.1, 14.1, 15.1],
      id: [5, 14, 15]
    }
  },
  RESPAWN: {
    powerup: 60e3,
    bomb: 30e3,
    boost: 10e3
  }
};

},{}],9:[function(require,module,exports){
var Point = require("./vec2");

/**
 * Edges are used to represent the border between two adjacent
 * polygons. Can be called 2 ways.
 * @constructor
 * @example <caption>Constructing from Point objects.</caption>
 *   var e = new Line(p1, p2)
 * @example <caption>From an array of values.</caption>
 *   var e = new Line([x1, y1, x2, y2])
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

/**
 * @private
 */
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
  var p = this.p1.c(),
      r = this.p2.c().sub(this.p1),
      q = line.p1.c(),
      s = line.p2.c().sub(line.p1);
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
    return new Line(this.p1.c().add(v), this.p2.c().add(v));
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
Line.prototype.scale = function(c) {
  this.p1.mulc(c);
  this.p2.mulc(c);
  return this;
};

Line.prototype.clone = function() {
  return new Line(this.p1.c(), this.p2.c());
};

},{"./vec2":18}],10:[function(require,module,exports){
var PowerupTracker = require('./powerup-tracker');
var TagPro = require('./tagpro');
var CornerSource = require('./test-tile-source');
var TileOverlay = require('./tile-overlay');
var Animate = require('./animate');
var SightTracker = require('./sight-tracker');

// Get socket immediately.
TagPro.on("socket", function (state) {
  var powerup_tracker = new PowerupTracker(state.socket);
  var overlay;
  // delay setup of other tile trackers.
  setTimeout(function tileTrackerSetup() {
    if (tagpro.map) {
      var bomb_tracker = new SightTracker({
        socket: state.socket,
        map: tagpro.map,
        tile: "bomb"
      });
      var boost_tracker = new SightTracker({
        socket: state.socket,
        map: tagpro.map,
        tile: "boost"
      });
      if (overlay) {
        overlay.addSource(bomb_tracker);
        overlay.addSource(boost_tracker);
      } else {
        setTimeout(function addTrackers() {
          if (overlay) {
            overlay.addSource(bomb_tracker);
            overlay.addSource(boost_tracker);
          } else {
            setTimeout(addTrackers, 50);
          }
        }, 50);
      }
    } else {
      setTimeout(tileTrackerSetup, 50);
    }
  });

  // Initialize overlay when user playing (instead of spectating).
  TagPro.on("user.playing", function (state) {
    console.log("User player, starting overlay.");
    powerup_tracker.start();
    overlay = new TileOverlay();
    overlay.addSource(powerup_tracker);
    Animate(function () {
      overlay.update();
    });
  });
});

// test state
/*TagPro.on("user.playing", function (state) {
  setTimeout(function init() {
    if (!tagpro.map) {
      setTimeout(init, 50);
      return;
    }
    var corners = new CornerSource(tagpro.map);
    var overlay = new TileOverlay(corners);
    window.overlay = overlay;

    Animate(function () {
      overlay.update();
    });
  }, 50);
});*/

},{"./animate":6,"./powerup-tracker":11,"./sight-tracker":12,"./tagpro":14,"./test-tile-source":15,"./tile-overlay":17}],11:[function(require,module,exports){
var Solver = require('./solver');
var TileEvents = require('./tile-events');
var Vec2 = require('./vec2');
var C = require('./constants');

module.exports = PowerupTracker;

// Interface that takes in source information and puts it into solver format.
// Must be initialized with socket prior to "map" and "time" events in initialization.
function PowerupTracker(socket) {
  var self = this;
  this.socket = socket;
  this.empty = false;
  this.seen = {};

  // handle mapupdate, tile tracking
  // Listen for player powerup grabs.
  socket.on('p', function (event) {
    // Just in case, but solver should be initialized prior to any p message.
    if (!self.hasOwnProperty("solver")) return;
    var updates = event.u || event;
    var time = Date.now();
    updates.forEach(function (update) {
      var id = update.id;
      // skip first update.
      if (self.seen[id]) {
        if (update['s-powerups']) {
          if (tagpro.players[id] && tagpro.players[id].draw) {
            // Player is visible, get powerup tile and send observation.
            var position = new Vec2(tagpro.players[id].x, tagpro.players[id].y);
            var found = false;
            for (var i = 0; i < self.powerup_locations.length; i++) {
              var powerup = self.powerup_locations[i];
              // TODO: More specific powerup finding location.
              if (position.dist(powerup) < 40) {
                var variable = self.powerups[i].toString();
                self.solver.addObservation(variable, "absent", time);
                found = true;
                break;
              }
            }
            if (!found) {
              console.error("Couldn't find adjacent powerup!");
            }
          } else if (tagpro.players[id]) {
            // Player not visible, send information.
            console.log("Sending powerup notification.");
            self.solver.addNotification(time);
          }
        }
      } else {
        self.seen[id] = true;
      }
    });
  });

  this.powerups = [];
  this.powerup_locations = [];

  if (tagpro.map || tagpro.gameEndsAt || tagpro.id) {
    console.warn("Post-initialization start, %o:%o:%o", tagpro.map, tagpro.state, tagpro.id);
    this._onMap({
      tiles: tagpro.map
    });
    if (tagpro.state === 1 && tagpro.gameEndsAt === null) {
      socket.on("time", this._onTime.bind(this));
    } else if (tagpro.state !== 1 && tagpro.gameEndsAt === null) {
      console.error("Game ended.");
    } else {
      this._onState(tagpro.state, tagpro.gameEndsAt - Date.now());
    }
  } else {
    // Do map-related initializations.
    socket.on('map', this._onMap.bind(this));

    // Updates the state of the game, occurs almost immediately after `map` message.
    socket.on("time", this._onTime.bind(this));
  }
}

PowerupTracker.prototype._onMap = function(map) {
  // Actual map values.
  map = map.tiles;
  this.map = map;
  var self = this;

  var present = [];
  // Get powerup tiles.
  map.forEach(function (row, x) {
    row.forEach(function (tile, y) {
      if (Math.floor(tile) !== 6) return;
      var powerup = new Vec2(x, y);
      self.powerups.push(powerup);
      present.push(tile == 6);
      self.powerup_locations.push(powerup.c().mulc(C.TILE_WIDTH));
    });
  });

  // Initialize solver to unknown state.
  // Game not started, assume map is true representation of powerup state.
  var variables = this.powerups.map(function (powerup, i) {
    return {
      name: powerup.toString(),
      present: present[i]
    };
  });

  this.solver = new Solver(variables, {
    debug: true
  });
};

PowerupTracker.prototype._onState = function(state, time) {
  if (state === 3 && time > 2000) {
    // Game not started and game start not close enough to be less
    // than socket timeout, then assume map is true representation
    // of powerup state.
    var variables = this.powerups.map(function (powerup, i) {
      return powerup.toString();
    });

    this.solver.setObserved(variables);
    var self = this;
    variables.forEach(function (variable) {
      self.solver.addObservation(variable, "present");
    });
    this.solver.setObserved([]);
  } else if (state === 1) {
    // Game active, don't trust map data. Let tile events naturally
    // figure out values.
    console.warn("Post game-start initialization not supported.");
  }
};

PowerupTracker.prototype._onTime = function(info) {
  console.log("Got game state: %d", info.state);
  this.socket.off("time", this._onTime);

  this._onState(info.state, info.time);
};

/**
 * Start the powerup tracker, initializes the tile-tracking subsystem.
 * Must be started after id and player information are available, after player has been determined to be playing.
 * And after solver initialization.
 */
PowerupTracker.prototype.start = function() {
  console.log("Initializing tile events.");
  this.tile_events = new TileEvents({
    tile: "powerup",
    map: this.map,
    socket: this.socket
  });

  var self = this;
  this.tile_events.on("tile.enter", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
    // Delay and assert fact to rule out states.
    /*setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);*/
    setTimeout(function () {
      var state = info.state ? "present"
                             : "absent";
      var id = info.location.toString();
      //console.log("Observed %s: %s", id, state);
      self.solver.addObservation(id, state);
    }, 50);
  });

  this.tile_events.on("tile.leave", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
  });

  this.tile_events.on("tile.update", function (info) {
    self.solver.setObserved(self.tile_events.getInView());
    /*setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);*/
    setTimeout(function () {
      var state = info.state ? "present"
                             : "absent";
      var id = info.location.toString();
      //console.log("Observed %s: %s", id, state);
      self.solver.addObservation(info.location.toString(), state);
    }, 50);
  });
};

PowerupTracker.prototype.getTiles = function() {
  var state = this.solver.getState();
  if (state === null && !this.empty) {
    this.empty = true;
    console.warn("Empty states.");
    return null;
  } else if (state === null && this.empty) {
    return null;
  } else if (state !== null && this.empty) {
    console.log("States re-created.");
    this.empty = false;
  }
  var powerups = [];
  // todo: variable spawn time.
  var respawn = 60e3;
  for (var variable in state) {
    var loc = Vec2.fromString(variable);
    var powerup = state[variable];
    // need x, y, content
    var content;
    if (powerup.state === "present") {
      content = "!";
    } else {
      if (Array.isArray(powerup.time)) {
        content = "?";
      } else {
        var respawn_time = powerup.time && powerup.time - Date.now();
        if (respawn_time && respawn_time > 0) {
          content = (respawn_time / 1e3).toFixed(1);
        } else {
          content = "?";
        }
      }
    }
    // if visible, then no content.
    // variable for content or not setting?
    powerups.push({
      x: loc.x * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      y: loc.y * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      content: content,
      hideOverlay: powerup.state === "present"
    });
  }
  return powerups;
};

},{"./constants":8,"./solver":13,"./tile-events":16,"./vec2":18}],12:[function(require,module,exports){
var C = require('./constants');
var TileEvents = require('./tile-events');
var Compare = require('./compare');
var Vec2 = require('./vec2');

var compare = new Compare(0.1);

module.exports = SightTracker;
/**
 * opts type
 * respawn
 * map
 * socket
 * tile id
 */
// opts needs socket, map, tile type
// assuming bombs for now
function SightTracker(opts) {
  // get list of the tiles to be tracked
  var map = opts.map;
  var socket = opts.socket;
  var tile = opts.tile;
  this.state = {};
  this.respawn = C.RESPAWN[tile];
  var self = this;

  map.forEach(function (row, x) {
    row.forEach(function (v, y) {
      if (C.TILES[tile].id.indexOf(v) !== -1) {
        self.state[new Vec2(x, y).toString()] = {
          state: "present",
          time: null
        };
      }
    });
  });

  // TODO: general events, not bomb-specific.
  this.events = new TileEvents({
    tile: tile,
    map: map,
    socket: socket
  });

  this.events.on("tile.update", function (info) {
    // on mapupdate, if tile is in view then consider it good.
    var id = info.location.toString();
    if (info.state) {
      self.state[id].state = "present";
      self.state[id].time = null;
    } else {
      var in_view = self.events.getInView();
      if (in_view.indexOf(id) !== -1) {
        // in view, just taken
        self.state[id].state = "absent:known";
        self.state[id].time = Date.now();
      } else {
        // not in view, who knows
        self.state[id].state = "absent:unknown";
        self.state[id].time = Date.now();
      }
    }
  });

  // Check if an entering tile is correct, even if a mapupdate wasn't sent for it.
  this.events.on("tile.enter", function (info) {
    var id = info.location.toString();
    var last_state = self.state[id].state;
    var this_state = info.state ? "present"
                                : "absent";
    var now = Date.now();
    if (last_state === "present") {
      if (this_state === "present") {
        // tag: no change
      } else if (this_state === "absent") {
        // tag: weird
        // desc: wouldn't it have sent a mapupdate?
        console.warn("weird state");
      }
    } else if (last_state === "absent:known") {
      if (this_state === "present") {
        // tag: weird
        // desc: wouldn't it have sent a mapupdate?
      } else if (this_state === "absent") {
        // check if it could have respawned and been used again.
        if (compare.gt(now, self.state[id].time + self.respawn)) {
          // could have respawned
          self.state[id].state = "absent:unknown";
          self.state[id].time = now;
        } else {
          // did not respawn (known)
        }
      }
    } else if (last_state === "absent:unknown") {
      if (this_state === "present") {
        self.state[id].state = "present";
        self.state[id].time = null;
      } else if (this_state === "absent") {
        // check if relatively greater than respawn time
        if (compare.gt(now, self.state[id].time + self.respawn)) {
          // could have respawned
          self.state[id].state = "absent:unknown";
          self.state[id].time = now;
        } else {
          // may not have respawned (unknown)
        }
      }
    }
  });
}

SightTracker.prototype.getTiles = function() {
  var tiles = [];
  for (var variable in this.state) {
    var state = this.state[variable];
    var loc = Vec2.fromString(variable);
    var tile = {
      x: loc.x * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      y: loc.y * C.TILE_WIDTH + C.TILE_WIDTH / 2,
      content: "",
      hideIndicator: true
    };

    if (state.state === "present") {
      tile.hideOverlay = true;
    } else {
      var respawn_time = state.time + this.respawn - Date.now();
      if (state.state === "absent:known") {
        tile.content = (respawn_time / 1e3).toFixed(1);
      } else if (state.state === "absent:unknown") {
        tile.content = "< " + (respawn_time / 1e3).toFixed(1);
      }
    }
    tiles.push(tile);
  }
  return tiles;
};

},{"./compare":7,"./constants":8,"./tile-events":16,"./vec2":18}],13:[function(require,module,exports){
var Compare = require('./compare');

// Possible notification lag.
var compare = new Compare(2e3);

// Object clone.
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = Solver;

/**
 * ms timestamp, e.g. output of `Date.now()`
 * @typedef {integer} timestamp
 */
/**
 * @typedef {object} Variable
 * @property {string} name - The name of the variable.
 * @property {string} [state="unknown"] - The initial state of the variable, one
 *   of "present", "absent", or "unknown".
 */
/**
 * @typedef {object} SolverOptions
 * @property {integer} [interval=60e3] - Interval (in ms) after which a
 *   variable changes state back to present.
 * @property {timestamp} [time=Date.now()] - (test only) Current time
 *   to use for the solver, nonzero.
 * @property {boolean} [observedStart=false] - (test only) Whether the
 *   states given with the variables should be used.
 * @property {boolean} [debug=false] - Set debug options, toggles logging
 *   and observation/notification storage.
 */
/**
 * Solver solves boolean dynamic state. Must have known initial states, even
 * with unknown taken times.
 * @param {Array.<Variable>} variables - array of variable names.
 */
function Solver(variables, options) {
  if (typeof options == "undefined") options = {};
  
  // Used for testing, nonzero.
  this._time = options.time || 0;
  // Allows interval of 0.
  this._state_change_interval = options.hasOwnProperty("interval") ? options.interval
                                                                   : 60e3;
  this._debug = options.debug || false;
  this.variables = {};
  this.states = [];
  var state = {};
  var time = this._time || Date.now();
  var self = this;

  variables.forEach(function (variable) {
    var name = variable.name;
    self.variables[name] = {
      observed: false
    };
    var variable_state = variable.state || "unknown";
    var status = options.observedStart ? variable_state
                                       : "unknown";
    state[name] = {
      id: name,
      state: status,
      start: time,
      end: null
    };
  });
  this.states.push(state);
}

/**
 * Set some variables as observed. Any variables not provided are
 * assume not observed.
 * @param {Array.<string>} variables - the names of the variables
 *   to set as observed.
 */
Solver.prototype.setObserved = function(variables) {
  var unobserved_variables = Object.keys(this.variables).filter(function (variable) {
    return variables.indexOf(variable) === -1;
  });
  var self = this;
  variables.forEach(function (variable) {
    self.variables[variable].observed = true;
  });
  unobserved_variables.forEach(function (variable) {
    self.variables[variable].observed = false;
  });
  this._log("Variables observed: %s", variables.length !== 0 ? variables.join("; ")
                                                             : "none");
};

/**
 * Inform solver that a variable changed.
 * @param {timestamp} time - when the variable changed.
 */
Solver.prototype.addNotification = function(time) {
  this._log("Notified: %d", time);
  this.updateVariables();
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newStates = this.generateStates(this.states[i], time);
    if (newStates)
      Array.prototype.push.apply(states, newStates);
  }
  this.states = states;
};

/**
 * Generate possible successor states to a given state, given a
 * notification that something changed.
 * @private
 * @param {VariableState} state - the state to generate successors for.
 * @param {timestamp} time - when the change occurred.
 * @return {Array.<VariableState>?} - returns array of successor states,
 *   or null if no successor states were possible.
 */
Solver.prototype.generateStates = function(state, time) {
  var states = [];
  for (var name in state) {
    // Skip observed variables, they could not have been changed.
    if (this.variables[name].observed)
      continue;
    var newState = clone(state);
    var variable = newState[name];

    if (variable.state === "present") {
      // Change in observed variable true -> false
      variable.state = "absent";
      variable.start = time;
      variable.end = time + this._state_change_interval;
    } else if (variable.state === "unknown") {
      // Status of variable not known. Generate possibilities.
      variable.state = "absent";
      variable.start = time;
      variable.end = time + this._state_change_interval;
    } else if (variable.state === "absent") {
      newState = null;
      // already taken?
    }
    if (newState !== null) {
      states.push(newState);
    }
  }
  if (states.length === 0) {
    return null;
  } else {
    return states;
  }
};

/**
 * An observation is a known state based on visible information.
 * If the observation is current (the indicated change is something
 * that just occurred), then time is required.
 * @param {string} variable - the name of the variable to update.
 * @param {boolean} state - the state to update the variable to.
 * @param {timestamp} [time] - the time the state changed, if current.
 * @throws {Error} If the given variable is not currently observed.
 */
Solver.prototype.addObservation = function(variable, state, time) {
  this.updateVariables();
  if (!this.variables[variable].observed)
    throw new Error("Variable must be observed to add observation.");
  if (state !== "present" && state !== "absent")
    throw new Error("Update must be either \"present\" or \"absent\".");
  var o = {
    variable: variable,
    state: state
  };
  if (typeof time !== "undefined") o.time = time;
  this._log("Observed v:%s s:%s t:%s", o.variable, o.state, o.time);
  // Generate successor states based on observation.
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newState = this.applyObservation(this.states[i], o);
    if (newState)
      states.push(newState);
  }
  this.states = states;
};

// Given a variable state, return the variable state id.
Solver.prototype.getStateId = function(state) {
  var id = "";
  if (state.state === "present") {
    id += "present:";
    id += this.variables[state.id].observed ? "observed"
                                            : "unobserved";
  } else if (state.state === "absent") {
    id += "absent:";
    id += state.end === null ? "unknown"
                             : "known";
  } else if (state.state === "unknown") {
    id += "unknown";
  }
  return id;
};

function getObservationId(obs) {
  var id = obs.state;
  if (obs.hasOwnProperty("time")) {
    id += ":time";
  }
  return id;
}

function getChangeTime(v) {
  return v.end;
}

/**
 * Return state with observation applied or null if invalid.
 * @private
 * @param {object} state
 * @param {object} observation
 */
Solver.prototype.applyObservation = function(state, observation) {
  var self = this;
  function setPresent(v) {
    v.state = "present";
    v.start = Date.now();
    v.end = null;
  }
  function setAbsent(v, time) {
    if (typeof time == "undefined") time = null;
    v.state = "absent";
    if (time !== null) {
      v.start = time;
      v.end = time + self._state_change_interval;
    } else {
      v.start = Date.now();
      v.end = null;
    }
  }
  var Actions = {
    keep: "keep",
    drop: "drop"
  };
  var current = state[observation.variable];
  var stateId = this.getStateId(current);
  var observationId = getObservationId(observation);
  var action = null;

  if (stateId == "unknown") {
    if (observationId == "present") {
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "present:time") {
      // tag: weird
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "absent") {
      setAbsent(current);
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  } else if (stateId == "absent:unknown") {
    if (observationId == "present") {
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "present:time") {
      setPresent(current);
      action = Actions.keep;
    } else if (observationId == "absent") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      // tag: weird
      // desc: perfect grab might result in this
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  } else if (stateId == "absent:known") {
    if (observationId == "present") {
      if (compare.eq(getChangeTime(current), Date.now())) {
        setPresent(current);
        action = Actions.keep;
      } else {
        action = Actions.drop;
      }
    } else if (observationId == "present:time") {
      if (compare.eq(getChangeTime(current), observation.time)) {
        setPresent(current);
        action = Actions.keep;
      } else {
        action = Actions.drop;
      }
    } else if (observationId == "absent") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      // tag:weird
      // desc: perfect grab
      if (compare.eq(getChangeTime(current), observation.time)) {
        setAbsent(current, observation.time);
        action = Actions.keep;
      } else {
        action = Actions.drop;
      }
    }
  } else if (stateId == "present:observed") {
    if (observationId == "present") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "present:time") {
      // tag: weird
      action = Actions.keep;
    } else if (observationId == "absent") {
      // tag: weird
      setAbsent(current);
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  } else if (stateId == "present:unobserved") {
    if (observationId == "present") {
      // tag: no_change
      action = Actions.keep;
    } else if (observationId == "present:time") {
      // tag: weird
      action = Actions.keep;
    } else if (observationId == "absent") {
      // tag: weird
      setAbsent(current);
      action = Actions.keep;
    } else if (observationId == "absent:time") {
      setAbsent(current, observation.time);
      action = Actions.keep;
    }
  }

  if (action == Actions.keep) {
    return state;
  } else {
    return null;
  }
};

/**
 * Get set of possible states.
 * @private
 * @return {Array.<State>} the current possible states
 */
Solver.prototype.getStates = function() {
  this.updateVariables();
  return this.states.slice();
};

/**
 * Get consolidated state indicating known/unknown variable values.
 * @return {OutState} - State with addtl values, each variable has
 *   state (true|false|null), change (if false). change is number or
 *   array (if there is disagreement).
 */
Solver.prototype.getState = function() {
  this.updateVariables();
  if (this.states.length > 0) {
    // Construct output.
    var out = {};
    var state = this.states[0];
    for (var name in state) {
      var variable = state[name];
      if (variable.state === "present") {
        out[name] = {
          state: variable.state
        };
      } else {
        // intervals, end time
        var time = variable.end;
        out[name] = {
          state: variable.state,
          time: time
        };
      }
    }
    // Compare results across all states.
    return this.states.slice(1).reduce(function (out, state) {
      for (var name in out) {
        var out_variable = out[name],
            variable = state[name];
        // Check for matching states.
        if (out_variable.state === variable.state) {
          // Falsy check time.
          if (out_variable.state === "absent") {
            // TODO: check undefined in case interval not updated?
            // Get end of most recent applicable interval.
            // intervals: end_time
            var change = variable.end;
            if (out_variable.time instanceof Array) {
              if (out_variable.time.indexOf(change) === -1) {
                out_variable.time.push(change);
              }
            } else if (out_variable.time !== change) {
              var times = [out_variable.time, change];
              out_variable.time = times;
            } // Else matches, so no problem.
          }
        } else {
          // Conflicted states.
          out_variable.state = "unknown";
          // In case it was set.
          delete out_variable.time;
        }
      }
      return out;
    }, out);
  } else {
    return null;
  }
};

/**
 * Update `false` state variables based on false end time, if present.
 * @private
 */
Solver.prototype.updateVariables = function() {
  var states = [];
  var time = this._time || Date.now();
  for (var i = 0; i < this.states.length; i++) {
    var state = clone(this.states[i]);
    for (var name in state) {
      var variable = state[name];

      // Update changeback.
      if (variable.state === "absent") {
        if (variable.end && variable.end <= time) {
          // update to true.
          variable.state = "present";
          variable.start = time;
          variable.end = null;
        } else if (variable.end === null) {
          // Near beginning of experiment, unknown variable that does not have
          // a known end time. Create a new state with a different variable that is present
          // for naive approach.
        }
      } else if (variable.state === "unknown") {
        var end = variable.start + this._state_change_interval;
        if (end <= time) {
          variable.state = "present";
          variable.start = time;
          variable.end = null;
        }
      }
    }
    states.push(state);
  }
  this.states = states;
};

/**
 * Same interface as `console.log`.
 * @private
 */
Solver.prototype._log = function() {
  if (this._debug) {
    console.log.apply(console, Array.prototype.slice.call(arguments));
  }
};

},{"./compare":7}],14:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Makes checking states easier. If module is not loaded synchronously you may miss out on states.
 * Events:
 * * tagpro.exists: tagpro object exists, synchronous with tagpro
 *     variable creation if script loaded early enough.
 * * tagpro.beforeready: assets loaded, set before any other tagpro ready.
 * * same as tagpro.ready in external script with guard against tagpro not
 *     existing.
 * * tagpro.initialized: called immediately after socket is 
 * * user.spectating: User is spectating.
 * * user.playing: joined game as player, or from spectator mode.
 * * socket: invoked synchronously with socket creation in the ideal case, never miss a message!
 * * group: when group is set.
 * * *: any state change.
 *
 * general ordering is:
 * tagpro.exists -> tagpro.beforeready -> group -> socket -> tagpro.ready -> user.*
 *
 * guaranteed ordering is:
 * tagpro.exists -> group -> socket -> user.*
 */
var TagPro = (function (window) {
  function setImmediate(fn) {
    setTimeout(function() {
      fn();
    }, 0);
  }

  // Listen for a global variable to be set and call callback
  // synchronously when set.
  function onValue(object, property, callback) {
    Object.defineProperty(object, property, {
      enumerable: true,
      configurable: true,
      get: function () { return; },
      set: function (v) {
        Object.defineProperty(object, property, {
          enumerable: true,
          configurable: true,
          value: v
        });
        // Protect from callback errors.
        try {
          callback(v);
        } catch (e) {
          console.error("Error trying to invoke callback for %s: %o", property, e);
        }
      }
    });
  }

  function findIndex(arr, fn) {
    for (var i = 0; i < arr.length; i++) {
      if (fn(arr[i])) {
        return i;
      }
    }
    return -1;
  }

  function onTagPro(fn) {
    if (typeof tagpro !== 'undefined') {
      // Force to be async.
      setImmediate(fn);
    } else {
      // Call synchronously when variable is set.
      onValue(window, "tagpro", function (tagpro) {
        fn();
      });
    }
  }

  // TagPro class.
  function TagPro() {
    EventEmitter.apply(this, arguments);
    // Track states.
    this.state = {
      group: null, // bool
      game: null, // str enum "pre", "in", "post"
      user: null, // "spectating", "playing"
      tagpro: null, // "exists", "ready", "initialized"
      socket: null // SocketIO socket.
    };
    // Allow calling synchronous event handlers async.
    this.sync_events = [];

    var self = this;
    onTagPro(function () {
      self._set("tagpro", "exists");
      self._init();
    });

    // Check for group id presence.
    document.addEventListener("DOMContentLoaded", function () {
      var group = document.getElementById("groupId");
      self._set("group", group !== null);
    });
  }

  util.inherits(TagPro, EventEmitter);

  // Initialize listeners for states.
  // @private
  TagPro.prototype._init = function() {
    var self = this;

    this.on('tagpro.ready', function () {
      // Initialize
      var timeout;
      if (tagpro.spectator) {
        self._set("user", "spectating");
      } else {
        // Emit playing if not spectator.
        timeout = setTimeout(function () {
          self._set("user", "playing");
        }, 2e3);
      }

      // Set up socket listeners.
      tagpro.socket.on('spectator', function (spectating) {
        if (spectating) {
          if (timeout) {
            // Don't emit playing.
            clearTimeout(timeout);
          }
          self._set("user", "spectating");
        } else {
          // Joining game from spectating.
          if (self.get("user") === "spectating") {
            self._set("user", "playing");
          }
        }
      });
    });

    // beforeready event.
    this._set("tagpro", "beforeready");

    // async to allow global-game tagpro.ready callbacks to be added.
    setImmediate(function () {
      tagpro.ready(function () {
        self._set("tagpro", "ready");
      });
    });

    // Socket listener.
    if (tagpro.rawSocket) {
      self._set("socket", tagpro.rawSocket);
    } else {
      onValue(tagpro, "rawSocket", function (socket) {
        self._set("socket", socket);
      });
    }
  };

  // Set value and emit.
  // @private
  TagPro.prototype._set = function(type, val) {
    if (!this.state.hasOwnProperty(type)) return;
    // Update state.
    this.state[type] = val;

    // Emit to specific listeners.
    this.emit(type + "." + val, this.state);
    // Emit to general type listeners.
    this.emit(type, this.state);
    // Emit to catch-all listener.
    this.emit("*", this.state);
  };

  TagPro.prototype.get = function(type) {
    return this.state[type];
  };

  return new TagPro();
})((typeof unsafeWindow !== "undefined" && unsafeWindow) || window); // For use in userscripts.

module.exports = TagPro;

},{"events":1,"util":5}],15:[function(require,module,exports){
var Vec2 = require('./vec2');
var C = require('./constants');

function dim(arr, i) {
  if (i === 0) {
    return arr.length;
  } else if (i === 1) {
    return arr[0].length;
  }
}

module.exports = T;
function T(map) {
  var points = [];
  points.push({
    x: 0, y: 0
  });
  points.push({
    x: map.length * C.TILE_WIDTH, y: 0
  });
  points.push({
    x: map.length * C.TILE_WIDTH, y: map[0].length * C.TILE_WIDTH
  });
  points.push({
    x: 0, y: map[0].length * C.TILE_WIDTH
  });
  this.points = points.map(function (o) {
    o.indicator = true;
    o.content = ":)";
    o.x += C.TILE_WIDTH / 2;
    o.y += C.TILE_WIDTH / 2;
    return o;
  });
}

T.prototype.getTiles = function(first_argument) {
  return this.points;
};

},{"./constants":8,"./vec2":18}],16:[function(require,module,exports){
var Vec2 = require('./vec2');
var C = require('./constants');

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var tileTypes = C.TILES;

/**
 * @typedef {object} TileEventsOptions
 * @property {string} tile - one of "powerup", "bomb", or "boost"
 *   indicating the type of tile to track.
 * @property {TagProMap} map - the TagPro map
 * @property {Socket} socket - the socket.io socket for the game.
 */
/**
 * Contains information about a tile event, whether the tile is
 * present or absent, and its location.
 * @typedef {object} TileEventInfo
 * @property {boolean} state - true for present, false for absent
 * @property {Vec2} location - the x, y location in the map for the
 *   tile in question.
 */
/**
 * @callback TileEventCallback
 * @param {TileEventInfo} info - the information about the tile.
 */
/**
 * Generate abstracted tile events for specific tile types, specified
 * in options.
 *
 * Event listeners are managed through event emitter interface, `on`,
 * `off`, etc. Events that can be listened to include:
 * * tile.update - a tile within view has been updated
 * * tile.enter - a tile has come into view
 * * tile.leave - a tile has left view
 * Events are passed object of type TileEventInfo with event information.
 */
function TileEvents(opts) {
  EventEmitter.apply(this, arguments);
  var tile = opts.tile;
  var map = opts.map;
  var socket = opts.socket;

  this.tile = tileTypes[tile];
  var self = this;
  // Locations to listen for.
  this.tiles = [];
  this.in_view = [];
  this.checkInterval = 250;
  this.interval = setInterval(this._interval.bind(this), this.checkInterval);
  this.range = {
    x: 660,
    y: 420
  };
  map.forEach(function (row, x) {
    row.forEach(function (v, y) {
      if (self.isType(v)) {
        self.tiles.push(new Vec2(x, y));
      }
    });
  });

  // Listen for mapupdate.
  socket.on('mapupdate', function (updates) {
    if (!Array.isArray(updates)) {
      updates = [updates];
    }
    updates.forEach(function (event) {
      if (self.isType(event.v)) {
        var e = {
          location: new Vec2(event.x, event.y),
          state: self.isActive(event.v),
          time: Date.now()
        };
        self.emit("tile.update", e);
      }
    });
  });
}

util.inherits(TileEvents, EventEmitter);
module.exports = TileEvents;

/**
 * Get array of string ids for tiles in view.
 * @return {Array.<string>} - the tiles in view.
 */
TileEvents.prototype.getInView = function() {
  return this.in_view.slice();
};

// Check if given tile id corresponds to tile type to be tracked.
// @private
TileEvents.prototype.isType = function(v) {
  return this.tile.id.indexOf(Math.floor(v)) !== -1;
};

// Check whether given tile id indicates tile is "active".
// @private
TileEvents.prototype.isActive = function(v) {
  return this.tile.active.indexOf(v) !== -1;
};

// Get player location.
// @private
TileEvents.prototype.center = function() {
  return new Vec2(tagpro.players[tagpro.playerId].x,
    tagpro.players[tagpro.playerId].y);
};

// Function run in an interval.
// @private
TileEvents.prototype._interval = function() {
  var location = this.center();
  var enter = [];
  var leave = [];
  var self = this;
  var time = Date.now();

  this.tiles.forEach(function (tile) {
    var diff = tile.c().mulc(C.TILE_WIDTH).sub(location).abs();
    var in_view = (diff.x < this.range.x && diff.y < this.range.y);
    var id = tile.toString();
    var already_in_view = self.in_view.indexOf(id) !== -1;
    if (in_view && !already_in_view) {
      self.in_view.push(id);
      enter.push(tile);
    } else if (!in_view && already_in_view) {
      leave.push(tile);
      var i = self.in_view.indexOf(id);
      self.in_view.splice(i, 1);
    }
  }, this);
  enter.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("tile.enter", {
      location: tile.clone(),
      state: self.isActive(val),
      time: time
    });
  });
  leave.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("tile.leave", {
      location: tile.clone(),
      state: self.isActive(val),
      time: time
    });
  });
};

},{"./constants":8,"./vec2":18,"events":1,"util":5}],17:[function(require,module,exports){
var Vec2 = require('./vec2');
var Line = require('./line');
var C = require('./constants');

module.exports = TileOverlay;

/**
 * [TileOverlay description]
 * @param {[type]} options [description]
 */
function TileOverlay(options) {
  if (typeof options == "undefined") options = {};
  // Distance from edge of screen where indicator-relevant tile overlays
  // disappear.
  this.x_visible = 40;
  this.y_visible = this.x_visible;
  this.x_visible_no_indicator = 0;
  this.y_visible_no_indicator = this.x_visible_no_indicator;
  this.x_indicator_offset = 50;
  this.y_indicator_offset = this.x_indicator_offset;

  this.sources = [];

  // Set up indicator container.
  this.indicator_ui = new PIXI.DisplayObjectContainer();
  tagpro.renderer.layers.ui.addChild(this.indicator_ui);
  this.indicators = {};

  // Set up tile overlay containers.
  this.tile_ui = new PIXI.DisplayObjectContainer();
  tagpro.renderer.layers.foreground.addChild(this.tile_ui);
  this.tile_overlays = {};

  $(window).resize(this._onResize.bind(this));
  this._onResize();
}

/**
 * Add a source of tile information.
 * @param {TileSource} source
 */
TileOverlay.prototype.addSource = function(source) {
  if (this.sources.indexOf(source) !== -1) {
    throw Error("Source already added.");
  } else {
    this.sources.push(source);
    var sourceId = this.sources.length - 1;

    var tiles = source.getTiles();
    var texture = this._makeIndicatorTexture();
    var self = this;
    tiles.forEach(function (tile) {
      var id = Vec2.toString(tile);
      var sprite = new PIXI.Sprite(texture);
      sprite.anchor = new PIXI.Point(0.5, 0.5);
      self.indicator_ui.addChild(sprite);
      var t = makeText();
      self.indicator_ui.addChild(t);
      sprite.visible = false;
      t.visible = false;
      self.indicators[sourceId + ":" + id] = {
        sprite: sprite,
        text: t
      };
    });

    tiles.forEach(function (tile) {
      var id = Vec2.toString(tile);
      var t = makeText();
      self.tile_ui.addChild(t);
      self.tile_overlays[sourceId + ":" + id] = {
        text: t
      };
    });
  }
};

TileOverlay.prototype.update = function() {
  var offscreen_tiles = [];
  var visible_tiles = [];
  var all_bounds = this._getBounds();

  var self = this;
  this.sources.forEach(function (source, sourceId) {
    var tiles = source.getTiles();

    if (!tiles) {
      return;
    }
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      tile.id = sourceId + ":" + Vec2.toString(tile);
      var bounds = tile.hideIndicator ? all_bounds.overlay_only
                                      : all_bounds.with_indicator;
      if (self._inBounds(bounds, tile)) {
        visible_tiles.push(tile);
      } else {
        offscreen_tiles.push(tile);
      }
    }
  });

  // Remove indicators for visible tiles.
  visible_tiles.forEach(function (tile) {
    var indicator = self.indicators[tile.id];
    indicator.text.visible = false;
    indicator.sprite.visible = false;
  });

  // Hide overlays for non-visible tiles.
  offscreen_tiles.forEach(function (tile) {
    var overlay = self.tile_overlays[tile.id];
    overlay.text.visible = false;
  });

  // Do drawings.
  this._drawOverlays(visible_tiles);
  this._drawIndicators(offscreen_tiles);
};

TileOverlay.prototype._drawOverlays = function(tiles) {
  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    var text = this.tile_overlays[tile.id].text;
    if (tile.hideOverlay) {
      text.visible = false;
      continue;
    } else {
      var loc = new Vec2(tile.x, tile.y);
      text.visible = true;
      text.x = loc.x;
      text.y = loc.y;
      text.setText(tile.content);
    }
  }
};

TileOverlay.prototype._drawIndicators = function(tiles) {
  var viewport = $("#viewport");
  // Center screen coordinates.
  var center = new Vec2(viewport.width(), viewport.height()).divc(2);

  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    var indicator = this.indicators[tile.id];
    if (tile.hideIndicator) {
      indicator.sprite.visible = false;
      indicator.text.visible = false;
    } else {
      var draw = false;
      var loc = this._worldToScreen(new Vec2(tile.x, tile.y));

      // Line from center to tile.
      var line = new Line(center, loc);
      for (var j = 0; j < this.indicator_lines.length; j++) {
        var indicator_line = this.indicator_lines[j];
        var intersection = indicator_line.intersection(line);
        if (intersection) {
          draw = true;
          indicator.sprite.x = intersection.x;
          indicator.sprite.y = intersection.y;
          indicator.sprite.rotation = loc.sub(center).angle();
          indicator.text.x = intersection.x;
          indicator.text.y = intersection.y;
          indicator.text.setText(tile.content);
          break;
        }
      }
      if (!draw) {
        console.warn("Error finding overlay position for powerup indicator.");
      } else {
        indicator.sprite.visible = true;
        indicator.text.visible = true;
      }
    }
  }
};

/**
 * Convert screen coordinate to world coordinate. Alters given vector.
 * @param {Vec2} v
 * @return {Vec2} - the altered v
 */
TileOverlay.prototype._screenToWorld = function(v) {
  var gameContainer = tagpro.renderer.gameContainer;
  var scale = gameContainer.scale.x;
  var gameLocation = new Vec2(gameContainer.x, gameContainer.y).divc(-scale);
  return v.divc(scale).add(gameLocation);
};

/**
 * Convert world coordinates to screen. Alters given vector.
 * @param {Vec2} v
 * @return {Vec2} - the altered v
 */
TileOverlay.prototype._worldToScreen = function(v) {
  var gameContainer = tagpro.renderer.gameContainer;
  var scale = gameContainer.scale.x;
  var gameLocation = new Vec2(gameContainer.x, gameContainer.y).divc(-scale);
  return v.sub(gameLocation).mulc(scale);
};

/**
 * Return bounds object for world-coordinate objects.
 * @return {[type]} [description]
 */
TileOverlay.prototype._getBounds = function() {
  // Indicator-relevant bounds:
  var $viewport = $("#viewport");
  return {
    with_indicator: [
      this._screenToWorld(new Vec2(0, 0). addc(this.x_visible)),
      this._screenToWorld(
        new Vec2($viewport.width(), $viewport.height()).subc(this.x_visible))
    ],
    overlay_only: [
      this._screenToWorld(new Vec2(0, 0)).subc(C.TILE_WIDTH),
      this._screenToWorld(new Vec2($viewport.width(), $viewport.height())).addc(C.TILE_WIDTH)
    ]
  };
};

TileOverlay.prototype._inBounds = function(bounds, p) {
  return (bounds[0].x < p.x && bounds[1].x > p.x && bounds[0].y < p.y && bounds[1].y > p.y);
};

TileOverlay.prototype._makeIndicatorTexture = function(first_argument) {
  var g = new PIXI.Graphics();
  g.clear();
  g.lineStyle(1, 0xffffff, 0.9);
  var indicator_size = 18;
  var container_size = indicator_size * 2 + 10 * 2;
  // Circle.
  g.beginFill(0xFFFFFF, 0.9);
  g.drawCircle(container_size / 2, container_size / 2, indicator_size);
  // Pointer.
  var triangle_size = 6;
  var pointer_base = container_size / 2 + indicator_size;
  g.drawShape(new PIXI.Polygon([
    pointer_base, container_size / 2 - triangle_size / 2,
    pointer_base + triangle_size, container_size / 2,
    pointer_base, container_size / 2 + triangle_size / 2,
    pointer_base, container_size / 2 - triangle_size / 2,
  ]));
  g.endFill();
  // Invisible line so generated texture is centered on circle.
  g.lineStyle(0, 0, 0);
  g.moveTo(10, container_size / 2);
  g.lineTo(10 - triangle_size, container_size / 2);
  return g.generateTexture();
};

TileOverlay.prototype._onResize = function() {
  console.log("Overlay resize callback called.");
  var $viewport = $("#viewport");
  var indicator_offset = this.x_indicator_offset;
  this.indicator_lines = [];
  // Top.
  this.indicator_lines.push(new Line([
    indicator_offset, indicator_offset,
    $viewport.width() - indicator_offset, indicator_offset
  ]));
  // Right.
  this.indicator_lines.push(new Line([
    $viewport.width() - indicator_offset, indicator_offset,
    $viewport.width() - indicator_offset, $viewport.height() - indicator_offset
  ]));
  // Bottom.
  this.indicator_lines.push(new Line([
    $viewport.width() - indicator_offset, $viewport.height() - indicator_offset,
    indicator_offset, $viewport.height() - indicator_offset
  ]));
  // Left.
  this.indicator_lines.push(new Line([
    indicator_offset, $viewport.height() - indicator_offset,
    indicator_offset, indicator_offset
  ]));
};

function makeText(color) {
  if (typeof color == 'undefined') color = "#FFFFFF";
  var text = new PIXI.Text("", {
    font: "bold 10pt Arial",
    fill: color,
    stroke: "#000000",
    strokeThickness: 3,
    align: "center"
  });
  text.anchor = new PIXI.Point(0.5, 0.5);
  text.visible = false;
  return text;
}

},{"./constants":8,"./line":9,"./vec2":18}],18:[function(require,module,exports){
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

Vec2.prototype.add = function(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
};

Vec2.prototype.addc = function(c) {
    this.x += c;
    this.y += c;
    return this;
};

Vec2.prototype.sub = function(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
};

Vec2.prototype.subc = function(c) {
    this.x -= c;
    this.y -= c;
    return this;
};

Vec2.prototype.mul = function(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
};

Vec2.prototype.mulc = function(c) {
    this.x *= c;
    this.y *= c;
    return this;
};

Vec2.prototype.div = function(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
};

Vec2.prototype.divc = function(c) {
    this.x /= c;
    this.y /= c;
    return this;
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

Vec2.prototype.norm = function() {
    var len = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    this.x /= len;
    this.y /= len;
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

/**
 * Alias for #clone
 */
Vec2.prototype.c = Vec2.prototype.clone;

Vec2.prototype.abs = function() {
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
    return this;
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

},{}]},{},[10]);
