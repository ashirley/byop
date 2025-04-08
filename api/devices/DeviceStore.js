import { spatialRainbow } from "@byop/demoData";
import { SqliteDao } from "../dao/SqliteDao.js";

import e131 from "e131";

export class DeviceStore {
  async init(dao = null) {
    this.minX = process.env.FIELD_MIN_X;
    this.maxX = process.env.FIELD_MAX_X;
    this.minY = process.env.FIELD_MIN_Y;
    this.maxY = process.env.FIELD_MAX_Y;

    this.dynamicFieldSize = !(
      "FIELD_MIN_X" in process.env &&
      "FIELD_MAX_X" in process.env &&
      "FIELD_MIN_Y" in process.env &&
      "FIELD_MAX_Y" in process.env
    );

    this.e131Cache = {};
    this.visualiserData = { devices: {} };
    this.visualiserDataBuffer = { devices: {} }; //store the data while it is being updated.

    if (dao != null) {
      this.db = dao;
    } else {
      if ("SQLITE_FILE" in process.env) {
        this.db = new SqliteDao();
        await this.db.init(process.env["SQLITE_FILE"]);
      } else {
        // create an in-memory dao
        // TODO
      }
    }
    await this.loadDeviceData();

    //setup an sACN server to receive data
    const listenForDmx = true;
    if (listenForDmx) {
      //TODO: make this configurable and support only using a slice of the data we receive on the universe.
      const dmxRows = 13;
      const dmxColumns = 13;

      this.e131Server = new e131.Server();
      const self = this;
      this.e131Server.on("listening", function () {
        console.log(
          "sACN server listening on port %d, universes %j",
          this.port,
          this.universes
        );
      });
      this.e131Server.on("packet", function (packet) {
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

        //NB. sourcename is padded with null characters which make comparing with something else awkward so trim them (took a long time to spot that!)
        self.dmxData.source = packet.getSourceName().replace(/\0*$/, "");
      });
    }

    this.statusUpdateCount = 0;
    await this.updateDeviceStatus();

    this.statusUpdater = setInterval(() => {
      this.updateDeviceStatus();
    }, 5000); //poll devices for their status every 5s
  }

  //TODO: update the UI as this API will now be slightly different.
  getRegisteredDevices() {
    return this.devices;
  }

  isEmpty() {
    return Object.keys(this.devices).length === 0;
  }

  registerDevice(x, y, host, pixels) {
    const id = this.nextId++;

    this.registerDevice0(id, x, y, host, pixels);
    this.saveDeviceData(id);
  }

