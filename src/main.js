var PowerupTracker = require('./powerup-tracker');
var Overlay = require('./overlay');
var TagPro = require('./tagpro');

TagPro.on('user.playing', function () {
  var tracker = new PowerupTracker();
  var overlay = new Overlay(tracker);
});
