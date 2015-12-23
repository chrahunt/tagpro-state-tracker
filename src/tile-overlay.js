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
