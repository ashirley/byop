// Get a configured handlebars engine for express.

import { engine } from "express-handlebars";
import Handlebars from "handlebars";

Handlebars.registerHelper("formatDate", (timestamp) =>
  new Date(timestamp).toLocaleString()
);

Handlebars.registerHelper("default", (a, b) => {
  if (!Handlebars.Utils.isEmpty(a)) {
    return a;
  } else {
    return b;
  }
});

export { engine };
