import e131 from "e131";

import { spatialRainbow } from "@byop/demoData";

const byopAddr = "127.0.0.1";
const dmxRows = 13;
const dmxColumns = 13;

const client = new e131.Client(byopAddr);
const packet = client.createPacket(3 * dmxRows * dmxColumns);
packet.setSourceName("BYOP");
packet.setUniverse(0x01);
const slotsData = packet.getSlotsData();

const targetFps = 30;

setInterval(() => {
  const timestamp = performance.now();

  for (let row = 0; row < dmxRows; row++) {
    //TODO: is the direction correct here? IS there evan a "correct"
    const gY = row / (dmxRows - 1);
    const lY = 0;

    for (let column = 0; column < dmxColumns; column++) {
      const gX = column / (dmxColumns - 1);
      const lX = 0;

      const c = spatialRainbow(timestamp, { gX, gY, lX, lY });

      const pixelIndex = row * dmxRows + column;
      slotsData[pixelIndex * 3] = 255 * c.r;
      slotsData[pixelIndex * 3 + 1] = 255 * c.g;
      slotsData[pixelIndex * 3 + 2] = 255 * c.b;

      // console.log(
      //   row,
      //   column,
      //   gX,
      //   gY,
      //   lX,
      //   lY,
      //   c.r,
      //   c.g,
      //   c.b,
      //   slotsData[pixelIndex * 3],
      //   slotsData[pixelIndex * 3 + 1],
      //   slotsData[pixelIndex * 3 + 2]
      // );
    }
  }
  client.send(packet);
}, 1000 / targetFps);

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
function hslToRgb(h, s, l) {
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
