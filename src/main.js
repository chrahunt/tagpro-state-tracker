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
