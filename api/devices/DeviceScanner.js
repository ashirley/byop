import { Bonjour } from "bonjour-service";

export class DeviceScanner {
  constructor(store) {
    this.existingDevices = store;
    this.knownDevices = { foo: "bar" };

    this.bonjour = new Bonjour();
    const browser = this.bonjour.find({ type: "wled" });

    browser.on("up", (service) => {
      console.log("service up: ", service, this.knownDevices[service.name]);
      this.knownDevices[service.name] = service.host;
    });

    browser.on("down", (service) => {
      console.log("service down: ", service, this.knownDevices[service.name]);
      delete this.knownDevices[service.name];
    });

    browser.start();
    //TODO: Do I need to update to remove old adverts?
  }

  getUnregisteredDevices() {
    return this.knownDevices; //TODO: filter out already registered devices.
  }

  async shutdown() {
    return new Promise((resolve) => {
      this.bonjour.destroy(() => {
        resolve();
      });
    });
  }
}
