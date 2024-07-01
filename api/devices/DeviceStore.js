import { Device } from "./Device.js";
import e131 from "e131";

export class DeviceStore {
  constructor() {
    this.devices = [];

    //TODO: support fixing these so that:
    //1. users can't stretch the field by adding a pixel with a massive offset.
    //2. incomplete / sparse devices are still layed out correctly in a known space
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;

    this.e131Cache = {};
    this.visualiserData = {};
    this.visualiserDataBuffer = {}; //store the data while it is being updated.

    //setup an sACN server to receive data

    //TODO: make this configurable and support only using a slice of the data we receive on the universe.
    const dmxRows = 13;
    const dmxColumns = 13;

    var server = new e131.Server();
    const self = this;
    server.on("listening", function () {
      console.log(
        "sACN server listening on port %d, universes %j",
        this.port,
        this.universes
      );
    });
    server.on("packet", function (packet) {
      //check we got as much as we were expecting.
      if (packet.getSlotsData().length !== dmxRows * dmxColumns * 3) {
        console.error(
          `recieved wrong amount of dmx data. Got ${
            packet.getSlotsData().length
          } but was expecting ${
            dmxRows * dmxColumns * 3
          } (${dmxRows} x ${dmxColumns} x 3)`
        );
      }
      self.dmxData = toRGB2dArray(
        [...packet.getSlotsData()].map((d) => d / 255),
        dmxRows
      );
    });
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
        var r, g, b;
        // Create normalised (i.e. 0-1) device/global location (g) and pixel/local location (l)
        const gX =
          this.maxX === this.minX
            ? 0
            : (device.location.x - this.minX) / (this.maxX - this.minX);
        const gY =
          this.maxY === this.minY
            ? 0
            : (device.location.y - this.minY) / (this.maxY - this.minY);
        const lX =
          device.maxX === device.minX
            ? 0
            : (pixel.x - device.minX) / (device.maxX - device.minX);
        const lY =
          device.maxY === device.minY
            ? 0
            : (pixel.y - device.minY) / (device.maxY - device.minY);

        const t = (Date.now() % 5000) / 5000;

        if (this.dmxData == null) {
          const localWeight = 0.5;

          const phase =
            (t +
              (gX + 2 * gY + 2 * localWeight * lX + localWeight * lY) /
                (3 + 3 * localWeight)) %
            1;
          // const h = 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
          const h = phase;
          const s = 1;
          const l = 0.3;

          [r, g, b] = hslToRgb(h, s, l);

          // if (device.id == 2 && (t * 1000) % 5 == 1) {
          //   console.log(
          //     "localData",
          //     device.id,
          //     pixelIndex,
          //     phase,
          //     t,
          //     gX,
          //     gY,
          //     lX,
          //     lY,
          //     localWeight,
          //     h,
          //     s,
          //     l,
          //     r,
          //     g,
          //     b
          //   );
          // }
        } else {
          const localWeight = 0.2;

          // find pixel's effective normalised world coordinates.
          // Note that the local position is exagerated to show local interest instead of accurate mapping
          const nX = (gX + localWeight * lX) % 1;
          const nY = (gY + localWeight * lY) % 1;

          const inputWidth = this.dmxData.length - 1;
          const inputHeight = this.dmxData[0].length - 1;
          const inputNW =
            this.dmxData[Math.floor(nX * inputWidth)][
              Math.ceil(nY * inputHeight)
            ];
          const inputNE =
            this.dmxData[Math.ceil(nX * inputWidth)][
              Math.ceil(nY * inputHeight)
            ];
          const inputSE =
            this.dmxData[Math.ceil(nX * inputWidth)][
              Math.floor(nY * inputHeight)
            ];
          const inputSW =
            this.dmxData[Math.floor(nX * inputWidth)][
              Math.floor(nY * inputHeight)
            ];

          r = interpolate(
            inputNW[0],
            inputNE[0],
            inputSE[0],
            inputSW[0],
            (nX * inputWidth) % 1,
            (nY * inputHeight) % 1
          );
          g = interpolate(
            inputNW[1],
            inputNE[1],
            inputSE[1],
            inputSW[1],
            (nX * inputWidth) % 1,
            (nY * inputHeight) % 1
          );
          b = interpolate(
            inputNW[2],
            inputNE[2],
            inputSE[2],
            inputSW[2],
            (nX * inputWidth) % 1,
            (nY * inputHeight) % 1
          );

          // if (device.id == 2 && (t * 1000) % 5 == 1) {
          //   console.log(
          //     "dmx",
          //     device.id,
          //     pixelIndex,
          //     gX,
          //     gY,
          //     lX,
          //     lY,
          //     nX,
          //     nY,
          //     inputNW,
          //     inputNE,
          //     inputSE,
          //     inputSW,
          //     localWeight,
          //     r,
          //     g,
          //     b
          //   );
          // }
        }

        //publish to visualiser / sACN
        if (device.id in this.e131Cache) {
          const [_, packet] = this.e131Cache[device.id];
          const slotsData = packet.getSlotsData();

          slotsData[pixelIndex * 3] = r * 255;
          slotsData[pixelIndex * 3 + 1] = g * 255;
          slotsData[pixelIndex * 3 + 2] = b * 255;
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

function interpolate(nw, ne, se, sw, nX, nY) {
  //TODO: is this the best interpolation?
  const w = nw * nY + sw * (1 - nY);
  const e = ne * nY + se * (1 - nY);
  return e * nX + w * (1 - nX);
}

const toRGB2dArray = (arr, width) =>
  arr.reduce((rows, key, index) => {
    if (index % (width * 3) == 0) {
      //new row array
      rows.push([[key]]);
    } else if (index % 3 == 0) {
      //new column array
      rows[rows.length - 1].push([key]);
    } else {
      //add value to column
      const row = rows[rows.length - 1];
      const column = row[row.length - 1];
      column.push(key);
    }
    return rows;
  }, []);
