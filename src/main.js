var PowerupTracker = require('./powerup-tracker');
//var Overlay = require('./overlay');
var TagPro = require('./tagpro');
var CornerSource = require('./test-tile-source');
var TileOverlay = require('./tile-overlay');
var Animate = require('./animate');

// Logging.
/*TagPro.on("*", function (state) {
  console.log("State: %s.", JSON.stringify(state));
  console.log("tagpro map: " + tagpro.map);
});*/

//var tracker;

// Get socket immediately.
TagPro.on("socket", function (state) {
  // guard against group games.
  //if (!state.group) {
    var tracker = new PowerupTracker(state.socket);
    window.tracker = tracker;
    // Initialize overlay when user playing (instead of spectating).
    TagPro.on("user.playing", function (state) {
      console.log("User player, starting overlay.");
      tracker.start();
      var overlay = new TileOverlay(tracker);
      Animate(function () {
        overlay.update();
      });
    });
  //}
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
