import { SqliteDao } from "../dao/SqliteDao.js";
import { DmxColorSource } from "../colorSource/DmxColorSource.js";
import { DemoDataColorSource } from "../colorSource/DemoDataColorSource.js";
import { VisualiserPixelListener } from "../pixelListener/VisualiserPixelListener.js";
import { DmxPixelListener } from "../pixelListener/DmxPixelListener.js";
import { CompositePixelListener } from "../pixelListener/CompositePixelListener.js";

export class DeviceStore {
  async init(dao = null, colorSourceIn = null, pixelListenerIn = null) {
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

    this.statusUpdater = setInterval(() => {
      this.updateDeviceStatus();
    }, 5000); //poll devices for their status every 5s
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

    this.pixelListener.newDevice(id, host, device.pixels.length);
  }

  updatePixelColors() {
    const timestamp = performance.now();

    this.pixelListener.startedUpdatingDevices(this.colorSource.getSource());

    for (const [deviceId, device] of Object.entries(this.devices)) {
      for (const [pixelIndex, pixel] of Object.entries(device.pixels)) {
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
    //TODO: if there is 1 pixel in byop, and more than 1 in WLED, check wled is configured to receive e.131 correctly.
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
