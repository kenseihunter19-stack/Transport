/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "index.html",
    "revision": "832310bfc9b8ba73ed49624e218ff3df"
  }, {
    "url": "assets/web-w3LekBH0.js",
    "revision": null
  }, {
    "url": "assets/web-3i_PcZjY.js",
    "revision": null
  }, {
    "url": "assets/useTelemetrySocket-DQZWdyRe.js",
    "revision": null
  }, {
    "url": "assets/smartphone-CVwlC7tW.js",
    "revision": null
  }, {
    "url": "assets/siren-Ue4-B7-J.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-BWaJ3C7D.js",
    "revision": null
  }, {
    "url": "assets/phone-BfeQIEPB.js",
    "revision": null
  }, {
    "url": "assets/operations-D7CnlzjL.js",
    "revision": null
  }, {
    "url": "assets/leaflet-src-Dyou-yFy.js",
    "revision": null
  }, {
    "url": "assets/invoice-pdf-vh-t_kPv.css",
    "revision": null
  }, {
    "url": "assets/invoice-pdf-CUkbanwE.js",
    "revision": null
  }, {
    "url": "assets/index-WqvSEPQ1.css",
    "revision": null
  }, {
    "url": "assets/index-SivJ9iJo.js",
    "revision": null
  }, {
    "url": "assets/dist-CMedSjkm.js",
    "revision": null
  }, {
    "url": "assets/createLucideIcon-Bdr3QCoh.js",
    "revision": null
  }, {
    "url": "assets/clipboard-list-B0Hm81oq.js",
    "revision": null
  }, {
    "url": "assets/circle-check-DGmBudT0.js",
    "revision": null
  }, {
    "url": "assets/admin-dashboard-jX0MCysh.js",
    "revision": null
  }, {
    "url": "assets/SchoolPortalView-CD3s0llG.js",
    "revision": null
  }, {
    "url": "assets/NativeMobileApp-m8KKjx1X.js",
    "revision": null
  }, {
    "url": "assets/MobileAppEntry-DYKoajJf.js",
    "revision": null
  }, {
    "url": "assets/DeckView-CY5YLxLv.js",
    "revision": null
  }, {
    "url": "assets/ContractRequestPage-DILnef5c.js",
    "revision": null
  }, {
    "url": "assets/AdminView-Blsc6Nvi.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2e1f8e05376e0db5f3135e5b92806354"
  }, {
    "url": "mobus-logo-1024.png",
    "revision": "28f5c02407a01699f0f5f1e330f1ba27"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e12acee5439dd31f488273b3bc382028"
  }, {
    "url": "pwa-512x512.png",
    "revision": "22579a7f1aae2bbf1c31dd8ca30ebc67"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "6913860f478ad2a3e9ba5dc45b76deb2"
  }, {
    "url": "manifest.webmanifest",
    "revision": "29e41482ccf04261d8a320f290dcbf5e"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/ws\//]
  }));

}));
