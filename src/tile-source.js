var Vec2 = require('vec2');

// Interface for tileSource for tile overlay.
function TileSource() {}

/**
 * @typedef {object} Tile
 * @property {number} x - World x location of top-left.
 * @property {number} y - World y location of top-left.
 * @property {boolean} [hideIndicator=false] - Whether to hide the indicator
 *   for this tile when an indicator.
 * @property {boolean} [hideOverlay=false] - Whether to hide the overlay
 *   for this tile when an overlay.
 * @property {*} content - Content to place at tile location.
 */

// Return tiles to be displayed, array of Tile, or null for none.
TileSource.prototype.getTiles = function() {};
