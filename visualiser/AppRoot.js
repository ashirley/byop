"use strict";
import { LitElement, html, css } from "lit";

import { ThreeRender } from "./ThreeRender.js";
import { pixels as demoDataPixels } from "./DemoData.js";

export class AppRoot extends LitElement {
  static properties = {
    _devices: { state: true },
    _demoMode: { state: true },
  };

  constructor() {
    super();

    this._devices = null;
    this._demoMode = false;
    const url = "http://localhost:3000/visualiser/api/pixelDataFeed";
    const webSocket = new WebSocket(url);

    //TODO: reconnect and show status icon?
    webSocket.onmessage = (event) => {
      this._devices = JSON.parse(event.data);
    };
    webSocket.onerror = (event) => {
      this._demoMode = true;
      demoDataPixels((devices) => {
        // take a copy to force lit to update. TODO: is there a better way?
        this._devices = { ...devices };
      });
    };
  }

  static styles = css`
    .footer {
      flex: 0;
      display: flex;
      flex-direction: row;
      padding: 0.25em;
    }

    .about {
      padding-left: 0.5em;
      align-self: center;
    }

    .about img {
      height: 1em;
      vertical-align: text-top;
      padding: 0px 3px;
    }

    .material-symbols-outlined {
      font-size: unset;
    }
  `;

  render() {
    return html`
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
        rel="stylesheet"
      ></link>
      <h1>BYOP${this._demoMode ? " - demo" : ""}</h1>
      ${
        this._devices == null
          ? html`<p>Loading...</p>`
          : html`<three-render .devices=${this._devices}></three-render>`
      }

      <div class="footer">
        <div class="about">
          &copy;Andrew Shirley<a
            href="https://github.com/ashirley/byop"
            ><img src="github-mark.png"
          /></a>
        </div>
      </div>
    `;
  }
}

customElements.define("app-root", AppRoot);
