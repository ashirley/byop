import e131 from "e131";

export class E131Adapter {
  constructor(dataCallback) {
    this.e131Server = new e131.Server();
    const self = this;
    this.e131Server.on("listening", function () {
      console.log(
        "sACN server listening on port %d, universes %j",
        this.port,
        this.universes
      );
    });
    this.e131Server.on("packet", function (packet) {
      //NB. sourcename is padded with null characters which make comparing with something else awkward so trim them (took a long time to spot that!)
      dataCallback(
        [...packet.getSlotsData()],
        packet.getSourceName().replace(/\0*$/, "")
      );
    });
  }

  shutdown() {
    if (this.e131Server != null) {
      var p = new Promise((resolve, reject) => {
        this.e131Server.on("close", () => {
          resolve();
        });
      });
      this.e131Server.close();

      return p;
    } else {
      return Promise.resolve();
    }
  }
}
