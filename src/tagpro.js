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
        callback(v);
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
      onValue(window, "tagpro", function (tagpro) {
        fn();
      });
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
