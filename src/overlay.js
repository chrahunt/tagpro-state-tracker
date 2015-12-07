// Various drawings.
// Drawing has properties init, update, hide, show.
var drawings = [
  { // Powerups.
    init: function (tracker) {
      console.log("Initializing powerup overlay.");
      this.tracker = tracker;
      
      // TODO: no hard-coded time interval.
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
      $(window).resize(this._onResize.bind(this));
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
      console.log("window resized, this: %o", this);
      var $viewport = $("#viewport");
      this.indicator_lines = [];
      // Top.
      this.indicator_lines.push(new Line([
        this.indicator_offset, this.indicator_offset,
        $viewport.width() - this.indicator_offset, this.indicator_offset
      ]));
      // Right.
      this.indicator_lines.push(new Line([
        $viewport.width() - this.indicator_offset, this.indicator_offset,
        $viewport.width() - this.indicator_offset, $viewport.height() - this.indicator_offset
      ]));
      // Bottom.
      this.indicator_lines.push(new Line([
        $viewport.width() - this.indicator_offset, $viewport.height() - this.indicator_offset,
        this.indicator_offset, $viewport.height() - this.indicator_offset
      ]));
      // Left.
      this.indicator_lines.push(new Line([
        this.indicator_offset, $viewport.height() - this.indicator_offset,
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
      // Center in-game coordinates.
      var center = new Vec2(viewport.width(), viewport.height())
        // Half
        .divc(2)
        // Scale
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
          if (powerup.state === "present") {
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
