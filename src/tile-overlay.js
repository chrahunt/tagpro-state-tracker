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

module.exports = TileOverlay;
function TileOverlay(source, options) {
  if (typeof options == "undefined") options = {};
  // offset for indicator frame.
  this.x_visible = 40;
  this.y_visible = this.x_visible;
  this.x_indicator_offset = 50;
  this.y_indicator_offset = this.x_indicator_offset;

  this.source = source;

  var tiles = this.source.getTiles();

  // Set up indicator container.
  this.indicator_ui = new PIXI.DisplayObjectContainer();
  tagpro.renderer.layers.ui.addChild(this.indicator_ui);
  var texture = this._makeIndicatorTexture();

  this.indicators = {};
  var self = this;
  tiles.forEach(function (tile) {
    var id = Vec2.toString(tile);
    var sprite = new PIXI.Sprite(texture);
    sprite.anchor = new PIXI.Point(0.5, 0.5);
    self.indicator_ui.addChild(sprite);
    var t = Utils.makeText();
    self.indicator_ui.addChild(t);
    sprite.visible = false;
    t.visible = false;
    self.indicators[id] = {
      sprite: sprite,
      text: t
    };
  });

  // Set up tile overlay containers.
  this.tile_ui = new PIXI.DisplayObjectContainer();
  tagpro.renderer.layers.foreground.addChild(this.tile_ui);
  this.tile_overlays = {};
  tiles.forEach(function (tile) {
    var id = Vec2.toString(tile);
    var t = Utils.makeText();
    self.tile_ui.addChild(t);
    self.tile_overlays[id] = {
      text: t
    };
  });

  $(window).resize(this._onResize.bind(this));
  this._onResize();
}

TileOverlay.prototype.update = function() {
  var tiles = this.source.getTiles();
  if (!tiles) {
    return;
  }
  var offscreen_tiles = [];
  var visible_tiles = [];
  
  var bounds = this._getBounds();
  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    if (this._inBounds(bounds, tile)) {
      visible_tiles.push(tile);
    } else {
      offscreen_tiles.push(tile);
    }
  }

  var self = this;
  // Remove indicators for visible tiles.
  visible_tiles.forEach(function (tile) {
    var id = Vec2.toString(tile);
    var indicator = self.indicators[id];
    indicator.text.visible = false;
    indicator.sprite.visible = false;
  });

  // Hide overlays for non-visible tiles.
  offscreen_tiles.forEach(function (tile) {
    var id = Vec2.toString(tile);
    var overlay = self.tile_overlays[id];
    overlay.text.visible = false;
  });

  // Do drawings.
  this._drawOverlays(visible_tiles);
  this._drawIndicators(offscreen_tiles);
};

TileOverlay.prototype._drawOverlays = function(tiles) {
  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    var id = Vec2.toString(tile);
    var text = this.tile_overlays[id].text;
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

  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    var id = Vec2.toString(tile);
    var indicator = this.indicators[id];
    if (tile.hideIndicator) {
      indicator.sprite.visible = false;
      indicator.text.visible = false;
    } else {
      var draw = false;
      var loc = new Vec2(tile.x, tile.y);

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

// return [[x1, y1], [x2, y2]] for bounds rectangle of visible area in game coordinates.
TileOverlay.prototype._getBounds = function() {
  var scale = tagpro.renderer.gameContainer.scale.x;
  var gameContainer = tagpro.renderer.gameContainer;
  var gameLocation = new Vec2(gameContainer.x, gameContainer.y).divc(-scale);
  var topleft = new Vec2(0, 0)
    .addc(this.x_visible)
    .add(gameLocation);
  var viewport = $("#viewport");

  // Game center.
  var botright = new Vec2(viewport.width(), viewport.height())
    // Scale
    .divc(scale)
    .add(gameLocation)
    .subc(this.x_visible);
  return [ topleft, botright ];
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
