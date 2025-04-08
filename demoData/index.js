const sampleIndividuals = 5000;
const sampleTents = 0;
export const targetFps = 15;

export function sampleDevices() {
  const fieldMinX = 0;
  const fieldMaxX = 550000;
  const fieldMinY = 0;
  const fieldMaxY = 250000;

  const devices = {
    // 0: createSinglePixelDevice(250000, 100000),
    0: createTentDevice(250000, 100000),
    1: createTentDevice(7500, 2500),
    2: createTentDevice(0, 200),
    3: createTentDevice(12500, 0),
    4: createTentDevice(5000, 15000),
  };

  var devicesLength = 5;

  for (let i = 0; i < sampleTents; i++) {
    const tentX = Math.random() * fieldMaxX;
    const tentY = Math.random() * fieldMaxY;

    devices[devicesLength++] = createTentDevice(tentX, tentY);
  }

  for (let i = 0; i < sampleIndividuals; i++) {
    const pointX = Math.random() * fieldMaxX;
    const pointY = Math.random() * fieldMaxY;

    devices[devicesLength++] = createSinglePixelDevice(pointX, pointY);
  }

  //populate relative dimensions for all pixels
  for (const [_, device] of Object.entries(devices)) {
    const gX =
      fieldMaxX === fieldMinX
        ? 0.5
        : (device.x - fieldMinX) / (fieldMaxX - fieldMinX);
    const gY =
      fieldMaxY === fieldMinY
        ? 0.5
        : (device.y - fieldMinY) / (fieldMaxY - fieldMinY);
    if (gY < 0 || gY > 1) {
      console.log("Incorrect gY", gY);
    }
    if (gX < 0 || gX > 1) {
      console.log("Incorrect gX", gX);
    }
    for (const [_, pixel] of Object.entries(device.pixels)) {
      pixel.gX = gX;
      pixel.gY = gY;
      pixel.lX =
        device.maxX === device.minX
          ? 0.5
          : (pixel.x - device.minX) / (device.maxX - device.minX);
      pixel.lY =
        device.maxY === device.minY
          ? 0.5
          : (pixel.y - device.minY) / (device.maxY - device.minY);
      if (pixel.lY < 0 || pixel.lY > 1) {
        console.log("Incorrect lY", pixel.lY);
      }
      if (pixel.lX < 0 || pixel.lX > 1) {
        console.log("Incorrect lX", pixel.lX);
      }
    }
  }
  return {
    devices,
    minX: fieldMinX,
    maxX: fieldMaxX,
    minY: fieldMinY,
    maxY: fieldMaxY,
  };
}

function createPixel(d = 375, x = 0, y = 0, z = 0) {
  return { d, x, y, z };
}

function createTentDevice(x, y) {
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

  return { pixels, x, y, minX: 0, maxX: 3000, minY: 0, maxY: 3000 };
}

function createSinglePixelDevice(x, y) {
  const pixels = { 0: createPixel(375, 0, 0, 0) };
  return { pixels, x, y };
}

/**
 * A rainbow which moves across the space.
 *
 * @param {*} timestamp a timestamp for this update loop. typically `performance.now()`.
 * @param {*} pixel.gX a global x coordinate for the device itself [0,1]
 * @param {*} pixel.gY a global y coordinate for the device itself [0,1]
 * @param {*} pixel.lX a local x coordinate for the pixel relative to the device [0,1]
 * @param {*} pixel.lY a local y coordinate for the pixel relative to the device [0,1]
 * @returns rgb and hsl for the given pixel
 */
export function spatialRainbow(timestamp, pixel, deviceId, pixelIndex) {
  const localWeight = 0.5;

  const t = (timestamp % 5000) / 5000;

  const phase =
    (t +
      (pixel.gX +
        2 * pixel.gY +
        2 * localWeight * (pixel.lX - 0.5) +
        localWeight * (pixel.lY - 0.5)) /
        (3 + 3 * localWeight)) %
    1;

  // const h = 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
  const h = phase;
  const s = 0.5;
  const l = 0.3;

  const [r, g, b] = hslToRgb(h, s, l);

  return { h, s, l, r, g, b };
}

//https://stackoverflow.com/a/9493060/6950
/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 1].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
export function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  // return [round(r * 255), round(g * 255), round(b * 255)];
  return [r, g, b];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
