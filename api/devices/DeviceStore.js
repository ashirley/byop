import { Device } from "./Device.js";
import e131 from "e131";

export class DeviceStore {
  constructor() {
    this.devices = [];

    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;

    this.e131Cache = {};
    this.visualiserData = {};
    this.visualiserDataBuffer = {}; //store the data while it is being updated.
  }

  existingDevices() {
    return this.devices;
  }

  addDevice(id, x, y, ipAddr, pixels) {
    const device = new Device(id, x, y, ipAddr, pixels);
    this.devices.push(device);

    if (x < this.minX) {
      this.minX = x;
    }
    if (x > this.maxX) {
      this.maxX = x;
    }
    if (y < this.minY) {
      this.minY = y;
    }
    if (y > this.maxY) {
      this.maxY = y;
    }

    if (ipAddr) {
      var client = new e131.Client(ipAddr);
      var packet = client.createPacket(3 * device.getPixels().length);
      packet.setSourceName("BYOP");
      packet.setUniverse(0x01);

      this.e131Cache[id] = [client, packet];
    }
  }

  update() {
    for (const [_, device] of Object.entries(this.devices)) {
      for (const [pixelIndex, pixel] of Object.entries(device.getPixels())) {
        // Create normalised (i.e. 0-1) device/global location (g) and pixel/local location (l)
        const gX = (device.location.x - this.minX) / (this.maxX - this.minX);
        const gY = (device.location.y - this.minY) / (this.maxY - this.minY);
        const lX =
          device.maxX === device.minX
            ? 0
            : (pixel.x - device.minX) / (device.maxX - device.minX);
        const lY =
          device.maxY === device.minY
            ? 0
            : (pixel.y - device.minY) / (device.maxY - device.minY);

        const localWeight = 0.5;

        const t = (Date.now() % 5000) / 5000;

        // const h =
        //   0.5 +
        //   0.5 *
        //     Math.sin(
        //       2 *
        //         Math.PI *
        //         (t + (gX + 2 * gY + 2 * localWeight * lX + localWeight * lY) /
        //           (3 + 3 * localWeight))
        //     );
        const phase =
          (t +
            (gX + 2 * gY + 2 * localWeight * lX + localWeight * lY) /
              (3 + 3 * localWeight)) %
          1;
        // const h = 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
        const h = phase;
        const s = 1;
        const l = 0.3;

        const [r, g, b] = hslToRgb(h, s, l);

        // if (device.id == 2 && (t * 1000) % 5 == 1) {
        // console.log(
        //   device.id,
        //   pixelIndex,
        //   phase,
        //   t,
        //   gX,
        //   gY,
        //   lX,
        //   lY,
        //   localWeight,
        //   h,
        //   s,
        //   l,
        //   r,
        //   g,
        //   b
        // );
        // }

        //publish to visualiser / sACN
        if (device.id in this.e131Cache) {
          const [client, packet] = this.e131Cache[device.id];
          const slotsData = packet.getSlotsData();

          //TODO: support non-RGB color ordering
          slotsData[pixelIndex * 3] = r;
          slotsData[pixelIndex * 3 + 1] = g;
          slotsData[pixelIndex * 3 + 2] = b;
        }
        if (!(device.id in this.visualiserDataBuffer)) {
          this.visualiserDataBuffer[device.id] = {
            x: device.location.x,
            y: device.location.y,
            pixels: {},
          };
        }
        this.visualiserDataBuffer[device.id]["pixels"][pixelIndex] = {
          x: pixel.x,
          y: pixel.y,
          r,
          g,
          b,
        };
      }
      if (device.id in this.e131Cache) {
        const [client, packet] = this.e131Cache[device.id];
        client.send(packet);
      }
    }

    //swap the buffers to atomically update all the values.
    const tmp = this.visualiserData;
    this.visualiserData = this.visualiserDataBuffer;
    this.visualiserDataBuffer = tmp;
    // console.log(JSON.stringify(this.visualiserData));
  }
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
