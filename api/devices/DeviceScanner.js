import { Bonjour } from "bonjour-service";

export class DeviceScanner {
  constructor(store) {
    this.existingDevices = store;
    //TODO: persist this
    this.knownDevices = {
      foo: {
        host: "fooHost",
        firstSeen: Date.now(),
        lastUp: Date.now(),
        up: true,
      },
      bar: {
        host: "barHost",
        firstSeen: Date.now(),
        lastUp: Date.now(),
        up: false,
      },
    };

    this.bonjour = new Bonjour();
    const browser = this.bonjour.find({ type: "wled" });

    browser.on("up", (service) => {
      const currentDeviceRecord = this.knownDevices[service.name];
      console.log("service up: ", service, currentDeviceRecord);
      if (currentDeviceRecord) {
        this.knownDevices[service.name] = {
          host: service.host,
          firstSeen: currentDeviceRecord.firstSeen,
          lastUp: Date.now(),
          up: true,
        };
      } else {
        this.knownDevices[service.name] = {
          host: service.host,
          firstSeen: Date.now(),
          lastUp: Date.now(),
          up: true,
        };
      }
    });

    browser.on("down", (service) => {
      const currentDeviceRecord = this.knownDevices[service.name];
      console.log("service down: ", service, currentDeviceRecord);
      if (currentDeviceRecord) {
        currentDeviceRecord.lastUp == null;
        currentDeviceRecord.up == false;
      }
    });

    browser.start();
    //TODO: Do I need to update to remove old adverts?
  }

  getUnregisteredDevices() {
    const existingDeviceHosts = Object.values(
      this.existingDevices.existingDevices()
    ).map((o) => o.ipAddr);
    return Object.fromEntries(
      Object.entries(this.knownDevices).filter(([k, v]) => {
        console.log(
          k,
          !existingDeviceHosts.includes(v.host),
          v.host,
          existingDeviceHosts
        );
        return !existingDeviceHosts.includes(v.host);
      })
    ); //TODO: normalise ipAddr/host?
  }

  async shutdown() {
    return new Promise((resolve) => {
      this.bonjour.destroy(() => {
        resolve();
      });
    });
  }
}
