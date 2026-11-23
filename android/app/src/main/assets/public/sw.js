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
    "revision": "db2bdf7ec3a3d1280967725c4cdb6b9f"
  }, {
    "url": "assets/wifi-BzLOVOsC.js",
    "revision": null
  }, {
    "url": "assets/web-w3LekBH0.js",
    "revision": null
  }, {
    "url": "assets/web-3i_PcZjY.js",
    "revision": null
  }, {
    "url": "assets/useTelemetrySocket-D5bNwQgK.js",
    "revision": null
  }, {
    "url": "assets/siren-DdisCRIE.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-BWaJ3C7D.js",
    "revision": null
  }, {
    "url": "assets/refresh-cw-Hwsijae9.js",
    "revision": null
  }, {
    "url": "assets/plus-Bime9_k7.js",
    "revision": null
  }, {
    "url": "assets/phone-BfeQIEPB.js",
    "revision": null
  }, {
    "url": "assets/leaflet-src-Dyou-yFy.js",
    "revision": null
  }, {
    "url": "assets/index-hmnBcQdN.js",
    "revision": null
  }, {
    "url": "assets/index-BMHRqL8o.css",
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
    "url": "assets/check-DU0JO3A9.js",
    "revision": null
  }, {
    "url": "assets/SchoolPortalView-c0cV_xzy.js",
    "revision": null
  }, {
    "url": "assets/NativeMobileApp-YSzav3U8.js",
    "revision": null
  }, {
    "url": "assets/MockupView-BfCqjsHF.js",
    "revision": null
  }, {
    "url": "assets/MobileAppEntry-ByPM0fo2.js",
    "revision": null
  }, {
    "url": "assets/LuandaMap-vh-t_kPv.css",
    "revision": null
  }, {
    "url": "assets/LuandaMap-CF8_MuBq.js",
    "revision": null
  }, {
    "url": "assets/DeckView-BYslM_Rq.js",
    "revision": null
  }, {
    "url": "assets/ContractRequestPage-Bd3AjgsF.js",
    "revision": null
  }, {
    "url": "assets/AuthGatePanel-8t_vpjmw.js",
    "revision": null
  }, {
    "url": "assets/AdminView-CvvhuwP_.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "de2f0b0e2b7a92fd49dff2352bc7307d"
  }, {
    "url": "pwa-192x192.png",
    "revision": "18bc41a5958e1e55c4224e24fe9dcf1a"
  }, {
    "url": "pwa-512x512.png",
    "revision": "515130a9110f97091a972f20df17dc6c"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "ec759a0709718dc5c37f1fa2f4406fac"
  }, {
    "url": "assets/aistudio/20261117_030824_57b8de0b.jpg",
    "revision": "8b3691cc1dd889d79a58975eed8224ec"
  }, {
    "url": "manifest.webmanifest",
    "revision": "7a7238a68ea70ad54cb1599123fd57a5"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/ws\//]
  }));

}));
