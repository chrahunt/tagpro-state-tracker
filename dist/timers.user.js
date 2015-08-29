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

},{"./vec2":13}],7:[function(require,module,exports){
var PowerupTracker = require('./powerup-tracker');
var Overlay = require('./overlay');
var TagPro = require('./tagpro');

TagPro.on('user.playing', function () {
  var tracker = new PowerupTracker();
  var overlay = new Overlay(tracker);
});

},{"./overlay":8,"./powerup-tracker":9,"./tagpro":11}],8:[function(require,module,exports){
var Vec2 = require('./vec2');
var Line = require('./line');

var TILE_WIDTH = 40;
var Utils = {
  makeText: function (color) {
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
};

// Various drawings.
// Drawing has properties init, update, hide, show.
var drawings = [
  { // Powerups.
    init: function (tracker) {
      console.log("Initializing powerup overlay.");
      this.tracker = tracker;
      
      // TODO: no hard code
      this.powerup_respawn = 60e3;
      var powerups = this.tracker.getPowerups();
      this.debug = new PIXI.Graphics();
      tagpro.renderer.gameContainer.addChild(this.debug);
      this._initIndicators(powerups);
      this._initTiles(powerups);
    },
    // Initialize window side indicators.
    _initIndicators: function (powerups) {
      // Offset of indicators from side of window.
      this.indicator_offset = 50;
      this.indicator_ui = new PIXI.DisplayObjectContainer();
      tagpro.renderer.layers.ui.addChild(this.indicator_ui);
      var texture = this._getIndicatorTexture();

      this.indicators = {};
      powerups.forEach(function (powerup) {
        var sprite = new PIXI.Sprite(texture);
        sprite.anchor = new PIXI.Point(0.5, 0.5);
        this.indicator_ui.addChild(sprite);
        var t = Utils.makeText();
        this.indicator_ui.addChild(t);
        this.indicators[powerup.id] = {
          sprite: sprite,
          text: t
        };
      }, this);
      $("#viewport").resize(this._onResize.bind(this));
      this._onResize();      
    },
    // Initialize tile overlays.
    _initTiles: function (powerups) {
      this.tile_ui = new PIXI.DisplayObjectContainer();
      tagpro.renderer.layers.foreground.addChild(this.tile_ui);
      this.tile_overlays = {};
      powerups.forEach(function (powerup) {
        var t = Utils.makeText();
        this.tile_ui.addChild(t);
        this.tile_overlays[powerup.id] = {
          text: t
        };
      }, this);
    },
    // Function called on viewport resize.
    _onResize: function () {
      var viewport = $("#viewport");
      this.indicator_lines = [];
      // Top.
      this.indicator_lines.push(new Line([
        this.indicator_offset, this.indicator_offset,
        viewport.width() - this.indicator_offset, this.indicator_offset
      ]));
      // Right.
      this.indicator_lines.push(new Line([
        viewport.width() - this.indicator_offset, this.indicator_offset,
        viewport.width() - this.indicator_offset, viewport.height() - this.indicator_offset
      ]));
      // Bottom.
      this.indicator_lines.push(new Line([
        viewport.width() - this.indicator_offset, viewport.height() - this.indicator_offset,
        this.indicator_offset, viewport.height() - this.indicator_offset
      ]));
      // Left.
      this.indicator_lines.push(new Line([
        this.indicator_offset, viewport.height() - this.indicator_offset,
        this.indicator_offset, this.indicator_offset
      ]));
    },
    update: function () {
      var powerups = this.tracker.getPowerups();
      var visible_powerups = [];
      var offscreen_powerups = [];
      for (var i = 0; i < powerups.length; i++) {
        var powerup = powerups[i];
        // TODO: Limit to tile visibility by player.
        if (powerup.visible) {
          visible_powerups.push(powerup);
        } else {
          offscreen_powerups.push(powerup);
        }
      }
      visible_powerups.forEach(this._hideIndicator, this);
      offscreen_powerups.forEach(this._hideTileOverlay, this);
      this._drawIndicators(offscreen_powerups);
      this._drawTileOverlays(visible_powerups);
    },
    // Draw indicators for off-screen powerups.
    _drawIndicators: function (powerups) {
      var scale = tagpro.renderer.gameContainer.scale.x;
      var gameContainer = tagpro.renderer.gameContainer;
      var gameLocation = new Vec2(gameContainer.x, gameContainer.y).divc(-scale);
      // Convert indicator lines to game coordinates.
      var indicator_lines = this.indicator_lines.map(function (line) {
        return line.clone().scale(1 / scale).translate(gameLocation);
      });
      var viewport = $("#viewport");
      // Center in game coordinates.
      var center = new Vec2(viewport.width(), viewport.height())
        .divc(2)
        .divc(scale)
        .add(gameLocation);

      for (var i = 0; i < powerups.length; i++) {
        var powerup = powerups[i];
        var indicator = this.indicators[powerup.id];
        if (powerup.visible) {
          // TODO: maybe change the buffer a little here.
          indicator.sprite.visible = false;
        } else {
          // Get text for indicator.
          var text;
          if (powerup.state) {
            // TODO: Icon if value known.
            text = "!";
          } else {
            if (Array.isArray(powerup.time)) {
              // TODO: Handle multiple possibilities.
              text = "?";
            } else {
              var respawn_time = powerup.time && powerup.time - Date.now();
              if (respawn_time && respawn_time > 0) {
                text = (respawn_time / 1e3).toFixed(1);
              } else {
                text = "?";
              }
            }
          }
          var draw = false;
          var loc = powerup.location.mulc(TILE_WIDTH, true).addc(TILE_WIDTH / 2);
          // Line from center to tile.
          var line = new Line(center, loc);
          for (var j = 0; j < indicator_lines.length; j++) {
            var indicator_line = indicator_lines[j];
            var intersection = indicator_line.intersection(line);
            if (intersection) {
              draw = true;
              intersection.sub(gameLocation).mulc(scale);
              indicator.sprite.x = intersection.x;
              indicator.sprite.y = intersection.y;
              indicator.sprite.rotation = loc.sub(center).angle();
              indicator.text.x = intersection.x;
              indicator.text.y = intersection.y;
              indicator.text.setText(text);
              break;
            }
          }

          if (!draw) {
            console.error("Error finding overlay position for powerup indicator.");
          } else {
            indicator.sprite.visible = true;
            indicator.text.visible = true;
          }
        }
      }
    },
    // Get indicator texture for sprite.
    _getIndicatorTexture: function () {
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
    },
    // Hide indicator.
    _hideIndicator: function (powerup) {
      var indicator = this.indicators[powerup.id];
      indicator.text.visible = false;
      indicator.sprite.visible = false;
    },
    // Draw overlays on visible powerups.
    _drawTileOverlays: function (powerups) {
      for (var i = 0; i < powerups.length; i++) {
        var powerup = powerups[i];
        var text = this.tile_overlays[powerup.id].text;
        if (powerup.state) {
          text.visible = false;
          continue;
        } else {
          var loc = powerup.location.mulc(TILE_WIDTH, true).addc(TILE_WIDTH / 2);
          text.visible = true;
          text.x = loc.x;
          text.y = loc.y;
          var respawn_time = powerup.time && powerup.time - Date.now();
          if (respawn_time && respawn_time > 0) {
            text.setText((respawn_time / 1e3).toFixed(1));
          } else {
            // TODO: Show range/estimated time.
            text.setText("?");
          }
        }
      }
    },
    // Hide overlay.
    _hideTileOverlay: function (powerup) {
      var tile_overlay = this.tile_overlays[powerup.id];
      tile_overlay.text.visible = false;
    },
    show: function () {

    },
    hide: function () {
      // Reset so we see state again.
      this.logged = false;
    }
  }
];

/**
 * Visual overlay to display real-time state over the game.
 */
function Overlay(pup_tracker) {
  this.tracker = pup_tracker;
  drawings.forEach(function (drawing) {
    drawing.init(this.tracker);
  }, this);
  this.showing = false;
  this.disabled = false;
  this.update();
}
module.exports = Overlay;

// Interval to check/update vectors.
Overlay.prototype.update = function() {
  if (this.disabled) {
    drawings.forEach(function (drawing) {
      drawing.hide();
    });
    this.showing = false;
  } else {
    requestAnimationFrame(this.update.bind(this));
    if (!this.showing) {
      this.showing = true;
      drawings.forEach(function (drawing) {
        drawing.show();
      });
    }
    drawings.forEach(function draw(drawing) {
      drawing.update();
    });
  }
};

Overlay.prototype.disable = function() {
  this.disabled = true;
};

Overlay.prototype.enable = function() {
  this.disabled = false;
  this.update();
};

},{"./line":6,"./vec2":13}],9:[function(require,module,exports){
var Solver = require('./solver');
var TileEvents = require('./tile-events');
var Vec2 = require('./vec2');

var TILE_WIDTH = 40;

// Interface that takes in source information and puts it into solver format.
function PowerupTracker() {
  var self = this;
  // handle mapupdate, tile tracking
  // Listen for player powerup grabs.
  tagpro.socket.on('p', function (event) {
    var updates = event.u || event;
    var time = Date.now();
    updates.forEach(function (update) {
      if (update['s-powerups']) {
        var id = update.id;
        console.log("GOT ONE@@@@@@@@");
        if (tagpro.players[id].draw) {
          // Player is visible, get powerup tile and send observation.
          var position = new Vec2(tagpro.players[id].x, tagpro.players[id].y);
          var found = false;
          for (var i = 0; i < self.powerup_locations.length; i++) {
            var powerup = self.powerup_locations[i];
            // TODO: More specific powerup finding location.
            if (position.dist(powerup) < 40) {
              self.solver.addObservation({
                time: time,
                state: false,
                variable: self.powerups[i].toString()
              });
              found = true;
              break;
            }
          }
          if (!found) {
            console.warn("Couldn't find adjacent powerup!");
          }
        } else {
          // Player not visible, send information.
          self.solver.addHypothesis({
            state: false,
            time: time
          });
        }
      }
    });
  });

  this.tile_events = new TileEvents();
  this.tile_events.on("powerup.enter", function (info) {
    console.log("started viewing powerup %o", info);
    self.solver.setObserved(self.tile_events.in_view);
    // Delay and assert fact to rule out states.
    setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);
    /*self.solver.addObservation({
      variable: info.location.toString(),
      state: info.state,
      time: info.time
    });*/
  });
  this.tile_events.on("powerup.leave", function (info) {
    console.log("stopped viewing powerup");
    // TODO: Need to do anything here?
    self.solver.setObserved(self.tile_events.in_view);
  });
  this.tile_events.on("powerup.update", function (info) {
    setTimeout(function () {
      self.solver.addAssertion({
        variable: info.location.toString(),
        state: info.state
      });
    }, 20);
    /*self.solver.addObservation({
      variable: info.location.toString(),
      state: info.state,
      time: info.time
    });*/
  });
  this.powerups = [];
  this.powerup_locations = [];
  tagpro.map.forEach(function (row, x) {
    row.forEach(function (tile, y) {
      if (Math.floor(tile) !== 6) return;
      var powerup = new Vec2(x, y);
      self.powerups.push(powerup);
      self.powerup_locations.push(powerup.mulc(TILE_WIDTH, true));
    });
  });

  var variables = self.powerups.map(function (powerup) {
    return powerup.toString();
  });
  this.solver = new Solver(variables);
}
module.exports = PowerupTracker;

// TODO: Initialization and state management in case solver goes crazy.

PowerupTracker.prototype.getPowerups = function() {
  var state = this.solver.getState();
  var in_view = this.tile_events.in_view;
  var powerups = [];
  for (var variable in state) {
    powerups.push({
      id: variable,
      location: Vec2.fromString(variable),
      visible: this.tile_events.in_view.indexOf(variable) !== -1,
      state: state[variable].state,
      time: state[variable].time
    });
  }
  return powerups;
};

/**
 * Check whether there are powerup tiles adjacent to the given tile.
 * @param {object} loc - Object with x and y properties corresponding
 *   to array location to look around.
 * @return {boolean} - Whether or not any adjacent tiles are powerups.
 */
PowerupTracker.prototype.adjacentPowerup = function(loc) {
  var offsets = [-1, 0, 1];
  var x = loc.x;
  var y = loc.y;
  for (var i = 0; i < offsets.length; i++) {
    for (var j = 0; j < offsets.length; j++) {
      var thisX = x + offsets[i],
          thisY = y + offsets[j];
      if ((thisX < 0 || thisX > this.map.length - 1) ||
        (thisY < 0 || thisY > this.map.length - 1) ||
        (thisX === x && thisY === y)) {
        continue;
      } else if (Math.floor(this.map[thisX][thisY]) == 6) {
        return true;
      }
    }
  }
  return false;
};

},{"./solver":10,"./tile-events":12,"./vec2":13}],10:[function(require,module,exports){
// Time for state to change back.
var STATE_CHANGE = 6e4;
// Possible notification lag.
var EPSILON = 2e3;

// Comparison operations.
function lt(a, b) {
  return a - b < EPSILON;
}

function gt(a, b) {
  return b - a < EPSILON;
}

function eq(a, b) {
  return Math.abs(a - b) < EPSILON;
}

// Object clone.
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = Solver;

/**
 * Solver solves boolean dynamic state.
 * @param {Array<string>} variables - array of variable names.
 */
function Solver(variables) {
  this.variables = {};
  this.states = [];
  this._time = null;
  var state = {};
  var time = Date.now();
  var self = this;
  // TODO: Handle unknown or variable start.
  variables.forEach(function (variable) {
    self.variables[variable] = {
      observed: false
    };
    state[variable] = {
      state: true,
      intervals: [{
        state: true,
        start: time,
        observed: false,
        end: null
      }]
    };
  });
  this.states.push(state);
}

// Set subset of variables as observed, the rest assumed not.
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
};

// Hypothesis has time, state.
Solver.prototype.addHypothesis = function(h) {
  this.updateVariables();
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newStates = this.applyHypothesis(this.states[i], h);
    if (newStates)
      Array.prototype.push.apply(states, newStates);
  }
  this.states = states;
};

// Observation has time, state, variable.
Solver.prototype.addObservation = function(o) {
  this.updateVariables();
  var states = [];
  for (var i = 0; i < this.states.length; i++) {
    var newState = this.applyObservation(this.states[i], o);
    if (newState)
      states.push(newState);
  }
  this.states = states;
};

// Get set of possible states.
Solver.prototype.getStates = function() {
  this.updateVariables();
  return this.states.slice();
};

// Get consolidated state.
// Each variable has state (true|false|null), change (if false). change
// is number or array (if there is disagreement)
Solver.prototype.getState = function() {
  this.updateVariables();
  // Construct output.
  var out = {};
  var state = this.states[0];
  for (var name in state) {
    var variable = state[name];
    if (variable.state) {
      out[name] = {
        state: variable.state
      };
    } else {
      var time = variable.intervals[variable.intervals.length - 1].end;
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
        if (!out_variable.state) {
          // TODO: check undefined in case interval not updated?
          var change = variable.intervals[variable.intervals.length - 1].end;
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
        out_variable.state = null;
        // In case it was set.
        delete out_variable.time;
      }
    }
    return out;
  }, out);
};

// Update `false` state variables based on false end
// time, if present.
Solver.prototype.updateVariables = function() {
  var time = this._time || Date.now();
  for (var i = 0; i < this.states.length; i++) {
    var state = this.states[i];
    for (var name in state) {
      var variable = state[name];
      // Update changeback.
      if (!variable.state) {
        if (variable.intervals.length > 0) {
          var last = variable.intervals[variable.intervals.length - 1];
          if (last.end && last.end <= time) {
            // update to true.
            variable.state = true;
            variable.intervals.push({
              state: true,
              start: time,
              end: null
            });
          }
        }
      }
    }
  }
};

