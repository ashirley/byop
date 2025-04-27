import sqlite3 from "sqlite3";

export class SqliteDao {
  async init(filename) {
    if (this.initialised) {
      throw new Error("Cannot call init twice");
    }
    this.initialised = true;

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(filename);

      this.db.serialize(() => {
        // initialise the schema
        this.db.run(
          "CREATE TABLE IF NOT EXISTS device (id NUMERIC, x NUMERIC, y NUMERIC, host TEXT, pixels TEXT)",
          //TODO: error handling
          function (err) {
            resolve();
          }
        );
      });
    });
  }

  async loadRegisteredDeviceData(cb) {
    if (!this.initialised) {
      throw new Error("Must call init before using this Dao");
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        //TODO: error handling

        this.db.each(
          "SELECT * from device",
          (err, row) => {
            console.debug("Loading device " + row.id + " from database");
            //TODO: should this JSON.parse be here or in Device.parsePixels?
            cb(row.id, row.x, row.y, row.host, JSON.parse(row.pixels));
          },
          (err, count) => {
            //TODO: nextId
            const nextId = 0;

            console.log("Loaded " + count + " devices from database");

            resolve(nextId);
          }
        );
      });
    });
  }

  saveDeviceData(device) {
    if (this.saveDeviceStmt == null) {
      this.saveDeviceStmt = this.db.prepare(
        "INSERT INTO device VALUES (?, ?, ?, ?, ?)"
      );
    }
    this.saveDeviceStmt.run(
      device.id,
      device.x,
      device.y,
      device.host,
      JSON.stringify(device.pixels)
    );
    // TODO: error handling
  }

  async shutdown() {
    return new Promise((resolve, reject) => {
      if (this.saveDeviceStmt != null) {
        this.saveDeviceStmt.finalize(() => {
          this.db.close((closeResult) => {
            if (closeResult === null) {
              resolve();
            } else {
              reject(closeResult);
            }
          });
        });
      } else {
        this.db.close((closeResult) => {
          if (closeResult === null) {
            resolve();
          } else {
            reject(closeResult);
          }
        });
      }
    });
  }
}
