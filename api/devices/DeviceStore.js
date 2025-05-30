import { SqliteDao } from "../dao/SqliteDao.js";
import { DmxColorSource } from "../colorSource/DmxColorSource.js";
import { DemoDataColorSource } from "../colorSource/DemoDataColorSource.js";
import { VisualiserPixelListener } from "../pixelListener/VisualiserPixelListener.js";
import { DmxPixelListener } from "../pixelListener/DmxPixelListener.js";
import { CompositePixelListener } from "../pixelListener/CompositePixelListener.js";

export class DeviceStore {
  async init(dao = null, colorSourceIn = null, pixelListenerIn = null) {
    this.minX = process.env.FIELD_MIN_X
      ? Number(process.env.FIELD_MIN_X)
      : null;
    this.maxX = process.env.FIELD_MAX_X
      ? Number(process.env.FIELD_MAX_X)
      : null;
    this.minY = process.env.FIELD_MIN_Y
      ? Number(process.env.FIELD_MIN_Y)
      : null;
    this.maxY = process.env.FIELD_MAX_Y
      ? Number(process.env.FIELD_MAX_Y)
      : null;

    this.dynamicFieldSize = !(
      "FIELD_MIN_X" in process.env &&
      "FIELD_MAX_X" in process.env &&
      "FIELD_MIN_Y" in process.env &&
      "FIELD_MAX_Y" in process.env
    );

    if (pixelListenerIn != null) {
      this.visualiserListener = null;
      this.pixelListener = pixelListenerIn;
    } else {
      this.visualiserListener = new VisualiserPixelListener();
      this.pixelListener = new CompositePixelListener(
        this.visualiserListener,
        new DmxPixelListener()
      );
    }

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

    if (colorSourceIn != null) {
      this.colorSource = colorSourceIn;
    } else {
      const listenForDmx = true;
      if (listenForDmx) {
        //setup an sACN server to receive data
        //TODO: make this configurable and support only using a slice of the data we receive on the universe.
        const dmxRows = 13;
        const dmxColumns = 13;

        this.colorSource = new DmxColorSource(dmxRows, dmxColumns);
      } else {
        //setup a demodata color source
        this.colorSource = new DemoDataColorSource();
      }
    }
    this.statusUpdateCount = 0;
    await this.updateDeviceStatus();
  }

  getRegisteredDevices() {
    return this.devices;
  }

  getDeviceById(id) {
    return this.devices[id];
  }

  isEmpty() {
    return Object.keys(this.devices).length === 0;
  }

  registerDevice(x, y, host, pixels) {
    const id = this.nextId++;

    this.registerDevice0(id, x, y, host, pixels);
    this.saveDeviceData(id);

    return id;
  }

  updateDevice(id, x, y, pixels) {
    this.registerDevice0(id, x, y, this.devices[id].host, pixels);
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

    const device = matchingUnregisteredDevice || {};
    device.x = x;
    device.y = y;
    device.host = host;
    device.id = id;
    device.pixels = DeviceStore.parsePixels(pixels);

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
        ? 0.5
        : (device.x - this.minX) / (this.maxX - this.minX);
    const gY =
      this.maxY === this.minY
        ? 0.5
        : (device.y - this.minY) / (this.maxY - this.minY);
    for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
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
    }

