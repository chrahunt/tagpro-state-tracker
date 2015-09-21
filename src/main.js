var PowerupTracker = require('./powerup-tracker');
var Overlay = require('./overlay');
var TagPro = require('./tagpro');

// Logging.
/*TagPro.on("*", function (state) {
  console.log("State: %s.", JSON.stringify(state));
});*/

var tracker;

// Get socket immediately.
TagPro.on("socket", function (state) {
  // guard against group games.
  //if (!state.group) {
    tracker = new PowerupTracker(state.socket);
    // Initialize overlay when user playing.
    TagPro.on("user.playing", function (state) {
      var overlay = new Overlay(tracker);
    });
  //}
});