// Like an observation except probably more powerful.
Solver.prototype.addAssertion = function(o) {
  this.updateVariables();
  var self = this;
  this.states = this.states.filter(function (state) {
    return self.checkAssertion(state, o);
  });
};

Solver.prototype.checkAssertion = function(state, assertion) {
  var variable = state[assertion.variable];
  return variable.state === assertion.state;
};

// Return state with observation applied or null if invalid.
Solver.prototype.applyObservation = function(state, observation) {
  var variable = state[observation.variable];
  if (variable.state && !observation.state) {
    // Change in observed variable true -> false
    variable.state = observation.state;
    variable.intervals.push({
      state: variable.state,
      start: observation.time,
      end: observation.time + STATE_CHANGE
    });
    return state;
  } else if (variable.state && observation.state) {
    // Expected state.
    return state;
  } else if (!variable.state && observation.state) {
    // Potentially updating variable.
    var time = variable.intervals[variable.intervals.length - 1];
    if (eq(time, observation.time)) {
      // update state.
      variable.state = observation.state;
      variable.intervals.push({
        state: observation.state,
        start: observation.time,
        end: null
      });
      return state;
    } else {
      // Could not update this variable.
      return null;
    }
  } else if (!variable.state && !observation.state) {
    // Expected state.
    return state;
  }
};

