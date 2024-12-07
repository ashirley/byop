import { spatialRainbow } from "@byop/demoData";
import { Device } from "./Device.js";

import e131 from "e131";

export class DeviceStore {
  constructor() {
    this.devices = {};
    this.nextId = 0;

    this.minX = process.env.FIELD_MIN_X || 0;
    this.maxX = process.env.FIELD_MAX_X || 0;
    this.minY = process.env.FIELD_MIN_Y || 0;
    this.maxY = process.env.FIELD_MAX_Y || 0;

    this.dynamicFieldSize =
      FIELD_MIN_X in process.env &&
      FIELD_MAX_X in process.env &&
      FIELD_MIN_Y in process.env &&
      FIELD_MAX_Y in process.env;

    this.e131Cache = {};
    this.visualiserData = { devices: {} };
    this.visualiserDataBuffer = { devices: {} }; //store the data while it is being updated.

    //setup an sACN server to receive data
    const listenForDmx = true;
    if (listenForDmx) {
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

        //NB. sourecname is padded with null characters which make comparing with something else awkward so trim them (took a long time to spot that!)
        self.dmxData.source = packet.getSourceName().replace(/\0*$/, "");
      });
    }
  }

  //TODO: update the UI as this API will now be slightly different.
  existingDevices() {
    return this.devices;
  }

  addDevice(x, y, ipAddr, pixels) {
    const id = this.nextId++;

    const device = { id, x, y, ipAddr, pixels: Device.parsePixels(pixels) };
    this.devices[id] = device;

    var globalLimitsChanged = false;
    if (this.dynamicFieldSize) {
      //update global min/max
    if (x < this.minX) {
      this.minX = x;
      globalLimitsChanged = true;
    }
    if (x > this.maxX) {
      this.maxX = x;
      globalLimitsChanged = true;
    }
    if (y < this.minY) {
      this.minY = y;
      globalLimitsChanged = true;
    }
    if (y > this.maxY) {
      this.maxY = y;
      globalLimitsChanged = true;
      }
    } else {
      //pin the input to the field size.
      if (x < this.minX) {
        x = this.minX;
      }
      if (x > this.maxX) {
        x = this.maxX;
      }
      if (y < this.minY) {
        y = this.minY;
      }
      if (y > this.maxY) {
        y = this.maxY;
      }
    }

    //calculate local min/max
    const allPixelX = Object.entries(device.pixels).map(([_, p]) => p.x);
    const allPixelY = Object.entries(device.pixels).map(([_, p]) => p.y);
    device.minX = Math.min(...allPixelX);
    device.maxX = Math.max(...allPixelX);
    device.minY = Math.min(...allPixelY);
    device.maxY = Math.max(...allPixelY);

    // Create normalised (i.e. 0-1) device/global location (g) and pixel/local location (l)
    const gX =
      this.maxX === this.minX
        ? 0
        : (device.x - this.minX) / (this.maxX - this.minX);
    const gY =
      this.maxY === this.minY
        ? 0
        : (device.y - this.minY) / (this.maxY - this.minY);
    for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
      pixel.gX = gX;
      pixel.gY = gY;
      pixel.lX =
        device.maxX === device.minX
          ? 0
          : (pixel.x - device.minX) / (device.maxX - device.minX);
      pixel.lY =
        device.maxY === device.minY
          ? 0
          : (pixel.y - device.minY) / (device.maxY - device.minY);
    }

    if (globalLimitsChanged) {
      // as the field has got bigger, the previously calculated normalised values need to be recalculated.
      for (const [_, device] of Object.entries(this.devices)) {
        const gX =
          this.maxX === this.minX
            ? 0
            : (device.x - this.minX) / (this.maxX - this.minX);
        const gY =
          this.maxY === this.minY
            ? 0
            : (device.y - this.minY) / (this.maxY - this.minY);
        for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
          pixel.gX = gX;
          pixel.gY = gY;
        }
      }
    }

    if (ipAddr) {
      var client = new e131.Client(ipAddr);
      var packet = client.createPacket(
        3 * Object.entries(device.pixels).length
      );
      packet.setSourceName("BYOP");
      packet.setUniverse(0x01);

      this.e131Cache[id] = [client, packet];
    }
  }

  update() {
    const timestamp = performance.now();

    if (this.dmxData == null) {
      this.visualiserDataBuffer.source = "demo-api";
    } else {
      if (this.dmxData.source.trim() === "BYOP-demo-dmx") {
        this.visualiserDataBuffer.source = "demo-dmx";
      } else {
        this.visualiserDataBuffer.source = "dmx";
      }
    }

    for (const [deviceId, device] of Object.entries(this.devices)) {
      for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
        var r, g, b;

        const t = (Date.now() % 5000) / 5000;

        if (this.dmxData == null) {
          // const c = spatialRainbow(timestamp, pixel);
          const c = spatialRainbow(timestamp, pixel);
          r = c.r;
          g = c.g;
          b = c.b;

          // if (deviceId == 2 && (t * 1000) % 5 == 1) {
          //   console.log(
          //     "localData",
          //     deviceId,
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
          const nX = (pixel.gX + localWeight * pixel.lX) % 1;
          const nY = (pixel.gY + localWeight * pixel.lY) % 1;

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

          //   if (deviceId == 2 && (t * 1000) % 5 == 1) {
          //     console.log(
          //       "dmx",
          //       deviceId,
          //       pixelIndex,
          //       pixel.gX,
          //       pixel.gY,
          //       pixel.lX,
          //       pixel.lY,
          //       nX,
          //       nY,
          //       inputNW,
          //       inputNE,
          //       inputSE,
          //       inputSW,
          //       localWeight,
          //       r,
          //       g,
          //       b
          //     );
          //   }
        }

        //publish to visualiser / sACN
        if (deviceId in this.e131Cache) {
          const [_, packet] = this.e131Cache[deviceId];
          const slotsData = packet.getSlotsData();

          slotsData[pixelIndex * 3] = r * 255;
          slotsData[pixelIndex * 3 + 1] = g * 255;
          slotsData[pixelIndex * 3 + 2] = b * 255;
        }
        if (!(deviceId in this.visualiserDataBuffer.devices)) {
          this.visualiserDataBuffer.devices[deviceId] = {
            x: device.x,
            y: device.y,
            minX: device.minX,
            maxX: device.maxX,
            minY: device.minY,
            maxY: device.maxY,
            pixels: {},
          };
        }
        this.visualiserDataBuffer.devices[deviceId]["pixels"][pixelIndex] = {
          x: pixel.x,
          y: pixel.y,
          r,
          g,
          b,
        };
      }
      if (deviceId in this.e131Cache) {
        const [client, packet] = this.e131Cache[deviceId];
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
