export const pixels = (updated) => {
  const devices = {
    0: createAndAddTent(0, 0),
    1: createAndAddTent(7500, 2500),
    2: createAndAddTent(0, 200),
    3: createAndAddTent(12500, 0),
    4: createAndAddTent(5000, 15000),
  };

  for (let i = 0; i < 500; i++) {
    const tentX = Math.random() * fieldMaxX;
    const tentY = Math.random() * fieldMaxY;

    devices[i + 5] = createAndAddTent(tentX, tentY);
  }

  for (let i = 0; i < 1000; i++) {
    const pointX = Math.random() * fieldMaxX;
    const pointY = Math.random() * fieldMaxY;

    devices[i + 1005] = createAndAddSingle(pointX, pointY);
  }

  //update on an interval
  const targetFps = 30;
  setInterval(() => {
    const timestamp = performance.now();
    // console.log(typeof devices, devices);
    for (const [_, device] of Object.entries(devices)) {
      for (const [_, pixel] of Object.entries(device.pixels)) {
        spatialRainbow(device, pixel, timestamp);
      }
    }
    updated(devices);
  }, 1000 / targetFps);

  updated(devices);
};

//TODO: use maxX and minX instead
// const bbox = new THREE.Box3().setFromObject(group, true);
const totalX = 1000; //bbox.max.x;
const totalY = 1000; //bbox.max.y;

//TODO: make this dynamic
const fieldMinX = 0;
const fieldMaxX = 550000;
const fieldMinY = 0;
const fieldMaxY = 250000;
var logged = 0;

function spatialRainbow(d, p, timestamp) {
  const t = timestamp / 10000.0;

  //TODO: make this dynamic
  const tentMinX = 0;
  const tentMaxX = 3000;
  const tentMinY = 0;
  const tentMaxY = 3000;

  const tentWeight = 0.5;

  const tentX = (p.x - tentMinX) / (tentMaxX - tentMinX);
  const tentY = (p.y - tentMinY) / (tentMaxY - tentMinY);

  const fieldX = (d.x - fieldMinX) / (fieldMaxX - fieldMinX);
  const fieldY = (d.y - fieldMinY) / (fieldMaxY - fieldMinY);

  //   if (logged < 100) {
  //     console.log(logged);
  //     console.log(timestamp, t);
  //     console.log(p.x, p.y, d.x, d.y);
  //     console.log(p.x, tentMinX, tentMaxX);
  //     console.log(d.x, fieldMinX, fieldMaxX);
  //     console.log(tentX, tentY, fieldX, fieldY);
  //     logged = logged + 1;
  //   }
  p.h =
    0.5 +
    0.5 *
      Math.sin(
        2 *
          Math.PI *
          (t +
            (fieldX +
              2 * fieldY +
              2 * tentWeight * tentX +
              tentWeight * tentY) /
              (3 + 3 * tentWeight) /
              2)
      );
}

function createPixel(d = 375, x = 0, y = 0, z = 0) {
  return { d, x, y, z, h: 0.5, s: 0.5, l: 0.5 };
}

function createAndAddTent(x, y) {
  //pixel size
  const s = 175;

  const pixels = {
    0: createPixel(s, 0, 0, 0),
    1: createPixel(s, 250, 250, 425),
    2: createPixel(s, 500, 500, 750),
    3: createPixel(s, 750, 750, 1075),
    4: createPixel(s, 1000, 1000, 1250),
    5: createPixel(s, 1250, 1250, 1425),
    6: createPixel(s, 1500, 1500, 1500),
    7: createPixel(s, 1750, 1750, 1425),
    8: createPixel(s, 2000, 2000, 1250),
    9: createPixel(s, 2250, 2250, 1075),
    10: createPixel(s, 2500, 2500, 750),
    11: createPixel(s, 2750, 2750, 425),
    12: createPixel(s, 3000, 3000, 0),

    13: createPixel(s, 3000, 0, 0),
    14: createPixel(s, 2750, 250, 425),
    15: createPixel(s, 2500, 500, 750),
    16: createPixel(s, 2250, 750, 1075),
    17: createPixel(s, 2000, 1000, 1250),
    18: createPixel(s, 1750, 1250, 1425),
    19: createPixel(s, 1250, 1750, 1425),
    20: createPixel(s, 1000, 2000, 1250),
    21: createPixel(s, 750, 2250, 1075),
    22: createPixel(s, 500, 2500, 750),
    23: createPixel(s, 250, 2750, 425),
    24: createPixel(s, 0, 3000, 0),
  };

  return { pixels, x, y };
}

function createAndAddSingle(x, y) {
  const pixels = { 0: createPixel(0, 375, 1500, 1500, 0) };
  return { pixels, x, y };
}
