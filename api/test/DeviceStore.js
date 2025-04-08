import assert from "assert";
import * as td from "testdouble";

import { DeviceStore } from "../devices/DeviceStore.js";

var store = new DeviceStore();
var dao;
beforeEach(async function () {
  store = new DeviceStore();
  dao = td.object(["loadRegisteredDeviceData", "saveDeviceData", "shutdown"]);
  td.when(dao.loadRegisteredDeviceData(td.matchers.anything())).thenResolve(0);
  td.when(dao.shutdown()).thenResolve();

  await store.init(dao);
});

afterEach(async function () {
  store.shutdown();
});

describe("DeviceStore", function () {
  describe("#registerDevice()", function () {
    it("registered device should persist", function () {
      store.registerDevice(1, 2, "fooHost", [[1, 1]]);
      assert.equal(store.getRegisteredDevices()[0].host, "fooHost");
      assert.equal(store.getRegisteredDevices()[0].up, null); //assert this to make sure the similar assertion below isn't a false positive
      td.verify(
        dao.saveDeviceData(
          td.matchers.contains({
            id: 0,
            x: 1,
            y: 2,
            host: "fooHost",
            pixels: [{ x: 1, y: 1 }],
          })
        )
      );
    });

    it("existing unregistered device should be removed when registered", function () {
      store.markDeviceUp("barHost");
      store.registerDevice(1, 2, "barHost", [[1, 1]]);

      assert.equal(Object.keys(store.getUnregisteredDevices()).length, 0);
      assert.equal(store.getRegisteredDevices()[0].up, true); // make sure this has been copied from the unregistered device record
    });

    it("dynamic field starts as null", function () {
      assert.equal(store.minX, null);
      assert.equal(store.maxX, null);
      assert.equal(store.minY, null);
      assert.equal(store.maxY, null);
    });

    it("dynamic field is same as single registered device", function () {
      store.registerDevice(1, 2, "barHost", [[1, 1]]);

      assert.equal(store.minX, 1);
      assert.equal(store.maxX, 1);
      assert.equal(store.minY, 2);
      assert.equal(store.maxY, 2);
    });

    it("dynamic field spans 2 registered devices", function () {
      store.registerDevice(1, 2, "fooHost", [[1, 1]]);
      store.registerDevice(3, 4, "barHost", [[1, 1]]);

      assert.equal(store.minX, 1);
      assert.equal(store.maxX, 3);
      assert.equal(store.minY, 2);
      assert.equal(store.maxY, 4);

      //check the relative positions of the 2 single pixels
      assert.equal(store.getRegisteredDevices()[0].pixels[0].gX, 0.0);
      assert.equal(store.getRegisteredDevices()[0].pixels[0].gY, 0.0);
      assert.equal(store.getRegisteredDevices()[1].pixels[0].gX, 1.0);
      assert.equal(store.getRegisteredDevices()[1].pixels[0].gY, 1.0);
    });

    it("dynamic field uneffected by new in-range device", function () {
      store.registerDevice(1, 2, "fooHost", [[1, 1]]);
      store.registerDevice(3, 4, "barHost", [[1, 1]]);
      store.registerDevice(2, 3, "bazHost", [[1, 1]]);

      assert.equal(store.minX, 1);
      assert.equal(store.maxX, 3);
      assert.equal(store.minY, 2);
      assert.equal(store.maxY, 4);

      //check the relative positions of the 3rd single pixel
      assert.equal(store.getRegisteredDevices()[2].pixels[0].gX, 0.5);
      assert.equal(store.getRegisteredDevices()[2].pixels[0].gY, 0.5);
    });

    it("dynamic field spans 2 registered devices - max first", function () {
      store.registerDevice(3, 4, "barHost", [[1, 1]]);
      store.registerDevice(1, 2, "fooHost", [[1, 1]]);

      assert.equal(store.minX, 1);
      assert.equal(store.maxX, 3);
      assert.equal(store.minY, 2);
      assert.equal(store.maxY, 4);

      //check the relative positions of the 2 single pixels
      assert.equal(store.getRegisteredDevices()[1].pixels[0].gX, 0.0);
      assert.equal(store.getRegisteredDevices()[1].pixels[0].gY, 0.0);
      assert.equal(store.getRegisteredDevices()[0].pixels[0].gX, 1.0);
      assert.equal(store.getRegisteredDevices()[0].pixels[0].gY, 1.0);
    });

    it("normalised positions updated when dynamic field changes", function () {
      store.registerDevice(1, 2, "fooHost", [[1, 1]]);
      store.registerDevice(3, 4, "barHost", [[1, 1]]);
      store.registerDevice(5, 6, "bazHost", [[1, 1]]);

      assert.equal(store.minX, 1);
      assert.equal(store.maxX, 5);
      assert.equal(store.minY, 2);
      assert.equal(store.maxY, 6);

      //check the normalised positions of the 3rd single pixel
      assert.equal(store.getRegisteredDevices()[1].pixels[0].gX, 0.5);
      assert.equal(store.getRegisteredDevices()[1].pixels[0].gY, 0.5);
      assert.equal(store.getRegisteredDevices()[2].pixels[0].gX, 1.0);
      assert.equal(store.getRegisteredDevices()[2].pixels[0].gY, 1.0);
    });

    it("pixel local coordinates", function () {
      store.registerDevice(1, 2, "fooHost", [
        [1, 1],
        [11, 11],
        [6, 6],
        [3, 10],
      ]);

      const pixels = store.getRegisteredDevices()[0].pixels;
      assert.equal(pixels[0].lX, 0);
      assert.equal(pixels[0].lY, 0);
      assert.equal(pixels[1].lX, 1);
      assert.equal(pixels[1].lY, 1);
      assert.equal(pixels[2].lX, 0.5);
      assert.equal(pixels[2].lY, 0.5);
      assert.equal(pixels[3].lX, 0.2);
      assert.equal(pixels[3].lY, 0.9);
    });
  });

  describe("#markDeviceUp() / #markDeviceDown()", function () {
    it("markDeviceUp should update existing record", function () {
      store.markDeviceUp("barHost");

      //fudge these to a known (not-now) value so we can detect it has been updated
      store.unregisteredDevices["barHost"].firstSeen = 1;
      store.unregisteredDevices["barHost"].lastUp = 1;

      store.markDeviceUp("barHost");

      assert.equal(Object.keys(store.getUnregisteredDevices()).length, 1);
      assert.equal(store.getUnregisteredDevices()["barHost"].firstSeen, 1);
      assert.ok(
        store.getUnregisteredDevices()["barHost"].lastUp > Date.now() - 1000
      );
      assert.equal(store.getUnregisteredDevices()["barHost"].up, true);
    });

    it("markDeviceDown should update existing record", function () {
      store.markDeviceUp("barHost");

      //fudge these to a known (not-now) value so we can detect it has been updated
      store.unregisteredDevices["barHost"].firstSeen = 1;
      store.unregisteredDevices["barHost"].lastUp = 1;

      store.markDeviceDown("barHost");

      assert.equal(Object.keys(store.getUnregisteredDevices()).length, 1);
      assert.equal(store.getUnregisteredDevices()["barHost"].firstSeen, 1);
      assert.equal(store.getUnregisteredDevices()["barHost"].lastUp, null);
      assert.equal(store.getUnregisteredDevices()["barHost"].up, false);
    });
  });

  describe("#parsePixels()", function () {
    it("parses arrays of 2-element arrays", function () {
      assert.deepStrictEqual(
        DeviceStore.parsePixels([
          [1, 1],
          [2, 3],
        ]),
        [
          { x: 1, y: 1 },
          { x: 2, y: 3 },
        ]
      );
    });

    it("parses arrays of 3-element arrays", function () {
      assert.deepStrictEqual(
        DeviceStore.parsePixels([
          [1, 1, 1],
          [2, 3, 4],
        ]),
        [
          { x: 1, y: 1 },
          { x: 2, y: 3 },
        ]
      );
    });

    it("parses arrays of objects with x and y", function () {
      assert.deepStrictEqual(
        DeviceStore.parsePixels([
          { x: 1, y: 1, z: 1, other: "foo" },
          { x: 2, y: 3, z: 4, other: "bar" },
        ]),
        [
          { x: 1, y: 1 },
          { x: 2, y: 3 },
        ]
      );
    });
  });

  describe("#updatePixelColors()", function () {});
});
