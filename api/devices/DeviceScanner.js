import { Bonjour } from "bonjour-service";

/**
 * Use Bonjour mDNS to mark devices as up or down in the DeviceStore
 */
export class DeviceScanner {
  constructor(store) {
    this.store = store;

    this.bonjour = new Bonjour();
    const browser = this.bonjour.find({ type: "wled" });

    browser.on("up", (service) => {
      this.store.markDeviceUp(service.host);
    });

    browser.on("down", (service) => {
      this.store.markDeviceDown(service.host);
    });

    browser.start();
    //TODO: Do I need to update to remove old adverts?
  }

  async shutdown() {
    return new Promise((resolve) => {
      this.bonjour.destroy(() => {
        resolve();
      });
    });
  }
}
