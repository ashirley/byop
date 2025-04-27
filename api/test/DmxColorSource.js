import assert from "assert";
import * as td from "testdouble";

import { DmxColorSource } from "../colorSource/DmxColorSource.js";

var source; // = new DmxColorSource(2, 2);
var cb = td.matchers.captor();

beforeEach(async function () {
  this.E131Adapter = await td.constructor();

  source = new DmxColorSource(2, 2, this.E131Adapter);

  cb = td.matchers.captor();
  td.verify(new this.E131Adapter(cb.capture()));
});

afterEach(async function () {
  source.shutdown();
});

describe("DmxColorSource", function () {
  describe("adapter callback", function () {
    it("detects incorrect dmx data count", function () {
      cb.value(
        [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
        "test-source"
      );

      //TODO: how do I detect a console.error?
    });

    it("re-arranges data correctly", function () {
      cb.value(
        [255, 127, 0, 255, 255, 255, 255, 0, 255, 0, 255, 255],
        "test-source"
      );

      assert.deepEqual(
        [...source.dmxData], //spread to remove the non-array, named property "source"
        [
          [
            [1, 0.4980392156862745, 0],
            [1, 1, 1],
          ],
          [
            [1, 0, 1],
            [0, 1, 1],
          ],
        ]
      );
    });

    it("re-arranges data correctly - wide", function () {
      source = new DmxColorSource(2, 3, this.E131Adapter);

      cb = td.matchers.captor();
      td.verify(new this.E131Adapter(cb.capture()));

      cb.value(
        [
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255, 255, 255,
        ],
        "test-source"
      );

      assert.deepEqual(
        [...source.dmxData], //spread to remove the non-array, named property "source"
        [
          [
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1],
          ],
          [
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1],
          ],
        ]
      );
    });

    it("re-arranges data correctly - tall", function () {
      source = new DmxColorSource(3, 2, this.E131Adapter);

      cb = td.matchers.captor();
      td.verify(new this.E131Adapter(cb.capture()));

      cb.value(
        [
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255, 255, 255,
        ],
        "test-source"
      );

      assert.deepEqual(
        [...source.dmxData], //spread to remove the non-array, named property "source"
        [
          [
            [1, 1, 1],
            [1, 1, 1],
          ],
          [
            [1, 1, 1],
            [1, 1, 1],
          ],
          [
            [1, 1, 1],
            [1, 1, 1],
          ],
        ]
      );
    });

    it("saves source", function () {
      cb.value(
        [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
        "test-source"
      );

      assert.equal(source.dmxData.source, "test-source");
    });
  });

  describe("getSource", function () {
    it("detects demo", function () {
      cb.value(
        [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
        "BYOP-demo-dmx"
      );

      assert.equal(source.getSource(), "demo-dmx");
    });

    it("detects non demo", function () {
      cb.value(
        [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
        "anything-else"
      );

      assert.equal(source.getSource(), "dmx");
    });
  });

  describe("#calculate()", function () {
    it("interpolates white vertically across single pixels", function () {
      cb.value(
        [255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0],
        "anything-else"
      );

      //middle of black row
      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 1, lX: 0.5, lY: 1 }, 0, 0),
        { r: 0, g: 0, b: 0 }
      );

      //middle of white row
      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0, lX: 0.5, lY: 0 }, 0, 0),
        { r: 1, g: 1, b: 1 }
      );

      //middle between white and black
      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0.5, lX: 0.5, lY: 0.5 }, 0, 0),
        { r: 0.5, g: 0.5, b: 0.5 }
      );
    });

    it("interpolates white horizontally across single pixels", function () {
      cb.value(
        [255, 255, 255, 0, 0, 0, 255, 255, 255, 0, 0, 0],
        "anything-else"
      );

      //middle of black row
      assert.deepEqual(
        source.calculate(1, { gX: 1, gY: 0.5, lX: 1, lY: 0.5 }, 0, 0),
        { r: 0, g: 0, b: 0 }
      );

      //middle of white row
      assert.deepEqual(
        source.calculate(1, { gX: 0, gY: 0.5, lX: 0, lY: 0.5 }, 0, 0),
        { r: 1, g: 1, b: 1 }
      );

      //middle between white and black
      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0.5, lX: 0.5, lY: 0.5 }, 0, 0),
        { r: 0.5, g: 0.5, b: 0.5 }
      );
    });

    it("interpolates white diagonally across single pixels", function () {
      cb.value(
        [255, 255, 255, 170, 170, 170, 85, 85, 85, 0, 0, 0],
        "anything-else"
      );

      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0.5, lX: 0.5, lY: 0.5 }, 0, 0),
        { r: 0.5, g: 0.5, b: 0.5 }
      );
    });

    //NB. This knows the value of localWeight inside calculate
    it("interpolates white horizontally across multiple pixels", function () {
      cb.value(
        [255, 255, 255, 0, 0, 0, 255, 255, 255, 0, 0, 0],
        "anything-else"
      );

      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0.5, lX: 0, lY: 0.5 }, 0, 0),
        { r: 0.5833333333333333, g: 0.5833333333333333, b: 0.5833333333333333 }
      );

      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0.5, lX: 1, lY: 0.5 }, 0, 0),
        {
          r: 0.41666666666666663,
          g: 0.41666666666666663,
          b: 0.41666666666666663,
        }
      );

      //move the device by .1 and the pixel by .5 should cancel out exactly.
      assert.deepEqual(
        source.calculate(1, { gX: 0.4, gY: 0.5, lX: 0.5, lY: 0.5 }, 0, 0),
        { r: 0.5833333333333333, g: 0.5833333333333333, b: 0.5833333333333333 }
      );
    });

    it("interpolates across a bigger input", function () {
      source = new DmxColorSource(3, 3, this.E131Adapter);

      cb = td.matchers.captor();
      td.verify(new this.E131Adapter(cb.capture()));

      cb.value(
        [
          255,
          0,
          0,
          170,
          0,
          0,
          85,
          0,
          0, //bottom row: red fading to the right
          0,
          255,
          0,
          0,
          170,
          0,
          0,
          85,
          0, //middle row: green fading to the right
          0,
          0,
          255,
          0,
          0,
          170,
          0,
          0,
          85, //top row: blue fading to the right
        ],
        "anything-else"
      );

      //middle is exactly on the middle input pixel
      assert.deepEqual(
        source.calculate(1, { gX: 0.5, gY: 0.5, lX: 0.5, lY: 0.5 }, 0, 0),
        { r: 0, g: 0.6666666666666666, b: 0 }
      );

      //bottom left quadrant
      assert.deepEqual(
        source.calculate(1, { gX: 0.25, gY: 0.25, lX: 0.25, lY: 0.25 }, 0, 0),
        { r: 0.41666666666666663, g: 0.41666666666666663, b: 0 }
      );

      //bottom right quadrant
      assert.deepEqual(
        source.calculate(1, { gX: 0.75, gY: 0.25, lX: 0.75, lY: 0.25 }, 0, 0),
        { r: 0.25, g: 0.25, b: 0 }
      );

      //top left quadrant
      assert.deepEqual(
        source.calculate(1, { gX: 0.25, gY: 0.75, lX: 0.25, lY: 0.75 }, 0, 0),
        { r: 0, g: 0.41666666666666663, b: 0.41666666666666663 }
      );

      //top right quadrant
      assert.deepEqual(
        source.calculate(1, { gX: 0.75, gY: 0.75, lX: 0.75, lY: 0.75 }, 0, 0),
        { r: 0, g: 0.25, b: 0.25 }
      );
    });
  });
});