  /**
   * Add the device as a registered device without saving to the DB. Used internally.
   * @param {*} id
   * @param {*} x
   * @param {*} y
   * @param {*} host
   * @param {*} pixels
   */
  registerDevice0(id, x, y, host, pixels) {
    var globalLimitsChanged = false;
    if (this.dynamicFieldSize) {
      //update global min/max
      if (this.minX == null || x < this.minX) {
        this.minX = x;
        globalLimitsChanged = true;
      }
      if (this.maxX == null || x > this.maxX) {
        this.maxX = x;
        globalLimitsChanged = true;
      }
      if (this.minY == null || y < this.minY) {
        this.minY = y;
        globalLimitsChanged = true;
      }
      if (this.maxY == null || y > this.maxY) {
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

    const matchingUnregisteredDevice = this.unregisteredDevices[host];
    if (matchingUnregisteredDevice != null) {
      //now this is being registered, remove from unregistered list.
      delete this.unregisteredDevices[host];
    }

    const device = matchingUnregisteredDevice || { x, y, host };
    device.id = id;
    device.pixels = DeviceStore.parsePixels(pixels);

    this.devices[id] = device;

    //calculate local min/max
    const allPixelX = device.pixels.map((p) => p.x);
    const allPixelY = device.pixels.map((p) => p.y);
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

    //TODO: refactor to a listener
    if (host) {
      var client = new e131.Client(host);
      var packet = client.createPacket(3 * device.pixels.length);
      packet.setSourceName("BYOP");
      packet.setUniverse(0x01);

      this.e131Cache[id] = [client, packet];
    }
  }

  updatePixelColors() {
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
          const c = spatialRainbow(timestamp, pixel, deviceId, pixelIndex);
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

  //TODO: factor out? and test
  async updateDeviceStatus() {
    console.log("updating device status (" + this.statusUpdateCount + ")");
    console.time("updateDeviceStatus");

    const promises = [];

    for (const [deviceId, device] of Object.entries(this.devices)) {
      if (device.host != null) {
        promises.push(
          fetch("http://" + device.host + "/json/info")
            .then((response) => {
              return response.json();
            })
            .then((responseJson) => {
              device.warningMessages = this.extractWarningMessages(
                responseJson,
                device
              );
              if (!device.up) {
                //this was down but now seems to be responding so mark it as having come up now
                device.lastUp = Date.now();
              }
              device.up = true;

              console.log(
                device.host,
                device.warningMessages,
                responseJson.ver,
                responseJson.leds.count,
                responseJson.live,
                responseJson.wifi.signal
              );
            })
            .catch(function (err) {
              device.warningMessages = [];
              device.up = false;
              console.log("Unable to fetch -", err);
            })
        );
      } else {
        device.warningMessages = [];
        device.up = false;
      }
    }

    await Promise.all(promises);

    this.statusUpdateCount++;
    console.timeEnd("updateDeviceStatus");
  }

  extractWarningMessages(responseJson, device) {
    const retval = [];

    if (!responseJson.live) {
      retval.push("Not receiving/accepting e.131 stream");
    }
    if (responseJson.leds.count < device.pixels.length) {
      retval.push("fewer physical pixels configured in wled than in byop");
    }
    if (responseJson.wifi.signal < 20) {
      retval.push("Poor wifi signal");
    }

    return retval;
  }

  markDeviceUp(host) {
    const currentDeviceRecord = this.unregisteredDevices[host];
    console.log("service up: ", currentDeviceRecord);
    if (currentDeviceRecord) {
      this.unregisteredDevices[host] = {
        host,
        firstSeen: currentDeviceRecord.firstSeen,
        lastUp: Date.now(),
        up: true,
      };
    } else {
      this.unregisteredDevices[host] = {
        host,
        firstSeen: Date.now(),
        lastUp: Date.now(),
        up: true,
      };
    }
  }

  markDeviceDown(host) {
    const currentDeviceRecord = this.unregisteredDevices[host];
    console.log("service down: ", currentDeviceRecord);
    if (currentDeviceRecord) {
      currentDeviceRecord.lastUp = null;
      currentDeviceRecord.up = false;
    }
  }

  getUnregisteredDevices() {
    return this.unregisteredDevices;
  }

  async loadDeviceData() {
    this.devices = {};

    //TODO: persist this
    this.unregisteredDevices = {
      // fooHost: {
      //   host: "fooHost",
      //   firstSeen: Date.now(),
      //   lastUp: Date.now(),
      //   up: true,
      // },
      // barHost: {
      //   host: "barHost",
      //   firstSeen: Date.now(),
      //   lastUp: Date.now(),
      //   up: false,
      // },
    };

    if (this.db != null) {
      this.nextId = await this.db.loadRegisteredDeviceData(
        this.registerDevice0
      );
    } else {
      this.nextId = 0;
    }
  }

  // TODO: return a promise
  saveDeviceData(id) {
    if (this.db != null) {
      const device = this.devices[id];

      this.db.saveDeviceData(device);
    } else {
      console.log("No database specified so not saving new device's info");
    }
  }

  async shutdown() {
    const promises = [];
    if (this.db != null) {
      promises.push(this.db.shutdown());
    }

    if (this.e131Server != null) {
      promises.push(
        new Promise((resolve, reject) => {
          this.e131Server.on("close", () => {
            resolve();
          });
        })
      );
      this.e131Server.close();
    }

    if (this.statusUpdater != null) {
      promises.push(
        new Promise((resolve, reject) => {
          clearInterval(this.statusUpdater);
          this.statusUpdater = null;
          resolve();
        })
      );
    }

    return Promise.all(promises).then(
      () => {
        console.log("shut down DeviceStore");
      },
      (result) => {
        console.log("Error shutting down DeviceStore - " + result);
      }
    );
  }

  static parsePixels(pixels) {
    if (pixels == null) {
      return [{ x: 0, y: 0 }];
    }
    if (Array.isArray(pixels)) {
      const retval = [];
      for (const [pixelIndex, pixel] of pixels.entries()) {
        if (Array.isArray(pixel)) {
          if (pixel.length === 2) {
            retval.push({ x: pixel[0], y: pixel[1] });
          } else if (pixel.length === 3) {
            console.log(
              `Ignoring the 3rd dimension for pixel ${pixelIndex} as we only map in 2D`
            );
            retval.push({ x: pixel[0], y: pixel[1] });
          } else {
            throw new Error(`Couldn't parse pixel ${pixelIndex} (${pixel})`);
          }
        } else if (typeof pixel === "object" && "x" in pixel && "y" in pixel) {
          if ("z" in pixel) {
            console.log(
              `Ignoring the 3rd dimension for pixel ${pixelIndex} as we only map in 2D`
            );
          }
          retval.push({ x: pixel.x, y: pixel.y });
        } else {
          //TODO: parse strings?

          throw new Error(
            `Couldn't parse pixel ${pixelIndex} (${typeof pixel} - ${pixel})`
          );
        }
      }
      return retval;
    }

    //TODO: parse strings?
    throw new Error(`Couldn't parse pixels (${typeof pixels} - ${pixels})`);
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
