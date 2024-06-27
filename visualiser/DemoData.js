export const pixels = (updated) => {
  const devices = {
    0: createAndAddTent(0, 0),
    1: createAndAddTent(300, 100),
    2: createAndAddTent(0, 200),
    3: createAndAddTent(500, 0),
    4: createAndAddTent(200, 600),
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
const fieldMaxX = 22000;
const fieldMinY = 0;
const fieldMaxY = 10000;
var logged = 0;

function spatialRainbow(d, p, timestamp) {
  const t = timestamp / 10000.0;

  //TODO: make this dynamic
  const tentMinX = 0;
  const tentMaxX = 120;
  const tentMinY = 0;
  const tentMaxY = 120;

  const tentWeight = 1;

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

function createPixel(d = 15, x = 0, y = 0, z = 0) {
  return { d, x, y, z, h: 0.5, s: 0.5, l: 0.5 };
}

function createAndAddTent(x, y) {
  //pixel size
  const s = 7;

  const pixels = {
    0: createPixel(s, 0, 0, 0),
    1: createPixel(s, 10, 10, 17),
    2: createPixel(s, 20, 20, 30),
    3: createPixel(s, 30, 30, 43),
    4: createPixel(s, 40, 40, 50),
    5: createPixel(s, 50, 50, 57),
    6: createPixel(s, 60, 60, 60),
    7: createPixel(s, 70, 70, 57),
    8: createPixel(s, 80, 80, 50),
    9: createPixel(s, 90, 90, 43),
    10: createPixel(s, 100, 100, 30),
    11: createPixel(s, 110, 110, 17),
    12: createPixel(s, 120, 120, 0),

    13: createPixel(s, 120, 0, 0),
    14: createPixel(s, 110, 10, 17),
    15: createPixel(s, 100, 20, 30),
    16: createPixel(s, 90, 30, 43),
    17: createPixel(s, 80, 40, 50),
    18: createPixel(s, 70, 50, 57),
    19: createPixel(s, 50, 70, 57),
    20: createPixel(s, 40, 80, 50),
    21: createPixel(s, 30, 90, 43),
    22: createPixel(s, 20, 100, 30),
    23: createPixel(s, 10, 110, 17),
    24: createPixel(s, 0, 120, 0),
  };

  return { pixels, x, y };
}

function createAndAddSingle(x, y) {
  const pixels = { 0: createPixel(0, 15, 60, 60, 0) };
  return { pixels, x, y };
}
