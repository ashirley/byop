"use strict";
import { LitElement, html, css } from "lit";

import { ThreeRender } from "./ThreeRender.js";

export class AppRoot extends LitElement {
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
      <h1>BYOP</h1>
      <three-render
        perpPoints=${JSON.stringify(this._perpPoints)}
        backPlatePerimeter=${JSON.stringify(this._backPlatePerimeter)}
      ></three-render>
              
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
