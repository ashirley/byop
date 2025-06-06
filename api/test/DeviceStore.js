import assert from "assert";
import * as td from "testdouble";

import { DeviceStore } from "../devices/DeviceStore.js";

var store = new DeviceStore();
var dao;
var colorSource;
var pixelListener;

beforeEach(async function () {
  store = new DeviceStore();
  dao = td.object(["loadRegisteredDeviceData", "saveDeviceData", "shutdown"]);
  td.when(dao.loadRegisteredDeviceData(td.matchers.anything())).thenResolve(0);
  td.when(dao.shutdown()).thenResolve();

  colorSource = td.object(["calculate", "getSource", "shutdown"]);
  td.when(colorSource.getSource()).thenReturn("test-source");
  td.when(colorSource.shutdown()).thenResolve();

  pixelListener = td.object([
    "newDevice",
    "startedUpdatingDevices",
    "updatePixelColor",
    "finishedUpdatingDevice",
    "finishedUpdatingDevices",
  ]);

  await store.init(dao, colorSource, pixelListener);
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

    it("registered device cannot duplicate host", function () {
      store.registerDevice(1, 2, "fooHost", [[1, 1]]);
      assert.throws(
        () => store.registerDevice(3, 4, "fooHost", [[1, 1]]),
        /Duplicate host/
      );

      assert.equal(Object.keys(store.getRegisteredDevices()).length, 1);
      assert.equal(store.getRegisteredDevices()[0].host, "fooHost");
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

    it("static field constrains input", async function () {
      try {
        process.env.FIELD_MIN_X = 10;
        process.env.FIELD_MAX_X = 20;
        process.env.FIELD_MIN_Y = 30;
        process.env.FIELD_MAX_Y = 40;

        store.shutdown();
        await store.init(dao, colorSource, pixelListener);

        assert.equal(store.minX, 10);
        assert.equal(store.maxX, 20);
        assert.equal(store.minY, 30);
        assert.equal(store.maxY, 40);

        store.registerDevice(15, 35, "fooHost", [[1, 1]]);
        store.registerDevice(5, 45, "barHost", [[1, 1]]);
        store.registerDevice(25, 5, "bazHost", [[1, 1]]);

        td.verify(
          dao.saveDeviceData(
            td.matchers.contains({
              x: 15,
              y: 35,
              host: "fooHost",
            })
          )
        );
        td.verify(
          dao.saveDeviceData(
            td.matchers.contains({
              x: 10,
              y: 40,
              host: "barHost",
            })
          )
        );
        td.verify(
          dao.saveDeviceData(
            td.matchers.contains({
              x: 20,
              y: 30,
              host: "bazHost",
            })
          )
        );
      } finally {
        delete process.env.FIELD_MIN_X;
        delete process.env.FIELD_MAX_X;
        delete process.env.FIELD_MIN_Y;
        delete process.env.FIELD_MAX_Y;
      }
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
    it("markDeviceUp should update existing unregisteredDevices record", function () {
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

    it("markDeviceUp should consider existing registeredDevices record", function () {
      const id = store.registerDevice(1, 2, "barHost", [[1, 1]]);

      store.markDeviceUp("barHost");

      //Don't track this, use a more pro-active mechanism once it is registered.
      assert.equal(Object.keys(store.getUnregisteredDevices()).length, 0);
    });

    it("markDeviceDown should update existing unregisteredDevices record", function () {
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

    it("markDeviceDown should consider existing registeredDevices record", function () {
      const id = store.registerDevice(1, 2, "barHost", [[1, 1]]);

      store.markDeviceDown("barHost");

      //Don't track this, use a more pro-active mechanism once it is registered.
      assert.equal(Object.keys(store.getUnregisteredDevices()).length, 0);
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

  describe("#updatePixelColors()", function () {
    it("considers all pixels and calls listeners correctly", function () {
      td.when(
        colorSource.calculate(
          td.matchers.anything(), //timestamp
          td.matchers.anything(), //pixel
          "0", //deviceId
          "0" //pixelIndex
        )
      ).thenReturn({ r: 0, g: 0, b: 0 });

      td.when(
        colorSource.calculate(
          td.matchers.anything(), //timestamp
          td.matchers.anything(), //pixel
          "1", //deviceId
          "0" //pixelIndex
        )
      ).thenReturn({ r: 1, g: 0, b: 0 });

      td.when(
        colorSource.calculate(
          td.matchers.anything(), //timestamp
          td.matchers.anything(), //pixel
          "1", //deviceId
          "1" //pixelIndex
        )
      ).thenReturn({ r: 1, g: 1, b: 0 });

      store.registerDevice(0, 0, "fooHost", [[1, 1]]);
      store.registerDevice(0, 1, "barHost", [
        [1, 1],
        [1, 1],
      ]);
      store.updatePixelColors();

      td.verify(pixelListener.startedUpdatingDevices("test-source"), {
        times: 1,
      });
      td.verify(
        pixelListener.updatePixelColor(
          "0", // deviceId
          "0", // pixelIndex
          0, // r
          0, // g
          0, // b
          td.matchers.anything(), // device
          td.matchers.anything() // pixel
        ),
        { times: 1 }
      );
      td.verify(pixelListener.finishedUpdatingDevice("0"), { times: 1 });

      td.verify(
        pixelListener.updatePixelColor(
          "1", // deviceId
          "0", // pixelIndex
          1, // r
          0, // g
          0, // b
          td.matchers.anything(), // device
          td.matchers.anything() // pixel
        ),
        { times: 1 }
      );
      td.verify(
        pixelListener.updatePixelColor(
          "1", // deviceId
          "1", // pixelIndex
          1, // r
          1, // g
          0, // b
          td.matchers.anything(), // device
          td.matchers.anything() // pixel
        ),
        { times: 1 }
      );
      td.verify(pixelListener.finishedUpdatingDevice("1"), { times: 1 });

      td.verify(pixelListener.finishedUpdatingDevices(), { times: 1 });
    });
  });
});
