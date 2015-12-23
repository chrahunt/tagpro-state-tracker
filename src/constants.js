module.exports = {
  TILE_WIDTH: 40,
  TILES: {
    powerup: {
      active: [6.1, 6.2, 6.3, 6.4],
      inactive: [6],
      id: [6]
    },
    bomb: {
      active: [10],
      inactive: [10.1],
      id: [10]
    },
    boost: {
      active: [5, 14, 15],
      inactive: [5.1, 14.1, 15.1],
      id: [5, 14, 15]
    }
  },
  RESPAWN: {
    powerup: 60e3,
    bomb: 30e3,
    boost: 10e3
  }
};
