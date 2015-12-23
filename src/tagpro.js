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
