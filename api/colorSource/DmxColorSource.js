import { E131Adapter } from "./E131Adapter.js";
import promClient from "prom-client";

export class DmxColorSource {
  constructor(dmxRows, dmxColumns, adapter = E131Adapter) {
    this.dmxData = [[[[0, 0, 0]]]];
    this.dmxData.source = "";

    this.updateMetric = new promClient.Summary({
      name: "byop_dmx_in_update_duration_seconds",
      help: "How long does it take to accept a new set of dmx data from e1.31",
    });

    this.e131Adapter = new adapter((data, source) => {
      const end = this.updateMetric.startTimer();

      //check we got as much as we were expecting.
      if (!(data.length === dmxRows * dmxColumns * 3 || data.length === 512)) {
        console.error(
          `recieved wrong amount of dmx data. Got ${
            data.length
          } but was expecting ${
            dmxRows * dmxColumns * 3
          } (${dmxRows} x ${dmxColumns} x 3)`
        );
      }
      this.dmxData = toRGB2dArray(
        data.map((d) => d / 255),
        dmxColumns,
        dmxRows
      );

      this.dmxData.source = source;

      end();
    });
  }

  getSource() {
    if (this.dmxData.source.trim() === "BYOP-demo-dmx") {
      return "demo-dmx";
    } else {
      return "dmx";
    }
  }

  calculate(timestamp, pixel, deviceId, pixelIndex) {
    const localWeight = 0.2;

    // find pixel's effective normalised world coordinates.
    // Note that the local position is exagerated to show local interest instead of accurate mapping
    const nX = (pixel.gX + localWeight * pixel.lX) / (1 + localWeight);
    const nY = (pixel.gY + localWeight * pixel.lY) / (1 + localWeight);

    //height and width is -1 because the dmx pixels are the edge, not within the shape.
    const inputWidth = this.dmxData.length - 1;
    const inputHeight = this.dmxData[0].length - 1;
    // const inputNW =
    //   this.dmxData[Math.floor(nX * inputWidth)][Math.ceil(nY * inputHeight)];
    // const inputNE =
    //   this.dmxData[Math.ceil(nX * inputWidth)][Math.ceil(nY * inputHeight)];
    // const inputSE =
    //   this.dmxData[Math.ceil(nX * inputWidth)][Math.floor(nY * inputHeight)];
    // const inputSW =
    //   this.dmxData[Math.floor(nX * inputWidth)][Math.floor(nY * inputHeight)];

    //Assume dmxData is row-first and SW is the origin
    const inputNW =
      this.dmxData[Math.ceil(nY * inputHeight)][Math.floor(nX * inputWidth)];
    const inputNE =
      this.dmxData[Math.ceil(nY * inputHeight)][Math.ceil(nX * inputWidth)];
    const inputSE =
      this.dmxData[Math.floor(nY * inputHeight)][Math.ceil(nX * inputWidth)];
    const inputSW =
      this.dmxData[Math.floor(nY * inputHeight)][Math.floor(nX * inputWidth)];

    const xFraction = (nX * inputWidth) % 1;
    const yFraction = (nY * inputHeight) % 1;
    const r = interpolate(
      inputNW[0],
      inputNE[0],
      inputSE[0],
      inputSW[0],
      xFraction,
      yFraction
    );
    const g = interpolate(
      inputNW[1],
      inputNE[1],
      inputSE[1],
      inputSW[1],
      xFraction,
      yFraction
    );
    const b = interpolate(
      inputNW[2],
      inputNE[2],
      inputSE[2],
      inputSW[2],
      xFraction,
      yFraction
    );

    // const t = (Date.now() % 5000) / 5000;
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

    return { r, g, b };
  }

  async shutdown() {
    if (this.e131Adapter != null) {
      return this.e131Adapter.shutdown();
    } else {
      return Promise.resolve();
    }
  }
}

function interpolate(nw, ne, se, sw, nX, nY) {
  //TODO: is this the best interpolation?
  const w = nw * nY + sw * (1 - nY);
  const e = ne * nY + se * (1 - nY);
  return e * nX + w * (1 - nX);
}

/**
 * break a single dimension array into a 3-d array.
 * 1st of order of the number of rows ()== arr.length / width / 3)
 * 2nd of order width
 * 3rd of order 3
 */
const toRGB2dArray = (arr, width, height) =>
  arr.reduce((rows, key, index) => {
    if (index < width * height * 3) {
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
    }
    return rows;
  }, []);