    if (globalLimitsChanged) {
      // as the field has got bigger, the previously calculated normalised values need to be recalculated.
      for (const [_, device] of Object.entries(this.devices)) {
        const gX =
          this.maxX === this.minX
            ? 0.5
            : (device.x - this.minX) / (this.maxX - this.minX);
        const gY =
          this.maxY === this.minY
            ? 0.5
            : (device.y - this.minY) / (this.maxY - this.minY);
        for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
          pixel.gX = gX;
          pixel.gY = gY;
        }
      }
    }

    this.devices[id] = device;

    this.pixelListener.newDevice(id, host, device.pixels.length);
  }

  updatePixelColors() {
    const timestamp = performance.now();

    this.pixelListener.startedUpdatingDevices(this.colorSource.getSource());

    for (const [deviceId, device] of Object.entries(this.devices)) {
      for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
        try {
          var r, g, b;

          const c = this.colorSource.calculate(
            timestamp,
            pixel,
            deviceId,
            pixelIndex
          );
          r = c.r;
          g = c.g;
          b = c.b;

          this.pixelListener.updatePixelColor(
            deviceId,
            pixelIndex,
            r,
            g,
            b,
            device,
            pixel
          );
        } catch (e) {
          console.error("Couldn't update color for device " + deviceId, e);
        }
      }
      this.pixelListener.finishedUpdatingDevice(deviceId);
    }
    this.pixelListener.finishedUpdatingDevices();
  }

  //TODO: factor out? and test
  async updateDeviceStatus() {
    console.log("updating device status (" + this.statusUpdateCount + ")");
    console.time("updateDeviceStatus");

    const promises = [];

    for (const [deviceId, device] of Object.entries(this.devices)) {
      if (device.host != null) {
        promises.push(this.updateSingleDeviceStatus(device));
      } else {
        device.warningMessages = [];
        device.up = false;
      }
    }

    await Promise.all(promises);

    this.statusUpdateCount++;
    console.timeEnd("updateDeviceStatus");

    this.statusUpdater = setTimeout(() => {
      this.updateDeviceStatus();
    }, 60_000); //poll devices for their status in another 60s
  }

  async updateSingleDeviceStatus(device) {
    try {
      const infoResponse = await fetch("http://" + device.host + "/json/info");
      const infoResponseJson = await infoResponse.json();
      const cfgResponse = await fetch("http://" + device.host + "/json/cfg");
      const cfgResponseJson = await cfgResponse.json();

      device.warningMessages = this.extractWarningMessages(
        infoResponseJson,
        cfgResponseJson,
        device
      );
      if (!device.up) {
        //this was down but now seems to be responding so mark it as having come up now
        device.lastUp = Date.now();
      }
      device.up = true;
      // console.log(
      //   device.host,
      //   device.warningMessages,
      //   infoResponseJson.ver,
      //   infoResponseJson.leds.count,
      //   cfgResponseJson.hw.led.total,
      //   infoResponseJson.live,
      //   cfgResponseJson.if.live.dmx.mode,
      //   infoResponseJson.wifi.signal
      // );
    } catch (err) {
      device.warningMessages = [];
      device.up = false;
      console.log("Unable to fetch -", err);
    }
  }

  extractWarningMessages(infoResponseJson, cfgResponseJson, device) {
    const retval = [];

    if (!infoResponseJson.live) {
      retval.push({
        fixId: "liveMode",
        description: "Not receiving/accepting e1.31 stream",
      });
    }

    /*
    |  wled  |  byop  | wled mode | result
    | pixels | pixels |           |
    --------------------------------------
    |        |        |           |
    | 1      | 1      | single    | good
    | 1      | 1      | multiple  | fine
    | 1      | 1      | other     | error - fix wled mode
    | 1      | n      | single    | error - fix byop pixelCount (or wled pixelCount + mode)
    | 1      | n      | multiple  | error - fix wled pixelCount (or byop pixelCount)
    | 1      | n      | other     | error - fix wled pixelCount + mode
    | n      | 1      | single    | good
    | n      | 1      | multiple  | error - fix byop pixelCount (or wled mode)
    | n      | 1      | other     | error - fix wled mode
    | n      | n      | single    | error - fix wled mode
    | n      | n      | multiple  | good
    | n      | n      | other     | error - fix wled mode
    | n      | != n   | single    | error - fix wled mode + fix wled pixelCount (or byop pixelCount)
    | n      | != n   | multiple  | error - fix byop pixelCount (or wled pixelCount)
    | n      | != n   | other     | error - fix wled mode + fix wled pixelCount (or byop pixelCount)
    */

    const wledPixels = infoResponseJson.leds.count;
    const byopPixels = device.pixels.length;
    const wledMode = cfgResponseJson.if.live.dmx.mode;
    const SINGLE = 1;
    const MULTIPLE = 4;

    if (wledPixels === 1) {
      if (byopPixels === 1) {
        if (wledMode !== SINGLE && wledMode !== MULTIPLE) {
          retval.push({
            fixId: "liveMode",
            description:
              "WLED's dmx mode is not \"Single RGB\" which is what we'll be sending",
          });
        }
      } /* (byopPixels !== 1) */ else {
        if (wledMode === SINGLE) {
          retval.push({
            fixId: "byopPixelCount",
            fixData: wledPixels,
            description: `Incorrect number of pixels configured in BYOP (${byopPixels}) compared to 1 physical pixel in WLED`,
          });
          retval.push({
            fixId: "wledPixelCountAndMode",
            description: `Incorrect number of physical pixels configured in wled (${wledPixels}, and it has "Single RGB" dmx mode) compared to byop (${byopPixels})`,
          });
        } else if (wledMode === MULTIPLE) {
          retval.push({
            fixId: "wledPixelCountAndMode",
            description: `Incorrect number of physical pixels configured in wled (${wledPixels}, and it has "Multiple RGB" dmx mode) compared to byop (${byopPixels})`,
          });
          retval.push({
            fixId: "byopPixelCount",
            fixData: wledPixels,
            description: `Incorrect number of pixels configured in BYOP (${byopPixels}) compared to 1 physical pixel in WLED`,
          });
        } /* (wledMode === OTHER) */ else {
          retval.push({
            fixId: "wledPixelCountAndMode",
            description: `Incorrect number of physical pixels configured in wled (${wledPixels}, and it has an unsupported dmx mode) compared to byop (${byopPixels})`,
          });
        }
      }
    } /*(wledPixels !== 1)*/ else {
      if (byopPixels === 1) {
        if (wledMode === MULTIPLE) {
          retval.push({
            fixId: "byopPixelCount",
            fixData: wledPixels,
            description: `Incorrect number of pixels configured in BYOP (${byopPixels}) compared to 1 physical pixel in WLED`,
          });
        retval.push({
          fixId: "liveMode",
          description:
              "WLED's dmx mode is not \"Single RGB\" which is what we'll be sending",
        });
        } /* (wledMode === OTHER) */ else {
        retval.push({
          fixId: "liveMode",
          description:
            "WLED's dmx mode is not \"Single RGB\" which is what we'll be sending",
        });
        }
      } /* (byopPixels !== 1) */ else {
        //both have multiple pixels
        if (byopPixels === wledPixels) {
          if (wledMode === SINGLE) {
            retval.push({
              fixId: "liveMode",
              description:
                "WLED's dmx mode is not \"Multi RGB\" which is what we'll be sending",
            });
          } else if (wledMode === MULTIPLE) {
            //good
          } /* (wledMode === OTHER) */ else {
            retval.push({
              fixId: "liveMode",
              description:
                "WLED's dmx mode is not \"Multi RGB\" which is what we'll be sending",
            });
          }
        } /* (byopPixels === wledPixels) */ else {
          if (wledMode === SINGLE) {
            retval.push({
              fixId: "wledPixelCountAndMode",
              description: `Incorrect number of physical pixels configured in wled (${wledPixels}, and it has "Single RGB" dmx mode) compared to byop (${byopPixels})`,
            });
            retval.push({
              fixId: "byopPixelCountAndMode",
              fixData: wledPixels,
              description: `Incorrect number of pixels configured in BYOP (${byopPixels}) compared to physical pixels in WLED (${wledPixels}, and it has "Single RGB" dmx mode)`,
            });
          } else if (wledMode === MULTIPLE) {
            retval.push({
              fixId: "byopPixelCount",
              fixData: wledPixels,
              description: `Incorrect number of pixels configured in BYOP (${byopPixels}) compared to physical pixels in WLED (${wledPixels})`,
            });
            retval.push({
              fixId: "wledPixelCount",
              description: `Incorrect number of physical pixels configured in wled (${wledPixels}) compared to byop (${byopPixels})`,
            });
          } /* (wledMode === OTHER) */ else {
            retval.push({
              fixId: "wledPixelCountAndMode",
              description: `Incorrect number of physical pixels configured in wled (${wledPixels}, and it has an unsupported dmx mode) compared to byop (${byopPixels})`,
            });
            retval.push({
              fixId: "byopPixelCountAndMode",
              fixData: wledPixels,
              description: `Incorrect number of pixels configured in BYOP (${byopPixels}) compared to physical pixels in WLED (${wledPixels}, and it has an unsupported dmx mode)`,
            });
          }
        }
      }
    }

    if (cfgResponseJson.if.live.en !== true) {
      retval.push({
        fixId: "liveMode",
        description: "WLED's Receive UDP Realtime is not enabled",
      });
    }

    if (cfgResponseJson.if.live.port !== 5568) {
      retval.push({
        fixId: "liveMode",
        description:
          "WLED's Receive UDP Realtime is not on the expected port (i.e. E1.31)",
      });
    }

    if (infoResponseJson.wifi.signal < 20) {
      retval.push({ description: "Poor wifi signal" });
    }

    return retval;
  }

  async fixLiveMode(deviceId) {
    const device = this.devices[deviceId];

    // 1 = Single RGB, 4 = Multi RGB
    const desiredMode = device.pixels.length == 1 ? 1 : 4;

    if (device.host != null) {
      const response = await fetch("http://" + device.host + "/json/cfg", {
        method: "POST",
        body: JSON.stringify({
          if: {
            live: {
              en: true,
              mso: false,
              port: 5568,
              dmx: { mode: desiredMode },
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseJson = await response.json();

      //{"success":true}
      if (responseJson.success !== true) {
        throw new Error(
          "Got unexpected JSON response from WLED: " +
            JSON.stringify(responseJson)
        );
      }

      await this.updateSingleDeviceStatus(this.devices[deviceId]);
    } else {
      return Promise.reject(new Error("No hostname associated with device"));
    }
  }

  async fixWledPixelCount(deviceId) {
    const device = this.devices[deviceId];

    if (device.host != null) {
      const cfgResponse = await fetch("http://" + device.host + "/json/cfg");
      const cfgResponseJson = await cfgResponse.json();
      if (cfgResponseJson.hw.led.ins.length !== 1) {
        throw new Error(
          "Can't adjust led count in wled when there are multiple inputs"
        );
      } else {
        const desiredPin = cfgResponseJson.hw.led.ins[0].pin;
        const desiredPixelCount = device.pixels.length;

        const response = await fetch("http://" + device.host + "/json/cfg", {
          method: "POST",
          body: JSON.stringify({
            hw: {
              led: { ins: [{ pin: desiredPin, len: desiredPixelCount }] },
            },
          }),
        });
        const responseJson = await response.json();

        //{"success":true}
        if (responseJson.success !== true) {
          throw new Error(
            "Got unexpected JSON response from WLED: " +
              JSON.stringify(responseJson)
          );
        }

        await this.updateSingleDeviceStatus(this.devices[deviceId]);
      }
    } else {
      return Promise.reject(new Error("No hostname associated with device"));
    }
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
        this.registerDevice0.bind(this)
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

    if (this.colorSource != null) {
      promises.push(this.colorSource.shutdown());
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
