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
  // delay bomb tracker setup.
  setTimeout(function bombTrackerSetup() {
    if (tagpro.map) {
      var bomb_tracker = new SightTracker({
        socket: state.socket,
        map: tagpro.map
      });
      if (overlay) {
        overlay.addSource(bomb_tracker);
      } else {
        setTimeout(function addBombTracker() {
          if (overlay) {
            overlay.addSource(bomb_tracker);
          } else {
            setTimeout(addBombTracker, 50);
          }
        }, 50);
      }
    } else {
      setTimeout(bombTrackerSetup, 50);
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