// Returns multiple states or null if invalid
Solver.prototype.applyHypothesis = function(state, hypothesis) {
  hypothesis = clone(hypothesis);
  var states = [];
  for (var name in state) {
    // Skip observed variables, no guessing with them.
    if (this.variables[name].observed)
      continue;
    var newState = clone(state);
    var variable = newState[name];
    // Hypothesis is always false.
    if (variable.state) {
      // Change in observed variable true -> false
      variable.state = hypothesis.state;
      variable.intervals.push({
        state: variable.state,
        start: hypothesis.time,
        end: hypothesis.time + STATE_CHANGE
      });
    } else {
      newState = null;
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

},{}],11:[function(require,module,exports){
// tagpro startup helpers.
/**
 * EventEmitter interface.
 * Events:
 * - ready: tagpro.ready
 * - start: tagpro object exists
 * - spectating: joined as spectator
 * - join: joined game as player, or from spectator mode.
 */
var TagPro = (function () {
  function setImmediate(fn) {
    setTimeout(function() {
      fn();
    }, 0);
  }

  function findIndex(arr, fn) {
    for (var i = 0; i < arr.length; i++) {
      if (fn(arr[i])) {
        return i;
      }
    }
    return -1;
  }

  function onTagPro(fn, notFirst) {
    if (typeof tagpro !== 'undefined') {
      if (!notFirst) {
        // Force to be async.
        setImmediate(fn);
      } else {
        fn();
      }
    } else {
      setTimeout(function () {
        onTagPro(fn, true);
      }, 20);
    }
  }

  function TagPro() {
    this.callbacks = {
      "tagpro.exists": [],
      "tagpro.ready": [],
      "tagpro.initialized": [],
      "user.spectating": [],
      "user.playing": [],
      "game.pre": [],
      "game.start": [],
      "game.end": [],
      "group": []
    };

    // Track states.
    this.state = {
      "tagpro.start": false,
      "tagpro.ready": false,
      "tagpro.initialized": false,
      "user.spectating": false,
      "user.playing": false,
      "game.pre": false,
      "game.start": false,
      "game.end": false,
      "group": false
    };
    var self = this;
    onTagPro(function () {
      self._init();
      self.emit('start');
    });
  }

  // Initialize listeners for states.
  TagPro.prototype._init = function() {
    var self = this;
    var socket = tagpro.rawSocket;

    function set(type, val) {
      if (!this.state.hasOwnProperty(type)) return;
      this.state[type] = val;
      var arg;
      if (type == "user.playing") {
        if (this.state["user.spectating"]) {
          arg = true;
        }
      }
      console.log("Emitting: %s.", type);
      self.emit(type);
    }

    function get(type) {
      return this.state[type];
    }

    this.on('tagpro.ready', function () {
      // Initialize
      var timeout;
      if (tagpro.spectator) {
        self.state.spectating = true;
        self.emit('user.spectating');
      } else {
        // Emit playing if not spectator.
        timeout = setTimeout(function () {
          console.log("PLAYING@@@@@@@@@@@@");
          self.emit('user.playing');
        }, 2e3);
      }

      // Set up socket listeners.
      tagpro.socket.on('spectator', function (spectating) {
        if (spectating) {
          self.state.spectating = true;
          if (timeout) {
            // Don't emit playing.
            clearTimeout(timeout);
          }
          self.emit('user.spectating');
        } else {
          // Joining game from spectating.
          if (self.state.spectating) {
            self.state.spectating = false;
            self.emit('user.playing');
          }
        }
      });
    });

    setImmediate(function () {
      tagpro.ready(function () {
        console.log("READY@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
        self.emit('tagpro.ready');
      });
    });
  };

  TagPro.prototype.on = function(name, fn) {
    if (!this.callbacks.hasOwnProperty(name)) {
      this.callbacks[name] = [];
    }
    this.callbacks[name].push(fn);
  };

  TagPro.prototype.off = function(name, fn) {
    if (this.callbacks.hasOwnProperty(name)) {
      var i = findIndex(this.callbacks[name], function (elt) {
        if (typeof elt == "object") {
          return elt.fn === fn;
        } else {
          return elt === fn;
        }
      });
      if (i !== -1) {
        this.callbacks[name].splice(i, 1);
      }
    }
  };

  TagPro.prototype.once = function(name, fn) {
    if (!this.callbacks.hasOwnProperty(name)) {
      this.callbacks[name] = [];
    }
    this.callbacks[name].push({
      fn: fn
    });
  };

  // @private
  TagPro.prototype.emit = function(name) {
    if (this.callbacks.hasOwnProperty(name)) {
      var callbacks = this.callbacks[name];
      for (var i = 0; i < callbacks.length; i++) {
        var fn = callbacks[i];
        // Handle 'once' items.
        if (typeof fn == "object") {
          callbacks.splice(i, 1);
          i--;
          fn = fn.fn;
        }
        fn();
      }
    }
  };

  return new TagPro();
})();

module.exports = TagPro;

},{}],12:[function(require,module,exports){
var Vec2 = require('./vec2');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var TILE_WIDTH = 40;

var tileIds = [5, 6, 10, 14, 15];
var tileStrings = {
  5: "boost",
  6: "powerup",
  10: "bomb",
  14: "boost",
  15: "boost"
};

var tileTypes = {
  powerup: {
    active: [6.1, 6.2, 6.3, 6.4],
    inactive: [6]
  },
  bomb: {
    active: [10],
    inactive: [10.1]
  },
  boost: {
    active: [5, 14, 15],
    inactive: [5.1, 14.1, 15.1]
  }
};

// Tile events can take a specific tile or a tile type, probably.
// Allows adding listener for tiles coming into view.
// Browser-specific.
// events put out are like n.enter, n.leave, n.update where n is floor of tile id you're interested in
// callback gets tile vec with x, y, and boolean for active
// default listens for boost, bomb, powerup.
function TileEvents() {
  EventEmitter.apply(this, arguments);
  var self = this;
  // Types to listen for.
  this.tiles = [];
  this.listeners = {};
  this.in_view = [];
  this.checkInterval = 250;
  this.interval = setInterval(this._interval.bind(this), this.checkInterval);
  this.range = {
    x: 660,
    y: 420
  };
  tagpro.map.forEach(function (row, x) {
    row.forEach(function (v, y) {
      if (Math.floor(v) === 6) {
        self.tiles.push(new Vec2(x, y));
      }
    });
  });
  // only do pups now
  tagpro.socket.on('mapupdate', function (updates) {
    if (!Array.isArray(updates)) {
      updates = [updates];
    }
    updates.forEach(function (event) {
      if (Math.floor(event.v) === 6) {
        var e = {
          location: new Vec2(event.x, event.y),
          state: event.v !== 6,
          time: Date.now()
        };
        self.emit("powerup.update", e);
      }
    });
  });
}

util.inherits(TileEvents, EventEmitter);
module.exports = TileEvents;

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
    var diff = tile.mulc(TILE_WIDTH, true).sub(location).abs();
    var in_view = (diff.x < this.range.x && diff.y < this.range.y);
    var id = tile.toString();
    var already_in_view = self.in_view.indexOf(id) !== -1;
    if (in_view && !already_in_view) {
      self.in_view.push(id);
      enter.push(tile.clone());
    } else if (!in_view && already_in_view) {
      leave.push(tile);
      var i = self.in_view.indexOf(id);
      self.in_view.splice(i, 1);
    }
  }, this);
  enter.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("powerup.enter", {
      location: tile,
      state: val !== 6,
      time: time
    });
  });
  leave.forEach(function (tile) {
    var val = tagpro.map[tile.x][tile.y];
    self.emit("powerup.leave", {
      location: tile,
      state: val !== 6,
      time: time
    });
  });
};

},{"./vec2":13,"events":1,"util":5}],13:[function(require,module,exports){
function Vec2(x, y) {
    this.x = x;
    this.y = y;
}

module.exports = Vec2;

Vec2.toString = function(v) {
    return "(" + v.x + "," + v.y + ")";
};

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

},{}]},{},[7])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsInNyYy9saW5lLmpzIiwic3JjL21haW4uanMiLCJzcmMvb3ZlcmxheS5qcyIsInNyYy9wb3dlcnVwLXRyYWNrZXIuanMiLCJzcmMvc29sdmVyLmpzIiwic3JjL3RhZ3Byby5qcyIsInNyYy90aWxlLWV2ZW50cy5qcyIsInNyYy92ZWMyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDMWtCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cbiIsInZhciBQb2ludCA9IHJlcXVpcmUoXCIuL3ZlYzJcIik7XHJcblxyXG4vKipcclxuICogRWRnZXMgYXJlIHVzZWQgdG8gcmVwcmVzZW50IHRoZSBib3JkZXIgYmV0d2VlbiB0d28gYWRqYWNlbnRcclxuICogcG9seWdvbnMuIENhbiBiZSBjYWxsZWQgMiB3YXlzLlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQGV4YW1wbGUgPGNhcHRpb24+Q29uc3RydWN0aW5nIGZyb20gUG9pbnQgb2JqZWN0cy48L2NhcHRpb24+XHJcbiAqICAgdmFyIGUgPSBuZXcgRWRnZShwMSwgcDIpXHJcbiAqIEBleGFtcGxlIDxjYXB0aW9uPkZyb20gYW4gYXJyYXkgb2YgdmFsdWVzLjwvY2FwdGlvbj5cclxuICogICB2YXIgZSA9IG5ldyBFZGdlKFt4MSwgeTEsIHgyLCB5Ml0pXHJcbiAqL1xyXG5mdW5jdGlvbiBMaW5lKHAxLCBwMikge1xyXG4gIGlmIChBcnJheS5pc0FycmF5KHAxKSkge1xyXG4gICAgdmFyIHBvaW50cyA9IHAxO1xyXG4gICAgdGhpcy5wMSA9IG5ldyBQb2ludChwb2ludHNbMF0sIHBvaW50c1sxXSk7XHJcbiAgICB0aGlzLnAyID0gbmV3IFBvaW50KHBvaW50c1syXSwgcG9pbnRzWzNdKTtcclxuICB9IGVsc2Uge1xyXG4gICAgdGhpcy5wMSA9IHAxLmNsb25lKCk7XHJcbiAgICB0aGlzLnAyID0gcDIuY2xvbmUoKTtcclxuICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTGluZTtcclxuXHJcbkxpbmUucHJvdG90eXBlLl9DQ1cgPSBmdW5jdGlvbihwMSwgcDIsIHAzKSB7XHJcbiAgYSA9IHAxLng7IGIgPSBwMS55O1xyXG4gIGMgPSBwMi54OyBkID0gcDIueTtcclxuICBlID0gcDMueDsgZiA9IHAzLnk7XHJcbiAgcmV0dXJuIChmIC0gYikgKiAoYyAtIGEpID4gKGQgLSBiKSAqIChlIC0gYSk7XHJcbn07XHJcblxyXG4vKipcclxuICogZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjcyNTcxNVxyXG4gKiBDaGVja3Mgd2hldGhlciB0aGlzIGVkZ2UgaW50ZXJzZWN0cyB0aGUgcHJvdmlkZWQgZWRnZS5cclxuICogQHBhcmFtIHtFZGdlfSBlZGdlIC0gVGhlIGVkZ2UgdG8gY2hlY2sgaW50ZXJzZWN0aW9uIGZvci5cclxuICogQHJldHVybiB7Ym9vbGVhbn0gLSBXaGV0aGVyIG9yIG5vdCB0aGUgZWRnZXMgaW50ZXJzZWN0LlxyXG4gKi9cclxuTGluZS5wcm90b3R5cGUuaW50ZXJzZWN0cyA9IGZ1bmN0aW9uKGxpbmUpIHtcclxuICB2YXIgcTEgPSBsaW5lLnAxLCBxMiA9IGxpbmUucDI7XHJcbiAgaWYgKHExLmVxKHRoaXMucDEpIHx8IHExLmVxKHRoaXMucDIpIHx8IHEyLmVxKHRoaXMucDEpIHx8IHEyLmVxKHRoaXMucDIpKSByZXR1cm4gZmFsc2U7XHJcbiAgcmV0dXJuICh0aGlzLl9DQ1codGhpcy5wMSwgcTEsIHEyKSAhPSB0aGlzLl9DQ1codGhpcy5wMiwgcTEsIHEyKSkgJiZcclxuICAgICh0aGlzLl9DQ1codGhpcy5wMSwgdGhpcy5wMiwgcTEpICE9IHRoaXMuX0NDVyh0aGlzLnAxLCB0aGlzLnAyLCBxMikpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgcG9pbnQgb2YgaW50ZXJzZWN0aW9uLCBvciBudWxsIGlmIHRoZSBlZGdlcyBkbyBub3RcclxuICogaW50ZXJzZWN0LlxyXG4gKiBAcGFyYW0ge0xpbmV9IGxpbmUgLSBUaGUgb3RoZXIgbGluZSB0byB1c2UuXHJcbiAqIEByZXR1cm4ge1ZlYzI/fSAtIFRoZSBwb2ludCBvZiBpbnRlcnNlY3Rpb24sIG9yIG51bGwgaWYgdGhlIGVkZ2VzXHJcbiAqICAgZG8gbm90IGludGVyc2VjdCBvciBpZiBjb2xpbmVhci5cclxuICovXHJcbkxpbmUucHJvdG90eXBlLmludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKGxpbmUpIHtcclxuICB2YXIgcCA9IHRoaXMucDEuY2xvbmUoKSxcclxuICAgICAgciA9IHRoaXMucDIuc3ViKHRoaXMucDEsIHRydWUpLFxyXG4gICAgICBxID0gbGluZS5wMS5jbG9uZSgpLFxyXG4gICAgICBzID0gbGluZS5wMi5zdWIobGluZS5wMSwgdHJ1ZSk7XHJcbiAgdmFyIGRlbm9taW5hdG9yID0gci5jcm9zcyhzKTtcclxuICBpZiAoZGVub21pbmF0b3IgIT09IDApIHtcclxuICAgIHEuc3ViKHApO1xyXG4gICAgdmFyIHQgPSBxLmNyb3NzKHMpIC8gZGVub21pbmF0b3IsXHJcbiAgICAgICAgdSA9IHEuY3Jvc3MocikgLyBkZW5vbWluYXRvcjtcclxuICAgIGlmICh0ID49IDAgJiYgdCA8PSAxICYmIHUgPj0gMCAmJiB1IDw9IDEpIHtcclxuICAgICAgcmV0dXJuIHAuYWRkKHIubXVsYyh0KSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBEb24ndCBpbnRlcnNlY3QuXHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBDb2xpbmVhciBvciBwYXJhbGxlbC5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBUcmFuc2xhdGUgZWRnZSBhbG9uZyBhIHZlY3Rvci5cclxuICogQHBhcmFtIHtWZWMyfSB2IC0gVGhlIHZlY3RvciB0byB0cmFuc2xhdGUgYWxvbmcuXHJcbiAqIEByZXR1cm4ge0xpbmV9IC0gVGhlIHRyYW5zbGF0ZWQgZWRnZS5cclxuICovXHJcbkxpbmUucHJvdG90eXBlLnRyYW5zbGF0ZSA9IGZ1bmN0aW9uKHYsIHJldHVybk5ldykge1xyXG4gIGlmIChyZXR1cm5OZXcpIHtcclxuICAgIHJldHVybiBuZXcgTGluZSh0aGlzLnAxLmFkZCh2LCB0cnVlKSwgdGhpcy5wMi5hZGQodiwgdHJ1ZSkpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0aGlzLnAxLmFkZCh2KTtcclxuICAgIHRoaXMucDIuYWRkKHYpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNjYWxlIGVkZ2UgYnkgZ2l2ZW4gdmFsdWUuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBjIC0gVmFsdWUgdG8gc2NhbGUgZWRnZSBwb2ludHMgYnkuXHJcbiAqIEByZXR1cm4ge0xpbmV9IC0gVGhlIHNjYWxlZCBlZGdlLlxyXG4gKi9cclxuTGluZS5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbihjLCByZXR1cm5OZXcpIHtcclxuICBpZiAocmV0dXJuTmV3KSB7XHJcbiAgICByZXR1cm4gbmV3IExpbmUodGhpcy5wMS5tdWxjKGMsIHRydWUpLCB0aGlzLnAyLm11bGMoYywgdHJ1ZSkpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0aGlzLnAxLm11bGMoYyk7XHJcbiAgICB0aGlzLnAyLm11bGMoYyk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcbn07XHJcblxyXG5MaW5lLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBuZXcgTGluZSh0aGlzLnAxLmNsb25lKCksIHRoaXMucDIuY2xvbmUoKSk7XHJcbn07XHJcbiIsInZhciBQb3dlcnVwVHJhY2tlciA9IHJlcXVpcmUoJy4vcG93ZXJ1cC10cmFja2VyJyk7XHJcbnZhciBPdmVybGF5ID0gcmVxdWlyZSgnLi9vdmVybGF5Jyk7XHJcbnZhciBUYWdQcm8gPSByZXF1aXJlKCcuL3RhZ3BybycpO1xyXG5cclxuVGFnUHJvLm9uKCd1c2VyLnBsYXlpbmcnLCBmdW5jdGlvbiAoKSB7XHJcbiAgdmFyIHRyYWNrZXIgPSBuZXcgUG93ZXJ1cFRyYWNrZXIoKTtcclxuICB2YXIgb3ZlcmxheSA9IG5ldyBPdmVybGF5KHRyYWNrZXIpO1xyXG59KTtcclxuIiwidmFyIFZlYzIgPSByZXF1aXJlKCcuL3ZlYzInKTtcclxudmFyIExpbmUgPSByZXF1aXJlKCcuL2xpbmUnKTtcclxuXHJcbnZhciBUSUxFX1dJRFRIID0gNDA7XHJcbnZhciBVdGlscyA9IHtcclxuICBtYWtlVGV4dDogZnVuY3Rpb24gKGNvbG9yKSB7XHJcbiAgICBpZiAodHlwZW9mIGNvbG9yID09ICd1bmRlZmluZWQnKSBjb2xvciA9IFwiI0ZGRkZGRlwiO1xyXG4gICAgdmFyIHRleHQgPSBuZXcgUElYSS5UZXh0KFwiXCIsIHtcclxuICAgICAgICBmb250OiBcImJvbGQgMTBwdCBBcmlhbFwiLFxyXG4gICAgICAgIGZpbGw6IGNvbG9yLFxyXG4gICAgICAgIHN0cm9rZTogXCIjMDAwMDAwXCIsXHJcbiAgICAgICAgc3Ryb2tlVGhpY2tuZXNzOiAzLFxyXG4gICAgICAgIGFsaWduOiBcImNlbnRlclwiXHJcbiAgICB9KTtcclxuICAgIHRleHQuYW5jaG9yID0gbmV3IFBJWEkuUG9pbnQoMC41LCAwLjUpO1xyXG4gICAgdGV4dC52aXNpYmxlID0gZmFsc2U7XHJcbiAgICByZXR1cm4gdGV4dDtcclxuICB9XHJcbn07XHJcblxyXG4vLyBWYXJpb3VzIGRyYXdpbmdzLlxyXG4vLyBEcmF3aW5nIGhhcyBwcm9wZXJ0aWVzIGluaXQsIHVwZGF0ZSwgaGlkZSwgc2hvdy5cclxudmFyIGRyYXdpbmdzID0gW1xyXG4gIHsgLy8gUG93ZXJ1cHMuXHJcbiAgICBpbml0OiBmdW5jdGlvbiAodHJhY2tlcikge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIkluaXRpYWxpemluZyBwb3dlcnVwIG92ZXJsYXkuXCIpO1xyXG4gICAgICB0aGlzLnRyYWNrZXIgPSB0cmFja2VyO1xyXG4gICAgICBcclxuICAgICAgLy8gVE9ETzogbm8gaGFyZCBjb2RlXHJcbiAgICAgIHRoaXMucG93ZXJ1cF9yZXNwYXduID0gNjBlMztcclxuICAgICAgdmFyIHBvd2VydXBzID0gdGhpcy50cmFja2VyLmdldFBvd2VydXBzKCk7XHJcbiAgICAgIHRoaXMuZGVidWcgPSBuZXcgUElYSS5HcmFwaGljcygpO1xyXG4gICAgICB0YWdwcm8ucmVuZGVyZXIuZ2FtZUNvbnRhaW5lci5hZGRDaGlsZCh0aGlzLmRlYnVnKTtcclxuICAgICAgdGhpcy5faW5pdEluZGljYXRvcnMocG93ZXJ1cHMpO1xyXG4gICAgICB0aGlzLl9pbml0VGlsZXMocG93ZXJ1cHMpO1xyXG4gICAgfSxcclxuICAgIC8vIEluaXRpYWxpemUgd2luZG93IHNpZGUgaW5kaWNhdG9ycy5cclxuICAgIF9pbml0SW5kaWNhdG9yczogZnVuY3Rpb24gKHBvd2VydXBzKSB7XHJcbiAgICAgIC8vIE9mZnNldCBvZiBpbmRpY2F0b3JzIGZyb20gc2lkZSBvZiB3aW5kb3cuXHJcbiAgICAgIHRoaXMuaW5kaWNhdG9yX29mZnNldCA9IDUwO1xyXG4gICAgICB0aGlzLmluZGljYXRvcl91aSA9IG5ldyBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIoKTtcclxuICAgICAgdGFncHJvLnJlbmRlcmVyLmxheWVycy51aS5hZGRDaGlsZCh0aGlzLmluZGljYXRvcl91aSk7XHJcbiAgICAgIHZhciB0ZXh0dXJlID0gdGhpcy5fZ2V0SW5kaWNhdG9yVGV4dHVyZSgpO1xyXG5cclxuICAgICAgdGhpcy5pbmRpY2F0b3JzID0ge307XHJcbiAgICAgIHBvd2VydXBzLmZvckVhY2goZnVuY3Rpb24gKHBvd2VydXApIHtcclxuICAgICAgICB2YXIgc3ByaXRlID0gbmV3IFBJWEkuU3ByaXRlKHRleHR1cmUpO1xyXG4gICAgICAgIHNwcml0ZS5hbmNob3IgPSBuZXcgUElYSS5Qb2ludCgwLjUsIDAuNSk7XHJcbiAgICAgICAgdGhpcy5pbmRpY2F0b3JfdWkuYWRkQ2hpbGQoc3ByaXRlKTtcclxuICAgICAgICB2YXIgdCA9IFV0aWxzLm1ha2VUZXh0KCk7XHJcbiAgICAgICAgdGhpcy5pbmRpY2F0b3JfdWkuYWRkQ2hpbGQodCk7XHJcbiAgICAgICAgdGhpcy5pbmRpY2F0b3JzW3Bvd2VydXAuaWRdID0ge1xyXG4gICAgICAgICAgc3ByaXRlOiBzcHJpdGUsXHJcbiAgICAgICAgICB0ZXh0OiB0XHJcbiAgICAgICAgfTtcclxuICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICQoXCIjdmlld3BvcnRcIikucmVzaXplKHRoaXMuX29uUmVzaXplLmJpbmQodGhpcykpO1xyXG4gICAgICB0aGlzLl9vblJlc2l6ZSgpOyAgICAgIFxyXG4gICAgfSxcclxuICAgIC8vIEluaXRpYWxpemUgdGlsZSBvdmVybGF5cy5cclxuICAgIF9pbml0VGlsZXM6IGZ1bmN0aW9uIChwb3dlcnVwcykge1xyXG4gICAgICB0aGlzLnRpbGVfdWkgPSBuZXcgUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyKCk7XHJcbiAgICAgIHRhZ3Byby5yZW5kZXJlci5sYXllcnMuZm9yZWdyb3VuZC5hZGRDaGlsZCh0aGlzLnRpbGVfdWkpO1xyXG4gICAgICB0aGlzLnRpbGVfb3ZlcmxheXMgPSB7fTtcclxuICAgICAgcG93ZXJ1cHMuZm9yRWFjaChmdW5jdGlvbiAocG93ZXJ1cCkge1xyXG4gICAgICAgIHZhciB0ID0gVXRpbHMubWFrZVRleHQoKTtcclxuICAgICAgICB0aGlzLnRpbGVfdWkuYWRkQ2hpbGQodCk7XHJcbiAgICAgICAgdGhpcy50aWxlX292ZXJsYXlzW3Bvd2VydXAuaWRdID0ge1xyXG4gICAgICAgICAgdGV4dDogdFxyXG4gICAgICAgIH07XHJcbiAgICAgIH0sIHRoaXMpO1xyXG4gICAgfSxcclxuICAgIC8vIEZ1bmN0aW9uIGNhbGxlZCBvbiB2aWV3cG9ydCByZXNpemUuXHJcbiAgICBfb25SZXNpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyIHZpZXdwb3J0ID0gJChcIiN2aWV3cG9ydFwiKTtcclxuICAgICAgdGhpcy5pbmRpY2F0b3JfbGluZXMgPSBbXTtcclxuICAgICAgLy8gVG9wLlxyXG4gICAgICB0aGlzLmluZGljYXRvcl9saW5lcy5wdXNoKG5ldyBMaW5lKFtcclxuICAgICAgICB0aGlzLmluZGljYXRvcl9vZmZzZXQsIHRoaXMuaW5kaWNhdG9yX29mZnNldCxcclxuICAgICAgICB2aWV3cG9ydC53aWR0aCgpIC0gdGhpcy5pbmRpY2F0b3Jfb2Zmc2V0LCB0aGlzLmluZGljYXRvcl9vZmZzZXRcclxuICAgICAgXSkpO1xyXG4gICAgICAvLyBSaWdodC5cclxuICAgICAgdGhpcy5pbmRpY2F0b3JfbGluZXMucHVzaChuZXcgTGluZShbXHJcbiAgICAgICAgdmlld3BvcnQud2lkdGgoKSAtIHRoaXMuaW5kaWNhdG9yX29mZnNldCwgdGhpcy5pbmRpY2F0b3Jfb2Zmc2V0LFxyXG4gICAgICAgIHZpZXdwb3J0LndpZHRoKCkgLSB0aGlzLmluZGljYXRvcl9vZmZzZXQsIHZpZXdwb3J0LmhlaWdodCgpIC0gdGhpcy5pbmRpY2F0b3Jfb2Zmc2V0XHJcbiAgICAgIF0pKTtcclxuICAgICAgLy8gQm90dG9tLlxyXG4gICAgICB0aGlzLmluZGljYXRvcl9saW5lcy5wdXNoKG5ldyBMaW5lKFtcclxuICAgICAgICB2aWV3cG9ydC53aWR0aCgpIC0gdGhpcy5pbmRpY2F0b3Jfb2Zmc2V0LCB2aWV3cG9ydC5oZWlnaHQoKSAtIHRoaXMuaW5kaWNhdG9yX29mZnNldCxcclxuICAgICAgICB0aGlzLmluZGljYXRvcl9vZmZzZXQsIHZpZXdwb3J0LmhlaWdodCgpIC0gdGhpcy5pbmRpY2F0b3Jfb2Zmc2V0XHJcbiAgICAgIF0pKTtcclxuICAgICAgLy8gTGVmdC5cclxuICAgICAgdGhpcy5pbmRpY2F0b3JfbGluZXMucHVzaChuZXcgTGluZShbXHJcbiAgICAgICAgdGhpcy5pbmRpY2F0b3Jfb2Zmc2V0LCB2aWV3cG9ydC5oZWlnaHQoKSAtIHRoaXMuaW5kaWNhdG9yX29mZnNldCxcclxuICAgICAgICB0aGlzLmluZGljYXRvcl9vZmZzZXQsIHRoaXMuaW5kaWNhdG9yX29mZnNldFxyXG4gICAgICBdKSk7XHJcbiAgICB9LFxyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciBwb3dlcnVwcyA9IHRoaXMudHJhY2tlci5nZXRQb3dlcnVwcygpO1xyXG4gICAgICB2YXIgdmlzaWJsZV9wb3dlcnVwcyA9IFtdO1xyXG4gICAgICB2YXIgb2Zmc2NyZWVuX3Bvd2VydXBzID0gW107XHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG93ZXJ1cHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgcG93ZXJ1cCA9IHBvd2VydXBzW2ldO1xyXG4gICAgICAgIC8vIFRPRE86IExpbWl0IHRvIHRpbGUgdmlzaWJpbGl0eSBieSBwbGF5ZXIuXHJcbiAgICAgICAgaWYgKHBvd2VydXAudmlzaWJsZSkge1xyXG4gICAgICAgICAgdmlzaWJsZV9wb3dlcnVwcy5wdXNoKHBvd2VydXApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBvZmZzY3JlZW5fcG93ZXJ1cHMucHVzaChwb3dlcnVwKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgdmlzaWJsZV9wb3dlcnVwcy5mb3JFYWNoKHRoaXMuX2hpZGVJbmRpY2F0b3IsIHRoaXMpO1xyXG4gICAgICBvZmZzY3JlZW5fcG93ZXJ1cHMuZm9yRWFjaCh0aGlzLl9oaWRlVGlsZU92ZXJsYXksIHRoaXMpO1xyXG4gICAgICB0aGlzLl9kcmF3SW5kaWNhdG9ycyhvZmZzY3JlZW5fcG93ZXJ1cHMpO1xyXG4gICAgICB0aGlzLl9kcmF3VGlsZU92ZXJsYXlzKHZpc2libGVfcG93ZXJ1cHMpO1xyXG4gICAgfSxcclxuICAgIC8vIERyYXcgaW5kaWNhdG9ycyBmb3Igb2ZmLXNjcmVlbiBwb3dlcnVwcy5cclxuICAgIF9kcmF3SW5kaWNhdG9yczogZnVuY3Rpb24gKHBvd2VydXBzKSB7XHJcbiAgICAgIHZhciBzY2FsZSA9IHRhZ3Byby5yZW5kZXJlci5nYW1lQ29udGFpbmVyLnNjYWxlLng7XHJcbiAgICAgIHZhciBnYW1lQ29udGFpbmVyID0gdGFncHJvLnJlbmRlcmVyLmdhbWVDb250YWluZXI7XHJcbiAgICAgIHZhciBnYW1lTG9jYXRpb24gPSBuZXcgVmVjMihnYW1lQ29udGFpbmVyLngsIGdhbWVDb250YWluZXIueSkuZGl2Yygtc2NhbGUpO1xyXG4gICAgICAvLyBDb252ZXJ0IGluZGljYXRvciBsaW5lcyB0byBnYW1lIGNvb3JkaW5hdGVzLlxyXG4gICAgICB2YXIgaW5kaWNhdG9yX2xpbmVzID0gdGhpcy5pbmRpY2F0b3JfbGluZXMubWFwKGZ1bmN0aW9uIChsaW5lKSB7XHJcbiAgICAgICAgcmV0dXJuIGxpbmUuY2xvbmUoKS5zY2FsZSgxIC8gc2NhbGUpLnRyYW5zbGF0ZShnYW1lTG9jYXRpb24pO1xyXG4gICAgICB9KTtcclxuICAgICAgdmFyIHZpZXdwb3J0ID0gJChcIiN2aWV3cG9ydFwiKTtcclxuICAgICAgLy8gQ2VudGVyIGluIGdhbWUgY29vcmRpbmF0ZXMuXHJcbiAgICAgIHZhciBjZW50ZXIgPSBuZXcgVmVjMih2aWV3cG9ydC53aWR0aCgpLCB2aWV3cG9ydC5oZWlnaHQoKSlcclxuICAgICAgICAuZGl2YygyKVxyXG4gICAgICAgIC5kaXZjKHNjYWxlKVxyXG4gICAgICAgIC5hZGQoZ2FtZUxvY2F0aW9uKTtcclxuXHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG93ZXJ1cHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgcG93ZXJ1cCA9IHBvd2VydXBzW2ldO1xyXG4gICAgICAgIHZhciBpbmRpY2F0b3IgPSB0aGlzLmluZGljYXRvcnNbcG93ZXJ1cC5pZF07XHJcbiAgICAgICAgaWYgKHBvd2VydXAudmlzaWJsZSkge1xyXG4gICAgICAgICAgLy8gVE9ETzogbWF5YmUgY2hhbmdlIHRoZSBidWZmZXIgYSBsaXR0bGUgaGVyZS5cclxuICAgICAgICAgIGluZGljYXRvci5zcHJpdGUudmlzaWJsZSA9IGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBHZXQgdGV4dCBmb3IgaW5kaWNhdG9yLlxyXG4gICAgICAgICAgdmFyIHRleHQ7XHJcbiAgICAgICAgICBpZiAocG93ZXJ1cC5zdGF0ZSkge1xyXG4gICAgICAgICAgICAvLyBUT0RPOiBJY29uIGlmIHZhbHVlIGtub3duLlxyXG4gICAgICAgICAgICB0ZXh0ID0gXCIhXCI7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwb3dlcnVwLnRpbWUpKSB7XHJcbiAgICAgICAgICAgICAgLy8gVE9ETzogSGFuZGxlIG11bHRpcGxlIHBvc3NpYmlsaXRpZXMuXHJcbiAgICAgICAgICAgICAgdGV4dCA9IFwiP1wiO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIHZhciByZXNwYXduX3RpbWUgPSBwb3dlcnVwLnRpbWUgJiYgcG93ZXJ1cC50aW1lIC0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgICBpZiAocmVzcGF3bl90aW1lICYmIHJlc3Bhd25fdGltZSA+IDApIHtcclxuICAgICAgICAgICAgICAgIHRleHQgPSAocmVzcGF3bl90aW1lIC8gMWUzKS50b0ZpeGVkKDEpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0ZXh0ID0gXCI/XCI7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB2YXIgZHJhdyA9IGZhbHNlO1xyXG4gICAgICAgICAgdmFyIGxvYyA9IHBvd2VydXAubG9jYXRpb24ubXVsYyhUSUxFX1dJRFRILCB0cnVlKS5hZGRjKFRJTEVfV0lEVEggLyAyKTtcclxuICAgICAgICAgIC8vIExpbmUgZnJvbSBjZW50ZXIgdG8gdGlsZS5cclxuICAgICAgICAgIHZhciBsaW5lID0gbmV3IExpbmUoY2VudGVyLCBsb2MpO1xyXG4gICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBpbmRpY2F0b3JfbGluZXMubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgdmFyIGluZGljYXRvcl9saW5lID0gaW5kaWNhdG9yX2xpbmVzW2pdO1xyXG4gICAgICAgICAgICB2YXIgaW50ZXJzZWN0aW9uID0gaW5kaWNhdG9yX2xpbmUuaW50ZXJzZWN0aW9uKGxpbmUpO1xyXG4gICAgICAgICAgICBpZiAoaW50ZXJzZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgZHJhdyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgaW50ZXJzZWN0aW9uLnN1YihnYW1lTG9jYXRpb24pLm11bGMoc2NhbGUpO1xyXG4gICAgICAgICAgICAgIGluZGljYXRvci5zcHJpdGUueCA9IGludGVyc2VjdGlvbi54O1xyXG4gICAgICAgICAgICAgIGluZGljYXRvci5zcHJpdGUueSA9IGludGVyc2VjdGlvbi55O1xyXG4gICAgICAgICAgICAgIGluZGljYXRvci5zcHJpdGUucm90YXRpb24gPSBsb2Muc3ViKGNlbnRlcikuYW5nbGUoKTtcclxuICAgICAgICAgICAgICBpbmRpY2F0b3IudGV4dC54ID0gaW50ZXJzZWN0aW9uLng7XHJcbiAgICAgICAgICAgICAgaW5kaWNhdG9yLnRleHQueSA9IGludGVyc2VjdGlvbi55O1xyXG4gICAgICAgICAgICAgIGluZGljYXRvci50ZXh0LnNldFRleHQodGV4dCk7XHJcbiAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBpZiAoIWRyYXcpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGZpbmRpbmcgb3ZlcmxheSBwb3NpdGlvbiBmb3IgcG93ZXJ1cCBpbmRpY2F0b3IuXCIpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaW5kaWNhdG9yLnNwcml0ZS52aXNpYmxlID0gdHJ1ZTtcclxuICAgICAgICAgICAgaW5kaWNhdG9yLnRleHQudmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgLy8gR2V0IGluZGljYXRvciB0ZXh0dXJlIGZvciBzcHJpdGUuXHJcbiAgICBfZ2V0SW5kaWNhdG9yVGV4dHVyZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICB2YXIgZyA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XHJcbiAgICAgIGcuY2xlYXIoKTtcclxuICAgICAgZy5saW5lU3R5bGUoMSwgMHhmZmZmZmYsIDAuOSk7XHJcbiAgICAgIHZhciBpbmRpY2F0b3Jfc2l6ZSA9IDE4O1xyXG4gICAgICB2YXIgY29udGFpbmVyX3NpemUgPSBpbmRpY2F0b3Jfc2l6ZSAqIDIgKyAxMCAqIDI7XHJcbiAgICAgIC8vIENpcmNsZS5cclxuICAgICAgZy5iZWdpbkZpbGwoMHhGRkZGRkYsIDAuOSk7XHJcbiAgICAgIGcuZHJhd0NpcmNsZShjb250YWluZXJfc2l6ZSAvIDIsIGNvbnRhaW5lcl9zaXplIC8gMiwgaW5kaWNhdG9yX3NpemUpO1xyXG4gICAgICAvLyBQb2ludGVyLlxyXG4gICAgICB2YXIgdHJpYW5nbGVfc2l6ZSA9IDY7XHJcbiAgICAgIHZhciBwb2ludGVyX2Jhc2UgPSBjb250YWluZXJfc2l6ZSAvIDIgKyBpbmRpY2F0b3Jfc2l6ZTtcclxuICAgICAgZy5kcmF3U2hhcGUobmV3IFBJWEkuUG9seWdvbihbXHJcbiAgICAgICAgcG9pbnRlcl9iYXNlLCBjb250YWluZXJfc2l6ZSAvIDIgLSB0cmlhbmdsZV9zaXplIC8gMixcclxuICAgICAgICBwb2ludGVyX2Jhc2UgKyB0cmlhbmdsZV9zaXplLCBjb250YWluZXJfc2l6ZSAvIDIsXHJcbiAgICAgICAgcG9pbnRlcl9iYXNlLCBjb250YWluZXJfc2l6ZSAvIDIgKyB0cmlhbmdsZV9zaXplIC8gMixcclxuICAgICAgICBwb2ludGVyX2Jhc2UsIGNvbnRhaW5lcl9zaXplIC8gMiAtIHRyaWFuZ2xlX3NpemUgLyAyLFxyXG4gICAgICBdKSk7XHJcbiAgICAgIGcuZW5kRmlsbCgpO1xyXG4gICAgICAvLyBJbnZpc2libGUgbGluZSBzbyBnZW5lcmF0ZWQgdGV4dHVyZSBpcyBjZW50ZXJlZCBvbiBjaXJjbGUuXHJcbiAgICAgIGcubGluZVN0eWxlKDAsIDAsIDApO1xyXG4gICAgICBnLm1vdmVUbygxMCwgY29udGFpbmVyX3NpemUgLyAyKTtcclxuICAgICAgZy5saW5lVG8oMTAgLSB0cmlhbmdsZV9zaXplLCBjb250YWluZXJfc2l6ZSAvIDIpO1xyXG4gICAgICByZXR1cm4gZy5nZW5lcmF0ZVRleHR1cmUoKTtcclxuICAgIH0sXHJcbiAgICAvLyBIaWRlIGluZGljYXRvci5cclxuICAgIF9oaWRlSW5kaWNhdG9yOiBmdW5jdGlvbiAocG93ZXJ1cCkge1xyXG4gICAgICB2YXIgaW5kaWNhdG9yID0gdGhpcy5pbmRpY2F0b3JzW3Bvd2VydXAuaWRdO1xyXG4gICAgICBpbmRpY2F0b3IudGV4dC52aXNpYmxlID0gZmFsc2U7XHJcbiAgICAgIGluZGljYXRvci5zcHJpdGUudmlzaWJsZSA9IGZhbHNlO1xyXG4gICAgfSxcclxuICAgIC8vIERyYXcgb3ZlcmxheXMgb24gdmlzaWJsZSBwb3dlcnVwcy5cclxuICAgIF9kcmF3VGlsZU92ZXJsYXlzOiBmdW5jdGlvbiAocG93ZXJ1cHMpIHtcclxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb3dlcnVwcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBwb3dlcnVwID0gcG93ZXJ1cHNbaV07XHJcbiAgICAgICAgdmFyIHRleHQgPSB0aGlzLnRpbGVfb3ZlcmxheXNbcG93ZXJ1cC5pZF0udGV4dDtcclxuICAgICAgICBpZiAocG93ZXJ1cC5zdGF0ZSkge1xyXG4gICAgICAgICAgdGV4dC52aXNpYmxlID0gZmFsc2U7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdmFyIGxvYyA9IHBvd2VydXAubG9jYXRpb24ubXVsYyhUSUxFX1dJRFRILCB0cnVlKS5hZGRjKFRJTEVfV0lEVEggLyAyKTtcclxuICAgICAgICAgIHRleHQudmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgICB0ZXh0LnggPSBsb2MueDtcclxuICAgICAgICAgIHRleHQueSA9IGxvYy55O1xyXG4gICAgICAgICAgdmFyIHJlc3Bhd25fdGltZSA9IHBvd2VydXAudGltZSAmJiBwb3dlcnVwLnRpbWUgLSBEYXRlLm5vdygpO1xyXG4gICAgICAgICAgaWYgKHJlc3Bhd25fdGltZSAmJiByZXNwYXduX3RpbWUgPiAwKSB7XHJcbiAgICAgICAgICAgIHRleHQuc2V0VGV4dCgocmVzcGF3bl90aW1lIC8gMWUzKS50b0ZpeGVkKDEpKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIFRPRE86IFNob3cgcmFuZ2UvZXN0aW1hdGVkIHRpbWUuXHJcbiAgICAgICAgICAgIHRleHQuc2V0VGV4dChcIj9cIik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgLy8gSGlkZSBvdmVybGF5LlxyXG4gICAgX2hpZGVUaWxlT3ZlcmxheTogZnVuY3Rpb24gKHBvd2VydXApIHtcclxuICAgICAgdmFyIHRpbGVfb3ZlcmxheSA9IHRoaXMudGlsZV9vdmVybGF5c1twb3dlcnVwLmlkXTtcclxuICAgICAgdGlsZV9vdmVybGF5LnRleHQudmlzaWJsZSA9IGZhbHNlO1xyXG4gICAgfSxcclxuICAgIHNob3c6IGZ1bmN0aW9uICgpIHtcclxuXHJcbiAgICB9LFxyXG4gICAgaGlkZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAvLyBSZXNldCBzbyB3ZSBzZWUgc3RhdGUgYWdhaW4uXHJcbiAgICAgIHRoaXMubG9nZ2VkID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5dO1xyXG5cclxuLyoqXHJcbiAqIFZpc3VhbCBvdmVybGF5IHRvIGRpc3BsYXkgcmVhbC10aW1lIHN0YXRlIG92ZXIgdGhlIGdhbWUuXHJcbiAqL1xyXG5mdW5jdGlvbiBPdmVybGF5KHB1cF90cmFja2VyKSB7XHJcbiAgdGhpcy50cmFja2VyID0gcHVwX3RyYWNrZXI7XHJcbiAgZHJhd2luZ3MuZm9yRWFjaChmdW5jdGlvbiAoZHJhd2luZykge1xyXG4gICAgZHJhd2luZy5pbml0KHRoaXMudHJhY2tlcik7XHJcbiAgfSwgdGhpcyk7XHJcbiAgdGhpcy5zaG93aW5nID0gZmFsc2U7XHJcbiAgdGhpcy5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gIHRoaXMudXBkYXRlKCk7XHJcbn1cclxubW9kdWxlLmV4cG9ydHMgPSBPdmVybGF5O1xyXG5cclxuLy8gSW50ZXJ2YWwgdG8gY2hlY2svdXBkYXRlIHZlY3RvcnMuXHJcbk92ZXJsYXkucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gIGlmICh0aGlzLmRpc2FibGVkKSB7XHJcbiAgICBkcmF3aW5ncy5mb3JFYWNoKGZ1bmN0aW9uIChkcmF3aW5nKSB7XHJcbiAgICAgIGRyYXdpbmcuaGlkZSgpO1xyXG4gICAgfSk7XHJcbiAgICB0aGlzLnNob3dpbmcgPSBmYWxzZTtcclxuICB9IGVsc2Uge1xyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMudXBkYXRlLmJpbmQodGhpcykpO1xyXG4gICAgaWYgKCF0aGlzLnNob3dpbmcpIHtcclxuICAgICAgdGhpcy5zaG93aW5nID0gdHJ1ZTtcclxuICAgICAgZHJhd2luZ3MuZm9yRWFjaChmdW5jdGlvbiAoZHJhd2luZykge1xyXG4gICAgICAgIGRyYXdpbmcuc2hvdygpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGRyYXdpbmdzLmZvckVhY2goZnVuY3Rpb24gZHJhdyhkcmF3aW5nKSB7XHJcbiAgICAgIGRyYXdpbmcudXBkYXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcbn07XHJcblxyXG5PdmVybGF5LnByb3RvdHlwZS5kaXNhYmxlID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy5kaXNhYmxlZCA9IHRydWU7XHJcbn07XHJcblxyXG5PdmVybGF5LnByb3RvdHlwZS5lbmFibGUgPSBmdW5jdGlvbigpIHtcclxuICB0aGlzLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgdGhpcy51cGRhdGUoKTtcclxufTtcclxuIiwidmFyIFNvbHZlciA9IHJlcXVpcmUoJy4vc29sdmVyJyk7XHJcbnZhciBUaWxlRXZlbnRzID0gcmVxdWlyZSgnLi90aWxlLWV2ZW50cycpO1xyXG52YXIgVmVjMiA9IHJlcXVpcmUoJy4vdmVjMicpO1xyXG5cclxudmFyIFRJTEVfV0lEVEggPSA0MDtcclxuXHJcbi8vIEludGVyZmFjZSB0aGF0IHRha2VzIGluIHNvdXJjZSBpbmZvcm1hdGlvbiBhbmQgcHV0cyBpdCBpbnRvIHNvbHZlciBmb3JtYXQuXHJcbmZ1bmN0aW9uIFBvd2VydXBUcmFja2VyKCkge1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuICAvLyBoYW5kbGUgbWFwdXBkYXRlLCB0aWxlIHRyYWNraW5nXHJcbiAgLy8gTGlzdGVuIGZvciBwbGF5ZXIgcG93ZXJ1cCBncmFicy5cclxuICB0YWdwcm8uc29ja2V0Lm9uKCdwJywgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICB2YXIgdXBkYXRlcyA9IGV2ZW50LnUgfHwgZXZlbnQ7XHJcbiAgICB2YXIgdGltZSA9IERhdGUubm93KCk7XHJcbiAgICB1cGRhdGVzLmZvckVhY2goZnVuY3Rpb24gKHVwZGF0ZSkge1xyXG4gICAgICBpZiAodXBkYXRlWydzLXBvd2VydXBzJ10pIHtcclxuICAgICAgICB2YXIgaWQgPSB1cGRhdGUuaWQ7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJHT1QgT05FQEBAQEBAQEBcIik7XHJcbiAgICAgICAgaWYgKHRhZ3Byby5wbGF5ZXJzW2lkXS5kcmF3KSB7XHJcbiAgICAgICAgICAvLyBQbGF5ZXIgaXMgdmlzaWJsZSwgZ2V0IHBvd2VydXAgdGlsZSBhbmQgc2VuZCBvYnNlcnZhdGlvbi5cclxuICAgICAgICAgIHZhciBwb3NpdGlvbiA9IG5ldyBWZWMyKHRhZ3Byby5wbGF5ZXJzW2lkXS54LCB0YWdwcm8ucGxheWVyc1tpZF0ueSk7XHJcbiAgICAgICAgICB2YXIgZm91bmQgPSBmYWxzZTtcclxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsZi5wb3dlcnVwX2xvY2F0aW9ucy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgcG93ZXJ1cCA9IHNlbGYucG93ZXJ1cF9sb2NhdGlvbnNbaV07XHJcbiAgICAgICAgICAgIC8vIFRPRE86IE1vcmUgc3BlY2lmaWMgcG93ZXJ1cCBmaW5kaW5nIGxvY2F0aW9uLlxyXG4gICAgICAgICAgICBpZiAocG9zaXRpb24uZGlzdChwb3dlcnVwKSA8IDQwKSB7XHJcbiAgICAgICAgICAgICAgc2VsZi5zb2x2ZXIuYWRkT2JzZXJ2YXRpb24oe1xyXG4gICAgICAgICAgICAgICAgdGltZTogdGltZSxcclxuICAgICAgICAgICAgICAgIHN0YXRlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHZhcmlhYmxlOiBzZWxmLnBvd2VydXBzW2ldLnRvU3RyaW5nKClcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICghZm91bmQpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ291bGRuJ3QgZmluZCBhZGphY2VudCBwb3dlcnVwIVwiKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gUGxheWVyIG5vdCB2aXNpYmxlLCBzZW5kIGluZm9ybWF0aW9uLlxyXG4gICAgICAgICAgc2VsZi5zb2x2ZXIuYWRkSHlwb3RoZXNpcyh7XHJcbiAgICAgICAgICAgIHN0YXRlOiBmYWxzZSxcclxuICAgICAgICAgICAgdGltZTogdGltZVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgdGhpcy50aWxlX2V2ZW50cyA9IG5ldyBUaWxlRXZlbnRzKCk7XHJcbiAgdGhpcy50aWxlX2V2ZW50cy5vbihcInBvd2VydXAuZW50ZXJcIiwgZnVuY3Rpb24gKGluZm8pIHtcclxuICAgIGNvbnNvbGUubG9nKFwic3RhcnRlZCB2aWV3aW5nIHBvd2VydXAgJW9cIiwgaW5mbyk7XHJcbiAgICBzZWxmLnNvbHZlci5zZXRPYnNlcnZlZChzZWxmLnRpbGVfZXZlbnRzLmluX3ZpZXcpO1xyXG4gICAgLy8gRGVsYXkgYW5kIGFzc2VydCBmYWN0IHRvIHJ1bGUgb3V0IHN0YXRlcy5cclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICBzZWxmLnNvbHZlci5hZGRBc3NlcnRpb24oe1xyXG4gICAgICAgIHZhcmlhYmxlOiBpbmZvLmxvY2F0aW9uLnRvU3RyaW5nKCksXHJcbiAgICAgICAgc3RhdGU6IGluZm8uc3RhdGVcclxuICAgICAgfSk7XHJcbiAgICB9LCAyMCk7XHJcbiAgICAvKnNlbGYuc29sdmVyLmFkZE9ic2VydmF0aW9uKHtcclxuICAgICAgdmFyaWFibGU6IGluZm8ubG9jYXRpb24udG9TdHJpbmcoKSxcclxuICAgICAgc3RhdGU6IGluZm8uc3RhdGUsXHJcbiAgICAgIHRpbWU6IGluZm8udGltZVxyXG4gICAgfSk7Ki9cclxuICB9KTtcclxuICB0aGlzLnRpbGVfZXZlbnRzLm9uKFwicG93ZXJ1cC5sZWF2ZVwiLCBmdW5jdGlvbiAoaW5mbykge1xyXG4gICAgY29uc29sZS5sb2coXCJzdG9wcGVkIHZpZXdpbmcgcG93ZXJ1cFwiKTtcclxuICAgIC8vIFRPRE86IE5lZWQgdG8gZG8gYW55dGhpbmcgaGVyZT9cclxuICAgIHNlbGYuc29sdmVyLnNldE9ic2VydmVkKHNlbGYudGlsZV9ldmVudHMuaW5fdmlldyk7XHJcbiAgfSk7XHJcbiAgdGhpcy50aWxlX2V2ZW50cy5vbihcInBvd2VydXAudXBkYXRlXCIsIGZ1bmN0aW9uIChpbmZvKSB7XHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgc2VsZi5zb2x2ZXIuYWRkQXNzZXJ0aW9uKHtcclxuICAgICAgICB2YXJpYWJsZTogaW5mby5sb2NhdGlvbi50b1N0cmluZygpLFxyXG4gICAgICAgIHN0YXRlOiBpbmZvLnN0YXRlXHJcbiAgICAgIH0pO1xyXG4gICAgfSwgMjApO1xyXG4gICAgLypzZWxmLnNvbHZlci5hZGRPYnNlcnZhdGlvbih7XHJcbiAgICAgIHZhcmlhYmxlOiBpbmZvLmxvY2F0aW9uLnRvU3RyaW5nKCksXHJcbiAgICAgIHN0YXRlOiBpbmZvLnN0YXRlLFxyXG4gICAgICB0aW1lOiBpbmZvLnRpbWVcclxuICAgIH0pOyovXHJcbiAgfSk7XHJcbiAgdGhpcy5wb3dlcnVwcyA9IFtdO1xyXG4gIHRoaXMucG93ZXJ1cF9sb2NhdGlvbnMgPSBbXTtcclxuICB0YWdwcm8ubWFwLmZvckVhY2goZnVuY3Rpb24gKHJvdywgeCkge1xyXG4gICAgcm93LmZvckVhY2goZnVuY3Rpb24gKHRpbGUsIHkpIHtcclxuICAgICAgaWYgKE1hdGguZmxvb3IodGlsZSkgIT09IDYpIHJldHVybjtcclxuICAgICAgdmFyIHBvd2VydXAgPSBuZXcgVmVjMih4LCB5KTtcclxuICAgICAgc2VsZi5wb3dlcnVwcy5wdXNoKHBvd2VydXApO1xyXG4gICAgICBzZWxmLnBvd2VydXBfbG9jYXRpb25zLnB1c2gocG93ZXJ1cC5tdWxjKFRJTEVfV0lEVEgsIHRydWUpKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICB2YXIgdmFyaWFibGVzID0gc2VsZi5wb3dlcnVwcy5tYXAoZnVuY3Rpb24gKHBvd2VydXApIHtcclxuICAgIHJldHVybiBwb3dlcnVwLnRvU3RyaW5nKCk7XHJcbiAgfSk7XHJcbiAgdGhpcy5zb2x2ZXIgPSBuZXcgU29sdmVyKHZhcmlhYmxlcyk7XHJcbn1cclxubW9kdWxlLmV4cG9ydHMgPSBQb3dlcnVwVHJhY2tlcjtcclxuXHJcbi8vIFRPRE86IEluaXRpYWxpemF0aW9uIGFuZCBzdGF0ZSBtYW5hZ2VtZW50IGluIGNhc2Ugc29sdmVyIGdvZXMgY3JhenkuXHJcblxyXG5Qb3dlcnVwVHJhY2tlci5wcm90b3R5cGUuZ2V0UG93ZXJ1cHMgPSBmdW5jdGlvbigpIHtcclxuICB2YXIgc3RhdGUgPSB0aGlzLnNvbHZlci5nZXRTdGF0ZSgpO1xyXG4gIHZhciBpbl92aWV3ID0gdGhpcy50aWxlX2V2ZW50cy5pbl92aWV3O1xyXG4gIHZhciBwb3dlcnVwcyA9IFtdO1xyXG4gIGZvciAodmFyIHZhcmlhYmxlIGluIHN0YXRlKSB7XHJcbiAgICBwb3dlcnVwcy5wdXNoKHtcclxuICAgICAgaWQ6IHZhcmlhYmxlLFxyXG4gICAgICBsb2NhdGlvbjogVmVjMi5mcm9tU3RyaW5nKHZhcmlhYmxlKSxcclxuICAgICAgdmlzaWJsZTogdGhpcy50aWxlX2V2ZW50cy5pbl92aWV3LmluZGV4T2YodmFyaWFibGUpICE9PSAtMSxcclxuICAgICAgc3RhdGU6IHN0YXRlW3ZhcmlhYmxlXS5zdGF0ZSxcclxuICAgICAgdGltZTogc3RhdGVbdmFyaWFibGVdLnRpbWVcclxuICAgIH0pO1xyXG4gIH1cclxuICByZXR1cm4gcG93ZXJ1cHM7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hlY2sgd2hldGhlciB0aGVyZSBhcmUgcG93ZXJ1cCB0aWxlcyBhZGphY2VudCB0byB0aGUgZ2l2ZW4gdGlsZS5cclxuICogQHBhcmFtIHtvYmplY3R9IGxvYyAtIE9iamVjdCB3aXRoIHggYW5kIHkgcHJvcGVydGllcyBjb3JyZXNwb25kaW5nXHJcbiAqICAgdG8gYXJyYXkgbG9jYXRpb24gdG8gbG9vayBhcm91bmQuXHJcbiAqIEByZXR1cm4ge2Jvb2xlYW59IC0gV2hldGhlciBvciBub3QgYW55IGFkamFjZW50IHRpbGVzIGFyZSBwb3dlcnVwcy5cclxuICovXHJcblBvd2VydXBUcmFja2VyLnByb3RvdHlwZS5hZGphY2VudFBvd2VydXAgPSBmdW5jdGlvbihsb2MpIHtcclxuICB2YXIgb2Zmc2V0cyA9IFstMSwgMCwgMV07XHJcbiAgdmFyIHggPSBsb2MueDtcclxuICB2YXIgeSA9IGxvYy55O1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb2Zmc2V0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBvZmZzZXRzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgIHZhciB0aGlzWCA9IHggKyBvZmZzZXRzW2ldLFxyXG4gICAgICAgICAgdGhpc1kgPSB5ICsgb2Zmc2V0c1tqXTtcclxuICAgICAgaWYgKCh0aGlzWCA8IDAgfHwgdGhpc1ggPiB0aGlzLm1hcC5sZW5ndGggLSAxKSB8fFxyXG4gICAgICAgICh0aGlzWSA8IDAgfHwgdGhpc1kgPiB0aGlzLm1hcC5sZW5ndGggLSAxKSB8fFxyXG4gICAgICAgICh0aGlzWCA9PT0geCAmJiB0aGlzWSA9PT0geSkpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfSBlbHNlIGlmIChNYXRoLmZsb29yKHRoaXMubWFwW3RoaXNYXVt0aGlzWV0pID09IDYpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gZmFsc2U7XHJcbn07XHJcbiIsIi8vIFRpbWUgZm9yIHN0YXRlIHRvIGNoYW5nZSBiYWNrLlxyXG52YXIgU1RBVEVfQ0hBTkdFID0gNmU0O1xyXG4vLyBQb3NzaWJsZSBub3RpZmljYXRpb24gbGFnLlxyXG52YXIgRVBTSUxPTiA9IDJlMztcclxuXHJcbi8vIENvbXBhcmlzb24gb3BlcmF0aW9ucy5cclxuZnVuY3Rpb24gbHQoYSwgYikge1xyXG4gIHJldHVybiBhIC0gYiA8IEVQU0lMT047XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGd0KGEsIGIpIHtcclxuICByZXR1cm4gYiAtIGEgPCBFUFNJTE9OO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlcShhLCBiKSB7XHJcbiAgcmV0dXJuIE1hdGguYWJzKGEgLSBiKSA8IEVQU0lMT047XHJcbn1cclxuXHJcbi8vIE9iamVjdCBjbG9uZS5cclxuZnVuY3Rpb24gY2xvbmUob2JqKSB7XHJcbiAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU29sdmVyO1xyXG5cclxuLyoqXHJcbiAqIFNvbHZlciBzb2x2ZXMgYm9vbGVhbiBkeW5hbWljIHN0YXRlLlxyXG4gKiBAcGFyYW0ge0FycmF5PHN0cmluZz59IHZhcmlhYmxlcyAtIGFycmF5IG9mIHZhcmlhYmxlIG5hbWVzLlxyXG4gKi9cclxuZnVuY3Rpb24gU29sdmVyKHZhcmlhYmxlcykge1xyXG4gIHRoaXMudmFyaWFibGVzID0ge307XHJcbiAgdGhpcy5zdGF0ZXMgPSBbXTtcclxuICB0aGlzLl90aW1lID0gbnVsbDtcclxuICB2YXIgc3RhdGUgPSB7fTtcclxuICB2YXIgdGltZSA9IERhdGUubm93KCk7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIC8vIFRPRE86IEhhbmRsZSB1bmtub3duIG9yIHZhcmlhYmxlIHN0YXJ0LlxyXG4gIHZhcmlhYmxlcy5mb3JFYWNoKGZ1bmN0aW9uICh2YXJpYWJsZSkge1xyXG4gICAgc2VsZi52YXJpYWJsZXNbdmFyaWFibGVdID0ge1xyXG4gICAgICBvYnNlcnZlZDogZmFsc2VcclxuICAgIH07XHJcbiAgICBzdGF0ZVt2YXJpYWJsZV0gPSB7XHJcbiAgICAgIHN0YXRlOiB0cnVlLFxyXG4gICAgICBpbnRlcnZhbHM6IFt7XHJcbiAgICAgICAgc3RhdGU6IHRydWUsXHJcbiAgICAgICAgc3RhcnQ6IHRpbWUsXHJcbiAgICAgICAgb2JzZXJ2ZWQ6IGZhbHNlLFxyXG4gICAgICAgIGVuZDogbnVsbFxyXG4gICAgICB9XVxyXG4gICAgfTtcclxuICB9KTtcclxuICB0aGlzLnN0YXRlcy5wdXNoKHN0YXRlKTtcclxufVxyXG5cclxuLy8gU2V0IHN1YnNldCBvZiB2YXJpYWJsZXMgYXMgb2JzZXJ2ZWQsIHRoZSByZXN0IGFzc3VtZWQgbm90LlxyXG5Tb2x2ZXIucHJvdG90eXBlLnNldE9ic2VydmVkID0gZnVuY3Rpb24odmFyaWFibGVzKSB7XHJcbiAgdmFyIHVub2JzZXJ2ZWRfdmFyaWFibGVzID0gT2JqZWN0LmtleXModGhpcy52YXJpYWJsZXMpLmZpbHRlcihmdW5jdGlvbiAodmFyaWFibGUpIHtcclxuICAgIHJldHVybiB2YXJpYWJsZXMuaW5kZXhPZih2YXJpYWJsZSkgPT09IC0xO1xyXG4gIH0pO1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuICB2YXJpYWJsZXMuZm9yRWFjaChmdW5jdGlvbiAodmFyaWFibGUpIHtcclxuICAgIHNlbGYudmFyaWFibGVzW3ZhcmlhYmxlXS5vYnNlcnZlZCA9IHRydWU7XHJcbiAgfSk7XHJcbiAgdW5vYnNlcnZlZF92YXJpYWJsZXMuZm9yRWFjaChmdW5jdGlvbiAodmFyaWFibGUpIHtcclxuICAgIHNlbGYudmFyaWFibGVzW3ZhcmlhYmxlXS5vYnNlcnZlZCA9IGZhbHNlO1xyXG4gIH0pO1xyXG59O1xyXG5cclxuLy8gSHlwb3RoZXNpcyBoYXMgdGltZSwgc3RhdGUuXHJcblNvbHZlci5wcm90b3R5cGUuYWRkSHlwb3RoZXNpcyA9IGZ1bmN0aW9uKGgpIHtcclxuICB0aGlzLnVwZGF0ZVZhcmlhYmxlcygpO1xyXG4gIHZhciBzdGF0ZXMgPSBbXTtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3RhdGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICB2YXIgbmV3U3RhdGVzID0gdGhpcy5hcHBseUh5cG90aGVzaXModGhpcy5zdGF0ZXNbaV0sIGgpO1xyXG4gICAgaWYgKG5ld1N0YXRlcylcclxuICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoc3RhdGVzLCBuZXdTdGF0ZXMpO1xyXG4gIH1cclxuICB0aGlzLnN0YXRlcyA9IHN0YXRlcztcclxufTtcclxuXHJcbi8vIE9ic2VydmF0aW9uIGhhcyB0aW1lLCBzdGF0ZSwgdmFyaWFibGUuXHJcblNvbHZlci5wcm90b3R5cGUuYWRkT2JzZXJ2YXRpb24gPSBmdW5jdGlvbihvKSB7XHJcbiAgdGhpcy51cGRhdGVWYXJpYWJsZXMoKTtcclxuICB2YXIgc3RhdGVzID0gW107XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN0YXRlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgdmFyIG5ld1N0YXRlID0gdGhpcy5hcHBseU9ic2VydmF0aW9uKHRoaXMuc3RhdGVzW2ldLCBvKTtcclxuICAgIGlmIChuZXdTdGF0ZSlcclxuICAgICAgc3RhdGVzLnB1c2gobmV3U3RhdGUpO1xyXG4gIH1cclxuICB0aGlzLnN0YXRlcyA9IHN0YXRlcztcclxufTtcclxuXHJcbi8vIEdldCBzZXQgb2YgcG9zc2libGUgc3RhdGVzLlxyXG5Tb2x2ZXIucHJvdG90eXBlLmdldFN0YXRlcyA9IGZ1bmN0aW9uKCkge1xyXG4gIHRoaXMudXBkYXRlVmFyaWFibGVzKCk7XHJcbiAgcmV0dXJuIHRoaXMuc3RhdGVzLnNsaWNlKCk7XHJcbn07XHJcblxyXG4vLyBHZXQgY29uc29saWRhdGVkIHN0YXRlLlxyXG4vLyBFYWNoIHZhcmlhYmxlIGhhcyBzdGF0ZSAodHJ1ZXxmYWxzZXxudWxsKSwgY2hhbmdlIChpZiBmYWxzZSkuIGNoYW5nZVxyXG4vLyBpcyBudW1iZXIgb3IgYXJyYXkgKGlmIHRoZXJlIGlzIGRpc2FncmVlbWVudClcclxuU29sdmVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gIHRoaXMudXBkYXRlVmFyaWFibGVzKCk7XHJcbiAgLy8gQ29uc3RydWN0IG91dHB1dC5cclxuICB2YXIgb3V0ID0ge307XHJcbiAgdmFyIHN0YXRlID0gdGhpcy5zdGF0ZXNbMF07XHJcbiAgZm9yICh2YXIgbmFtZSBpbiBzdGF0ZSkge1xyXG4gICAgdmFyIHZhcmlhYmxlID0gc3RhdGVbbmFtZV07XHJcbiAgICBpZiAodmFyaWFibGUuc3RhdGUpIHtcclxuICAgICAgb3V0W25hbWVdID0ge1xyXG4gICAgICAgIHN0YXRlOiB2YXJpYWJsZS5zdGF0ZVxyXG4gICAgICB9O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdmFyIHRpbWUgPSB2YXJpYWJsZS5pbnRlcnZhbHNbdmFyaWFibGUuaW50ZXJ2YWxzLmxlbmd0aCAtIDFdLmVuZDtcclxuICAgICAgb3V0W25hbWVdID0ge1xyXG4gICAgICAgIHN0YXRlOiB2YXJpYWJsZS5zdGF0ZSxcclxuICAgICAgICB0aW1lOiB0aW1lXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIENvbXBhcmUgcmVzdWx0cyBhY3Jvc3MgYWxsIHN0YXRlcy5cclxuICByZXR1cm4gdGhpcy5zdGF0ZXMuc2xpY2UoMSkucmVkdWNlKGZ1bmN0aW9uIChvdXQsIHN0YXRlKSB7XHJcbiAgICBmb3IgKHZhciBuYW1lIGluIG91dCkge1xyXG4gICAgICB2YXIgb3V0X3ZhcmlhYmxlID0gb3V0W25hbWVdLFxyXG4gICAgICAgICAgdmFyaWFibGUgPSBzdGF0ZVtuYW1lXTtcclxuICAgICAgLy8gQ2hlY2sgZm9yIG1hdGNoaW5nIHN0YXRlcy5cclxuICAgICAgaWYgKG91dF92YXJpYWJsZS5zdGF0ZSA9PT0gdmFyaWFibGUuc3RhdGUpIHtcclxuICAgICAgICAvLyBGYWxzeSBjaGVjayB0aW1lLlxyXG4gICAgICAgIGlmICghb3V0X3ZhcmlhYmxlLnN0YXRlKSB7XHJcbiAgICAgICAgICAvLyBUT0RPOiBjaGVjayB1bmRlZmluZWQgaW4gY2FzZSBpbnRlcnZhbCBub3QgdXBkYXRlZD9cclxuICAgICAgICAgIHZhciBjaGFuZ2UgPSB2YXJpYWJsZS5pbnRlcnZhbHNbdmFyaWFibGUuaW50ZXJ2YWxzLmxlbmd0aCAtIDFdLmVuZDtcclxuICAgICAgICAgIGlmIChvdXRfdmFyaWFibGUudGltZSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcbiAgICAgICAgICAgIGlmIChvdXRfdmFyaWFibGUudGltZS5pbmRleE9mKGNoYW5nZSkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgb3V0X3ZhcmlhYmxlLnRpbWUucHVzaChjaGFuZ2UpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKG91dF92YXJpYWJsZS50aW1lICE9PSBjaGFuZ2UpIHtcclxuICAgICAgICAgICAgdmFyIHRpbWVzID0gW291dF92YXJpYWJsZS50aW1lLCBjaGFuZ2VdO1xyXG4gICAgICAgICAgICBvdXRfdmFyaWFibGUudGltZSA9IHRpbWVzO1xyXG4gICAgICAgICAgfSAvLyBFbHNlIG1hdGNoZXMsIHNvIG5vIHByb2JsZW0uXHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIENvbmZsaWN0ZWQgc3RhdGVzLlxyXG4gICAgICAgIG91dF92YXJpYWJsZS5zdGF0ZSA9IG51bGw7XHJcbiAgICAgICAgLy8gSW4gY2FzZSBpdCB3YXMgc2V0LlxyXG4gICAgICAgIGRlbGV0ZSBvdXRfdmFyaWFibGUudGltZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG91dDtcclxuICB9LCBvdXQpO1xyXG59O1xyXG5cclxuLy8gVXBkYXRlIGBmYWxzZWAgc3RhdGUgdmFyaWFibGVzIGJhc2VkIG9uIGZhbHNlIGVuZFxyXG4vLyB0aW1lLCBpZiBwcmVzZW50LlxyXG5Tb2x2ZXIucHJvdG90eXBlLnVwZGF0ZVZhcmlhYmxlcyA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciB0aW1lID0gdGhpcy5fdGltZSB8fCBEYXRlLm5vdygpO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdGF0ZXMubGVuZ3RoOyBpKyspIHtcclxuICAgIHZhciBzdGF0ZSA9IHRoaXMuc3RhdGVzW2ldO1xyXG4gICAgZm9yICh2YXIgbmFtZSBpbiBzdGF0ZSkge1xyXG4gICAgICB2YXIgdmFyaWFibGUgPSBzdGF0ZVtuYW1lXTtcclxuICAgICAgLy8gVXBkYXRlIGNoYW5nZWJhY2suXHJcbiAgICAgIGlmICghdmFyaWFibGUuc3RhdGUpIHtcclxuICAgICAgICBpZiAodmFyaWFibGUuaW50ZXJ2YWxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHZhciBsYXN0ID0gdmFyaWFibGUuaW50ZXJ2YWxzW3ZhcmlhYmxlLmludGVydmFscy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgIGlmIChsYXN0LmVuZCAmJiBsYXN0LmVuZCA8PSB0aW1lKSB7XHJcbiAgICAgICAgICAgIC8vIHVwZGF0ZSB0byB0cnVlLlxyXG4gICAgICAgICAgICB2YXJpYWJsZS5zdGF0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgIHZhcmlhYmxlLmludGVydmFscy5wdXNoKHtcclxuICAgICAgICAgICAgICBzdGF0ZTogdHJ1ZSxcclxuICAgICAgICAgICAgICBzdGFydDogdGltZSxcclxuICAgICAgICAgICAgICBlbmQ6IG51bGxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gTGlrZSBhbiBvYnNlcnZhdGlvbiBleGNlcHQgcHJvYmFibHkgbW9yZSBwb3dlcmZ1bC5cclxuU29sdmVyLnByb3RvdHlwZS5hZGRBc3NlcnRpb24gPSBmdW5jdGlvbihvKSB7XHJcbiAgdGhpcy51cGRhdGVWYXJpYWJsZXMoKTtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgdGhpcy5zdGF0ZXMgPSB0aGlzLnN0YXRlcy5maWx0ZXIoZnVuY3Rpb24gKHN0YXRlKSB7XHJcbiAgICByZXR1cm4gc2VsZi5jaGVja0Fzc2VydGlvbihzdGF0ZSwgbyk7XHJcbiAgfSk7XHJcbn07XHJcblxyXG5Tb2x2ZXIucHJvdG90eXBlLmNoZWNrQXNzZXJ0aW9uID0gZnVuY3Rpb24oc3RhdGUsIGFzc2VydGlvbikge1xyXG4gIHZhciB2YXJpYWJsZSA9IHN0YXRlW2Fzc2VydGlvbi52YXJpYWJsZV07XHJcbiAgcmV0dXJuIHZhcmlhYmxlLnN0YXRlID09PSBhc3NlcnRpb24uc3RhdGU7XHJcbn07XHJcblxyXG4vLyBSZXR1cm4gc3RhdGUgd2l0aCBvYnNlcnZhdGlvbiBhcHBsaWVkIG9yIG51bGwgaWYgaW52YWxpZC5cclxuU29sdmVyLnByb3RvdHlwZS5hcHBseU9ic2VydmF0aW9uID0gZnVuY3Rpb24oc3RhdGUsIG9ic2VydmF0aW9uKSB7XHJcbiAgdmFyIHZhcmlhYmxlID0gc3RhdGVbb2JzZXJ2YXRpb24udmFyaWFibGVdO1xyXG4gIGlmICh2YXJpYWJsZS5zdGF0ZSAmJiAhb2JzZXJ2YXRpb24uc3RhdGUpIHtcclxuICAgIC8vIENoYW5nZSBpbiBvYnNlcnZlZCB2YXJpYWJsZSB0cnVlIC0+IGZhbHNlXHJcbiAgICB2YXJpYWJsZS5zdGF0ZSA9IG9ic2VydmF0aW9uLnN0YXRlO1xyXG4gICAgdmFyaWFibGUuaW50ZXJ2YWxzLnB1c2goe1xyXG4gICAgICBzdGF0ZTogdmFyaWFibGUuc3RhdGUsXHJcbiAgICAgIHN0YXJ0OiBvYnNlcnZhdGlvbi50aW1lLFxyXG4gICAgICBlbmQ6IG9ic2VydmF0aW9uLnRpbWUgKyBTVEFURV9DSEFOR0VcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIHN0YXRlO1xyXG4gIH0gZWxzZSBpZiAodmFyaWFibGUuc3RhdGUgJiYgb2JzZXJ2YXRpb24uc3RhdGUpIHtcclxuICAgIC8vIEV4cGVjdGVkIHN0YXRlLlxyXG4gICAgcmV0dXJuIHN0YXRlO1xyXG4gIH0gZWxzZSBpZiAoIXZhcmlhYmxlLnN0YXRlICYmIG9ic2VydmF0aW9uLnN0YXRlKSB7XHJcbiAgICAvLyBQb3RlbnRpYWxseSB1cGRhdGluZyB2YXJpYWJsZS5cclxuICAgIHZhciB0aW1lID0gdmFyaWFibGUuaW50ZXJ2YWxzW3ZhcmlhYmxlLmludGVydmFscy5sZW5ndGggLSAxXTtcclxuICAgIGlmIChlcSh0aW1lLCBvYnNlcnZhdGlvbi50aW1lKSkge1xyXG4gICAgICAvLyB1cGRhdGUgc3RhdGUuXHJcbiAgICAgIHZhcmlhYmxlLnN0YXRlID0gb2JzZXJ2YXRpb24uc3RhdGU7XHJcbiAgICAgIHZhcmlhYmxlLmludGVydmFscy5wdXNoKHtcclxuICAgICAgICBzdGF0ZTogb2JzZXJ2YXRpb24uc3RhdGUsXHJcbiAgICAgICAgc3RhcnQ6IG9ic2VydmF0aW9uLnRpbWUsXHJcbiAgICAgICAgZW5kOiBudWxsXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gc3RhdGU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBDb3VsZCBub3QgdXBkYXRlIHRoaXMgdmFyaWFibGUuXHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH0gZWxzZSBpZiAoIXZhcmlhYmxlLnN0YXRlICYmICFvYnNlcnZhdGlvbi5zdGF0ZSkge1xyXG4gICAgLy8gRXhwZWN0ZWQgc3RhdGUuXHJcbiAgICByZXR1cm4gc3RhdGU7XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gUmV0dXJucyBtdWx0aXBsZSBzdGF0ZXMgb3IgbnVsbCBpZiBpbnZhbGlkXHJcblNvbHZlci5wcm90b3R5cGUuYXBwbHlIeXBvdGhlc2lzID0gZnVuY3Rpb24oc3RhdGUsIGh5cG90aGVzaXMpIHtcclxuICBoeXBvdGhlc2lzID0gY2xvbmUoaHlwb3RoZXNpcyk7XHJcbiAgdmFyIHN0YXRlcyA9IFtdO1xyXG4gIGZvciAodmFyIG5hbWUgaW4gc3RhdGUpIHtcclxuICAgIC8vIFNraXAgb2JzZXJ2ZWQgdmFyaWFibGVzLCBubyBndWVzc2luZyB3aXRoIHRoZW0uXHJcbiAgICBpZiAodGhpcy52YXJpYWJsZXNbbmFtZV0ub2JzZXJ2ZWQpXHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgdmFyIG5ld1N0YXRlID0gY2xvbmUoc3RhdGUpO1xyXG4gICAgdmFyIHZhcmlhYmxlID0gbmV3U3RhdGVbbmFtZV07XHJcbiAgICAvLyBIeXBvdGhlc2lzIGlzIGFsd2F5cyBmYWxzZS5cclxuICAgIGlmICh2YXJpYWJsZS5zdGF0ZSkge1xyXG4gICAgICAvLyBDaGFuZ2UgaW4gb2JzZXJ2ZWQgdmFyaWFibGUgdHJ1ZSAtPiBmYWxzZVxyXG4gICAgICB2YXJpYWJsZS5zdGF0ZSA9IGh5cG90aGVzaXMuc3RhdGU7XHJcbiAgICAgIHZhcmlhYmxlLmludGVydmFscy5wdXNoKHtcclxuICAgICAgICBzdGF0ZTogdmFyaWFibGUuc3RhdGUsXHJcbiAgICAgICAgc3RhcnQ6IGh5cG90aGVzaXMudGltZSxcclxuICAgICAgICBlbmQ6IGh5cG90aGVzaXMudGltZSArIFNUQVRFX0NIQU5HRVxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG5ld1N0YXRlID0gbnVsbDtcclxuICAgIH1cclxuICAgIGlmIChuZXdTdGF0ZSAhPT0gbnVsbCkge1xyXG4gICAgICBzdGF0ZXMucHVzaChuZXdTdGF0ZSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGlmIChzdGF0ZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9IGVsc2Uge1xyXG4gICAgcmV0dXJuIHN0YXRlcztcclxuICB9XHJcbn07XHJcbiIsIi8vIHRhZ3BybyBzdGFydHVwIGhlbHBlcnMuXHJcbi8qKlxyXG4gKiBFdmVudEVtaXR0ZXIgaW50ZXJmYWNlLlxyXG4gKiBFdmVudHM6XHJcbiAqIC0gcmVhZHk6IHRhZ3Byby5yZWFkeVxyXG4gKiAtIHN0YXJ0OiB0YWdwcm8gb2JqZWN0IGV4aXN0c1xyXG4gKiAtIHNwZWN0YXRpbmc6IGpvaW5lZCBhcyBzcGVjdGF0b3JcclxuICogLSBqb2luOiBqb2luZWQgZ2FtZSBhcyBwbGF5ZXIsIG9yIGZyb20gc3BlY3RhdG9yIG1vZGUuXHJcbiAqL1xyXG52YXIgVGFnUHJvID0gKGZ1bmN0aW9uICgpIHtcclxuICBmdW5jdGlvbiBzZXRJbW1lZGlhdGUoZm4pIHtcclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgIGZuKCk7XHJcbiAgICB9LCAwKTtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGZpbmRJbmRleChhcnIsIGZuKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZiAoZm4oYXJyW2ldKSkge1xyXG4gICAgICAgIHJldHVybiBpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gLTE7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBvblRhZ1Bybyhmbiwgbm90Rmlyc3QpIHtcclxuICAgIGlmICh0eXBlb2YgdGFncHJvICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICBpZiAoIW5vdEZpcnN0KSB7XHJcbiAgICAgICAgLy8gRm9yY2UgdG8gYmUgYXN5bmMuXHJcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZuKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmbigpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBvblRhZ1BybyhmbiwgdHJ1ZSk7XHJcbiAgICAgIH0sIDIwKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIFRhZ1BybygpIHtcclxuICAgIHRoaXMuY2FsbGJhY2tzID0ge1xyXG4gICAgICBcInRhZ3Byby5leGlzdHNcIjogW10sXHJcbiAgICAgIFwidGFncHJvLnJlYWR5XCI6IFtdLFxyXG4gICAgICBcInRhZ3Byby5pbml0aWFsaXplZFwiOiBbXSxcclxuICAgICAgXCJ1c2VyLnNwZWN0YXRpbmdcIjogW10sXHJcbiAgICAgIFwidXNlci5wbGF5aW5nXCI6IFtdLFxyXG4gICAgICBcImdhbWUucHJlXCI6IFtdLFxyXG4gICAgICBcImdhbWUuc3RhcnRcIjogW10sXHJcbiAgICAgIFwiZ2FtZS5lbmRcIjogW10sXHJcbiAgICAgIFwiZ3JvdXBcIjogW11cclxuICAgIH07XHJcblxyXG4gICAgLy8gVHJhY2sgc3RhdGVzLlxyXG4gICAgdGhpcy5zdGF0ZSA9IHtcclxuICAgICAgXCJ0YWdwcm8uc3RhcnRcIjogZmFsc2UsXHJcbiAgICAgIFwidGFncHJvLnJlYWR5XCI6IGZhbHNlLFxyXG4gICAgICBcInRhZ3Byby5pbml0aWFsaXplZFwiOiBmYWxzZSxcclxuICAgICAgXCJ1c2VyLnNwZWN0YXRpbmdcIjogZmFsc2UsXHJcbiAgICAgIFwidXNlci5wbGF5aW5nXCI6IGZhbHNlLFxyXG4gICAgICBcImdhbWUucHJlXCI6IGZhbHNlLFxyXG4gICAgICBcImdhbWUuc3RhcnRcIjogZmFsc2UsXHJcbiAgICAgIFwiZ2FtZS5lbmRcIjogZmFsc2UsXHJcbiAgICAgIFwiZ3JvdXBcIjogZmFsc2VcclxuICAgIH07XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICBvblRhZ1BybyhmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHNlbGYuX2luaXQoKTtcclxuICAgICAgc2VsZi5lbWl0KCdzdGFydCcpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBJbml0aWFsaXplIGxpc3RlbmVycyBmb3Igc3RhdGVzLlxyXG4gIFRhZ1Byby5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHZhciBzb2NrZXQgPSB0YWdwcm8ucmF3U29ja2V0O1xyXG5cclxuICAgIGZ1bmN0aW9uIHNldCh0eXBlLCB2YWwpIHtcclxuICAgICAgaWYgKCF0aGlzLnN0YXRlLmhhc093blByb3BlcnR5KHR5cGUpKSByZXR1cm47XHJcbiAgICAgIHRoaXMuc3RhdGVbdHlwZV0gPSB2YWw7XHJcbiAgICAgIHZhciBhcmc7XHJcbiAgICAgIGlmICh0eXBlID09IFwidXNlci5wbGF5aW5nXCIpIHtcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZVtcInVzZXIuc3BlY3RhdGluZ1wiXSkge1xyXG4gICAgICAgICAgYXJnID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgY29uc29sZS5sb2coXCJFbWl0dGluZzogJXMuXCIsIHR5cGUpO1xyXG4gICAgICBzZWxmLmVtaXQodHlwZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0KHR5cGUpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuc3RhdGVbdHlwZV07XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5vbigndGFncHJvLnJlYWR5JywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAvLyBJbml0aWFsaXplXHJcbiAgICAgIHZhciB0aW1lb3V0O1xyXG4gICAgICBpZiAodGFncHJvLnNwZWN0YXRvcikge1xyXG4gICAgICAgIHNlbGYuc3RhdGUuc3BlY3RhdGluZyA9IHRydWU7XHJcbiAgICAgICAgc2VsZi5lbWl0KCd1c2VyLnNwZWN0YXRpbmcnKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBFbWl0IHBsYXlpbmcgaWYgbm90IHNwZWN0YXRvci5cclxuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIlBMQVlJTkdAQEBAQEBAQEBAQEBcIik7XHJcbiAgICAgICAgICBzZWxmLmVtaXQoJ3VzZXIucGxheWluZycpO1xyXG4gICAgICAgIH0sIDJlMyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFNldCB1cCBzb2NrZXQgbGlzdGVuZXJzLlxyXG4gICAgICB0YWdwcm8uc29ja2V0Lm9uKCdzcGVjdGF0b3InLCBmdW5jdGlvbiAoc3BlY3RhdGluZykge1xyXG4gICAgICAgIGlmIChzcGVjdGF0aW5nKSB7XHJcbiAgICAgICAgICBzZWxmLnN0YXRlLnNwZWN0YXRpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgaWYgKHRpbWVvdXQpIHtcclxuICAgICAgICAgICAgLy8gRG9uJ3QgZW1pdCBwbGF5aW5nLlxyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBzZWxmLmVtaXQoJ3VzZXIuc3BlY3RhdGluZycpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBKb2luaW5nIGdhbWUgZnJvbSBzcGVjdGF0aW5nLlxyXG4gICAgICAgICAgaWYgKHNlbGYuc3RhdGUuc3BlY3RhdGluZykge1xyXG4gICAgICAgICAgICBzZWxmLnN0YXRlLnNwZWN0YXRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgc2VsZi5lbWl0KCd1c2VyLnBsYXlpbmcnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdGFncHJvLnJlYWR5KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIlJFQURZQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBcIik7XHJcbiAgICAgICAgc2VsZi5lbWl0KCd0YWdwcm8ucmVhZHknKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBUYWdQcm8ucHJvdG90eXBlLm9uID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcclxuICAgIGlmICghdGhpcy5jYWxsYmFja3MuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgdGhpcy5jYWxsYmFja3NbbmFtZV0gPSBbXTtcclxuICAgIH1cclxuICAgIHRoaXMuY2FsbGJhY2tzW25hbWVdLnB1c2goZm4pO1xyXG4gIH07XHJcblxyXG4gIFRhZ1Byby5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcclxuICAgIGlmICh0aGlzLmNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xyXG4gICAgICB2YXIgaSA9IGZpbmRJbmRleCh0aGlzLmNhbGxiYWNrc1tuYW1lXSwgZnVuY3Rpb24gKGVsdCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgZWx0ID09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICAgIHJldHVybiBlbHQuZm4gPT09IGZuO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gZWx0ID09PSBmbjtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAoaSAhPT0gLTEpIHtcclxuICAgICAgICB0aGlzLmNhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaSwgMSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuICBUYWdQcm8ucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihuYW1lLCBmbikge1xyXG4gICAgaWYgKCF0aGlzLmNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xyXG4gICAgICB0aGlzLmNhbGxiYWNrc1tuYW1lXSA9IFtdO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jYWxsYmFja3NbbmFtZV0ucHVzaCh7XHJcbiAgICAgIGZuOiBmblxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gQHByaXZhdGVcclxuICBUYWdQcm8ucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbihuYW1lKSB7XHJcbiAgICBpZiAodGhpcy5jYWxsYmFja3MuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuY2FsbGJhY2tzW25hbWVdO1xyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBmbiA9IGNhbGxiYWNrc1tpXTtcclxuICAgICAgICAvLyBIYW5kbGUgJ29uY2UnIGl0ZW1zLlxyXG4gICAgICAgIGlmICh0eXBlb2YgZm4gPT0gXCJvYmplY3RcIikge1xyXG4gICAgICAgICAgY2FsbGJhY2tzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgIGktLTtcclxuICAgICAgICAgIGZuID0gZm4uZm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZuKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuICByZXR1cm4gbmV3IFRhZ1BybygpO1xyXG59KSgpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBUYWdQcm87XHJcbiIsInZhciBWZWMyID0gcmVxdWlyZSgnLi92ZWMyJyk7XHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XHJcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xyXG5cclxudmFyIFRJTEVfV0lEVEggPSA0MDtcclxuXHJcbnZhciB0aWxlSWRzID0gWzUsIDYsIDEwLCAxNCwgMTVdO1xyXG52YXIgdGlsZVN0cmluZ3MgPSB7XHJcbiAgNTogXCJib29zdFwiLFxyXG4gIDY6IFwicG93ZXJ1cFwiLFxyXG4gIDEwOiBcImJvbWJcIixcclxuICAxNDogXCJib29zdFwiLFxyXG4gIDE1OiBcImJvb3N0XCJcclxufTtcclxuXHJcbnZhciB0aWxlVHlwZXMgPSB7XHJcbiAgcG93ZXJ1cDoge1xyXG4gICAgYWN0aXZlOiBbNi4xLCA2LjIsIDYuMywgNi40XSxcclxuICAgIGluYWN0aXZlOiBbNl1cclxuICB9LFxyXG4gIGJvbWI6IHtcclxuICAgIGFjdGl2ZTogWzEwXSxcclxuICAgIGluYWN0aXZlOiBbMTAuMV1cclxuICB9LFxyXG4gIGJvb3N0OiB7XHJcbiAgICBhY3RpdmU6IFs1LCAxNCwgMTVdLFxyXG4gICAgaW5hY3RpdmU6IFs1LjEsIDE0LjEsIDE1LjFdXHJcbiAgfVxyXG59O1xyXG5cclxuLy8gVGlsZSBldmVudHMgY2FuIHRha2UgYSBzcGVjaWZpYyB0aWxlIG9yIGEgdGlsZSB0eXBlLCBwcm9iYWJseS5cclxuLy8gQWxsb3dzIGFkZGluZyBsaXN0ZW5lciBmb3IgdGlsZXMgY29taW5nIGludG8gdmlldy5cclxuLy8gQnJvd3Nlci1zcGVjaWZpYy5cclxuLy8gZXZlbnRzIHB1dCBvdXQgYXJlIGxpa2Ugbi5lbnRlciwgbi5sZWF2ZSwgbi51cGRhdGUgd2hlcmUgbiBpcyBmbG9vciBvZiB0aWxlIGlkIHlvdSdyZSBpbnRlcmVzdGVkIGluXHJcbi8vIGNhbGxiYWNrIGdldHMgdGlsZSB2ZWMgd2l0aCB4LCB5LCBhbmQgYm9vbGVhbiBmb3IgYWN0aXZlXHJcbi8vIGRlZmF1bHQgbGlzdGVucyBmb3IgYm9vc3QsIGJvbWIsIHBvd2VydXAuXHJcbmZ1bmN0aW9uIFRpbGVFdmVudHMoKSB7XHJcbiAgRXZlbnRFbWl0dGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIC8vIFR5cGVzIHRvIGxpc3RlbiBmb3IuXHJcbiAgdGhpcy50aWxlcyA9IFtdO1xyXG4gIHRoaXMubGlzdGVuZXJzID0ge307XHJcbiAgdGhpcy5pbl92aWV3ID0gW107XHJcbiAgdGhpcy5jaGVja0ludGVydmFsID0gMjUwO1xyXG4gIHRoaXMuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCh0aGlzLl9pbnRlcnZhbC5iaW5kKHRoaXMpLCB0aGlzLmNoZWNrSW50ZXJ2YWwpO1xyXG4gIHRoaXMucmFuZ2UgPSB7XHJcbiAgICB4OiA2NjAsXHJcbiAgICB5OiA0MjBcclxuICB9O1xyXG4gIHRhZ3Byby5tYXAuZm9yRWFjaChmdW5jdGlvbiAocm93LCB4KSB7XHJcbiAgICByb3cuZm9yRWFjaChmdW5jdGlvbiAodiwgeSkge1xyXG4gICAgICBpZiAoTWF0aC5mbG9vcih2KSA9PT0gNikge1xyXG4gICAgICAgIHNlbGYudGlsZXMucHVzaChuZXcgVmVjMih4LCB5KSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH0pO1xyXG4gIC8vIG9ubHkgZG8gcHVwcyBub3dcclxuICB0YWdwcm8uc29ja2V0Lm9uKCdtYXB1cGRhdGUnLCBmdW5jdGlvbiAodXBkYXRlcykge1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHVwZGF0ZXMpKSB7XHJcbiAgICAgIHVwZGF0ZXMgPSBbdXBkYXRlc107XHJcbiAgICB9XHJcbiAgICB1cGRhdGVzLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgIGlmIChNYXRoLmZsb29yKGV2ZW50LnYpID09PSA2KSB7XHJcbiAgICAgICAgdmFyIGUgPSB7XHJcbiAgICAgICAgICBsb2NhdGlvbjogbmV3IFZlYzIoZXZlbnQueCwgZXZlbnQueSksXHJcbiAgICAgICAgICBzdGF0ZTogZXZlbnQudiAhPT0gNixcclxuICAgICAgICAgIHRpbWU6IERhdGUubm93KClcclxuICAgICAgICB9O1xyXG4gICAgICAgIHNlbGYuZW1pdChcInBvd2VydXAudXBkYXRlXCIsIGUpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG5cclxudXRpbC5pbmhlcml0cyhUaWxlRXZlbnRzLCBFdmVudEVtaXR0ZXIpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IFRpbGVFdmVudHM7XHJcblxyXG4vLyBHZXQgcGxheWVyIGxvY2F0aW9uLlxyXG4vLyBAcHJpdmF0ZVxyXG5UaWxlRXZlbnRzLnByb3RvdHlwZS5jZW50ZXIgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gbmV3IFZlYzIodGFncHJvLnBsYXllcnNbdGFncHJvLnBsYXllcklkXS54LFxyXG4gICAgdGFncHJvLnBsYXllcnNbdGFncHJvLnBsYXllcklkXS55KTtcclxufTtcclxuXHJcbi8vIEZ1bmN0aW9uIHJ1biBpbiBhbiBpbnRlcnZhbC5cclxuLy8gQHByaXZhdGVcclxuVGlsZUV2ZW50cy5wcm90b3R5cGUuX2ludGVydmFsID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGxvY2F0aW9uID0gdGhpcy5jZW50ZXIoKTtcclxuICB2YXIgZW50ZXIgPSBbXTtcclxuICB2YXIgbGVhdmUgPSBbXTtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgdmFyIHRpbWUgPSBEYXRlLm5vdygpO1xyXG4gIHRoaXMudGlsZXMuZm9yRWFjaChmdW5jdGlvbiAodGlsZSkge1xyXG4gICAgdmFyIGRpZmYgPSB0aWxlLm11bGMoVElMRV9XSURUSCwgdHJ1ZSkuc3ViKGxvY2F0aW9uKS5hYnMoKTtcclxuICAgIHZhciBpbl92aWV3ID0gKGRpZmYueCA8IHRoaXMucmFuZ2UueCAmJiBkaWZmLnkgPCB0aGlzLnJhbmdlLnkpO1xyXG4gICAgdmFyIGlkID0gdGlsZS50b1N0cmluZygpO1xyXG4gICAgdmFyIGFscmVhZHlfaW5fdmlldyA9IHNlbGYuaW5fdmlldy5pbmRleE9mKGlkKSAhPT0gLTE7XHJcbiAgICBpZiAoaW5fdmlldyAmJiAhYWxyZWFkeV9pbl92aWV3KSB7XHJcbiAgICAgIHNlbGYuaW5fdmlldy5wdXNoKGlkKTtcclxuICAgICAgZW50ZXIucHVzaCh0aWxlLmNsb25lKCkpO1xyXG4gICAgfSBlbHNlIGlmICghaW5fdmlldyAmJiBhbHJlYWR5X2luX3ZpZXcpIHtcclxuICAgICAgbGVhdmUucHVzaCh0aWxlKTtcclxuICAgICAgdmFyIGkgPSBzZWxmLmluX3ZpZXcuaW5kZXhPZihpZCk7XHJcbiAgICAgIHNlbGYuaW5fdmlldy5zcGxpY2UoaSwgMSk7XHJcbiAgICB9XHJcbiAgfSwgdGhpcyk7XHJcbiAgZW50ZXIuZm9yRWFjaChmdW5jdGlvbiAodGlsZSkge1xyXG4gICAgdmFyIHZhbCA9IHRhZ3Byby5tYXBbdGlsZS54XVt0aWxlLnldO1xyXG4gICAgc2VsZi5lbWl0KFwicG93ZXJ1cC5lbnRlclwiLCB7XHJcbiAgICAgIGxvY2F0aW9uOiB0aWxlLFxyXG4gICAgICBzdGF0ZTogdmFsICE9PSA2LFxyXG4gICAgICB0aW1lOiB0aW1lXHJcbiAgICB9KTtcclxuICB9KTtcclxuICBsZWF2ZS5mb3JFYWNoKGZ1bmN0aW9uICh0aWxlKSB7XHJcbiAgICB2YXIgdmFsID0gdGFncHJvLm1hcFt0aWxlLnhdW3RpbGUueV07XHJcbiAgICBzZWxmLmVtaXQoXCJwb3dlcnVwLmxlYXZlXCIsIHtcclxuICAgICAgbG9jYXRpb246IHRpbGUsXHJcbiAgICAgIHN0YXRlOiB2YWwgIT09IDYsXHJcbiAgICAgIHRpbWU6IHRpbWVcclxuICAgIH0pO1xyXG4gIH0pO1xyXG59O1xyXG4iLCJmdW5jdGlvbiBWZWMyKHgsIHkpIHtcclxuICAgIHRoaXMueCA9IHg7XHJcbiAgICB0aGlzLnkgPSB5O1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFZlYzI7XHJcblxyXG5WZWMyLnRvU3RyaW5nID0gZnVuY3Rpb24odikge1xyXG4gICAgcmV0dXJuIFwiKFwiICsgdi54ICsgXCIsXCIgKyB2LnkgKyBcIilcIjtcclxufTtcclxuXHJcblZlYzIuZnJvbVN0cmluZyA9IGZ1bmN0aW9uKHMpIHtcclxuICAgIHZhciBjb29yZHMgPSBzLnNsaWNlKDEsIC0xKS5zcGxpdCgnLCcpLm1hcChOdW1iZXIpO1xyXG4gICAgcmV0dXJuIG5ldyBWZWMyKGNvb3Jkc1swXSwgY29vcmRzWzFdKTtcclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHYsIHJldHVybk5ldykge1xyXG4gICAgaWYgKHJldHVybk5ldykge1xyXG4gICAgICAgIHJldHVybiBuZXcgVmVjMih0aGlzLnggKyB2LngsIHRoaXMueSArIHYueSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMueCArPSB2Lng7XHJcbiAgICAgICAgdGhpcy55ICs9IHYueTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmFkZGMgPSBmdW5jdGlvbihjLCByZXR1cm5OZXcpIHtcclxuICAgIGlmIChyZXR1cm5OZXcpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFZlYzIodGhpcy54ICsgYywgdGhpcy55ICsgYyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMueCArPSBjO1xyXG4gICAgICAgIHRoaXMueSArPSBjO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24odiwgcmV0dXJuTmV3KSB7XHJcbiAgICBpZiAocmV0dXJuTmV3KSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBWZWMyKHRoaXMueCAtIHYueCwgdGhpcy55IC0gdi55KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy54IC09IHYueDtcclxuICAgICAgICB0aGlzLnkgLT0gdi55O1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUuc3ViYyA9IGZ1bmN0aW9uKGMsIHJldHVybk5ldykge1xyXG4gICAgaWYgKHJldHVybk5ldykge1xyXG4gICAgICAgIHJldHVybiBuZXcgVmVjMih0aGlzLnggLSBjLCB0aGlzLnkgLSBjKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy54IC09IGM7XHJcbiAgICAgICAgdGhpcy55IC09IGM7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5WZWMyLnByb3RvdHlwZS5tdWwgPSBmdW5jdGlvbih2LCByZXR1cm5OZXcpIHtcclxuICAgIGlmIChyZXR1cm5OZXcpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFZlYzIodGhpcy54ICogdi54LCB0aGlzLnkgKiB2LnkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnggKj0gdi54O1xyXG4gICAgICAgIHRoaXMueSAqPSB2Lnk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5WZWMyLnByb3RvdHlwZS5tdWxjID0gZnVuY3Rpb24oYywgcmV0dXJuTmV3KSB7XHJcbiAgICBpZiAocmV0dXJuTmV3KSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBWZWMyKHRoaXMueCAqIGMsIHRoaXMueSAqIGMpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnggKj0gYztcclxuICAgICAgICB0aGlzLnkgKj0gYztcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKHYsIHJldHVybk5ldykge1xyXG4gICAgaWYgKHJldHVybk5ldykge1xyXG4gICAgICAgIHJldHVybiBuZXcgVmVjMih0aGlzLnggLyB2LngsIHRoaXMueSAvIHYueSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMueCAvPSB2Lng7XHJcbiAgICAgICAgdGhpcy55IC89IHYueTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmRpdmMgPSBmdW5jdGlvbihjLCByZXR1cm5OZXcpIHtcclxuICAgIGlmIChyZXR1cm5OZXcpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFZlYzIodGhpcy54IC8gYywgdGhpcy55IC8gYyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMueCAvPSBjO1xyXG4gICAgICAgIHRoaXMueSAvPSBjO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUuZG90ID0gZnVuY3Rpb24odikge1xyXG4gICAgcmV0dXJuIHRoaXMueCAqIHYueCArIHRoaXMueSAqIHYueTtcclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmNyb3NzID0gZnVuY3Rpb24odikge1xyXG4gICAgcmV0dXJuIHRoaXMueCAqIHYueSAtIHRoaXMueSAqIHYueDtcclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmxlbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyh0aGlzLngsIDIpICsgTWF0aC5wb3codGhpcy55LCAyKSk7XHJcbn07XHJcblxyXG5WZWMyLnByb3RvdHlwZS5hbmdsZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIE1hdGguYXRhbjIodGhpcy55LCB0aGlzLngpO1xyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUubm9ybSA9IGZ1bmN0aW9uKHJldHVybk5ldykge1xyXG4gICAgdmFyIGxlbiA9IE1hdGguc3FydChNYXRoLnBvdyh0aGlzLngsIDIpICsgTWF0aC5wb3codGhpcy55LCAyKSk7XHJcbiAgICBpZiAocmV0dXJuTmV3KSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBWZWMyKHRoaXMueCAvIGxlbiwgdGhpcy55IC8gbGVuKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy54IC89IGxlbjtcclxuICAgICAgICB0aGlzLnkgLz0gbGVuO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUubHQgPSBmdW5jdGlvbih2KSB7XHJcbiAgICByZXR1cm4gdGhpcy54IDwgdi54ICYmIHRoaXMueSA8IHYueTtcclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmx0ZSA9IGZ1bmN0aW9uKHYpIHtcclxuICAgIHJldHVybiB0aGlzLnggPD0gdi54ICYmIHRoaXMueSA8PSB2Lnk7XHJcbn07XHJcblxyXG5WZWMyLnByb3RvdHlwZS5ndCA9IGZ1bmN0aW9uKHYpIHtcclxuICAgIHJldHVybiB0aGlzLnggPiB2LnggJiYgdGhpcy55ID4gdi55O1xyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUuZ3RlID0gZnVuY3Rpb24odikge1xyXG4gICAgcmV0dXJuIHRoaXMueCA+PSB2LnggJiYgdGhpcy55ID49IHYueTtcclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmVxID0gZnVuY3Rpb24odikge1xyXG4gICAgcmV0dXJuIHRoaXMueCA9PT0gdi54ICYmIHRoaXMueSA9PT0gdi55O1xyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUubmVxID0gZnVuY3Rpb24odikge1xyXG4gICAgcmV0dXJuIHRoaXMueCAhPT0gdi54IHx8IHRoaXMueSAhPT0gdi55O1xyXG59O1xyXG5cclxuVmVjMi5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiBuZXcgVmVjMih0aGlzLngsIHRoaXMueSk7XHJcbn07XHJcblxyXG5WZWMyLnByb3RvdHlwZS5hYnMgPSBmdW5jdGlvbihyZXR1cm5OZXcpIHtcclxuICAgIGlmIChyZXR1cm5OZXcpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFZlYzIoTWF0aC5hYnModGhpcy54KSwgTWF0aC5hYnModGhpcy55KSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMueCA9IE1hdGguYWJzKHRoaXMueCk7XHJcbiAgICAgICAgdGhpcy55ID0gTWF0aC5hYnModGhpcy55KTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGMpIHtcclxuICAgIHJldHVybiBuZXcgVmVjMihNYXRoLm1heCh0aGlzLngsIGMpLCBNYXRoLm1heCh0aGlzLnksIGMpKTtcclxufTtcclxuXHJcblZlYzIucHJvdG90eXBlLmRpc3QgPSBmdW5jdGlvbih2KSB7XHJcbiAgcmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyh2LnggLSB0aGlzLngsIDIpICsgTWF0aC5wb3codi55IC0gdGhpcy55LCAyKSk7XHJcbn07XHJcblxyXG5WZWMyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBcIihcIiArIHRoaXMueCArIFwiLFwiICsgdGhpcy55ICsgXCIpXCI7XHJcbn07XHJcbiJdfQ==
