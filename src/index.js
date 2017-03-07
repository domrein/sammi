"use strict";

const _request = require("request");
const _tean = require("tean");

module.exports = {
  infoLogFunction: null,
  errorLogFunction: null,
  services: {},
  defaults: {
    commandParams: [],
    method: "GET",
    bodyParams: {},
    validResponseCodes: [200],
    validationMaps: null,
    contentType: "json",
    logTag: undefined,
    camelize: false,
    "User-Agent": "request",
    timeout: 3000,
  },

  register(name, host, options) {
    if (typeof host === "string") {
      options = options || {};
      options.host = host;
    }
    else {
      options = host;
    }

    if (!this.services.hasOwnProperty(name)) {
      this.services[name] = {};
    }
    this.services[name].host = options.host || "127.0.0.1";
    this.services[name].transport = options.transport || "http";
    if (options.port) {
      this.services[name].port = options.port;
    }
    else if (options.transport === "https") {
      this.services[name].port = 443;
    }
    else {
      this.services[name].port = 80;
    }
    this.services[name].route = options.route ? `/${options.route}` : "";

    return this;
  },

  call(serviceName, command, options, errCallback, callback) {
    options = options || {};
    options.commandParams = options.commandParams || this.defaults.commandParams;
    options.method = options.method || this.defaults.method;
    options.bodyParams = options.bodyParams || this.defaults.bodyParams;
    options.validResponseCodes = options.validResponseCodes ? options.validResponseCodes.concat(this.defaults.validResponseCodes) : this.defaults.validResponseCodes;
    options.validationMaps = options.validationMaps || this.defaults.validationMaps;
    options.contentType = options.contentType || this.defaults.contentType;
    options.logTag = options.logTag || this.defaults.logTag;
    options.host = options.host || this.services[serviceName].host;
    options.port = options.port || this.services[serviceName].port;
    options.route = options.route || this.services[serviceName].route;
    options.transport = options.transport || this.services[serviceName].transport;
    options.headers = options.headers || {};
    options.timeout = options.timeout || this.defaults.timeout;
    Object.assign(options.headers, {
      Host: options.host,
      "User-Agent": options["User-Agent"] || this.defaults["User-Agent"],
    });

    if (!options.hasOwnProperty("camelize")) {
      options.camelize = this.defaults.camelize;
    }

    command = this.prepareCommand(command, options.commandParams);

    const url = `${options.transport}://${options.host}:${options.port}${options.route}/${command}`;
    const requestData = {uri: url, method: options.method.toUpperCase()};
    if (options.contentType === "json") {
      requestData.json = options.bodyParams;
    }
    else if (options.contentType === "formUrlEncoded") {
      requestData.form = options.bodyParams;
    }
    requestData.headers = options.headers;
    requestData.timeout = options.timeout;

    _request(requestData, (err, res, body) => {
      if (this.infoLogFunction) {
        this.infoLogFunction("--------------");
        this.infoLogFunction(`url: ${url}`);
        this.infoLogFunction(`err: ${err}`);
        if (res) {
          this.infoLogFunction(`res.statusCude: ${res.statusCode}`);
        }
        this.infoLogFunction(`body: ${JSON.stringify(body)}`);
        this.infoLogFunction("--------------");
      }
      let statusCode = -1;
      if (res) {
        statusCode = res.statusCode;
      }

      if (err) {
        const errMsg = `Error contacting ${serviceName} (-${options.method} ${url}) with params (${JSON.stringify(options.bodyParams)}): ${JSON.stringify(err)}`;
        if (this.errorLogFunction) {
          this.errorLogFunction(errMsg, options.logTag);
        }
        errCallback(errMsg, statusCode, body || {});
      }
      else if (options.validResponseCodes.indexOf(statusCode) === -1) {
        const errMsg = `${serviceName} responded to -${options.method} ${url} with params (${JSON.stringify(options.bodyParams)}) with a ${statusCode} error: ${JSON.stringify(body)}`;
        if (this.errorLogFunction) {
          this.errorLogFunction(errMsg, options.logTag);
        }
        errCallback(errMsg, statusCode, body || {});
      }
      else {
        const camelizeIt = typeof body === "object" || typeof body === "string" ? true : false;
        if (body && options.camelize && !camelizeIt) {
          if (this.infoLogFunction) {
            this.infoLogFunction(`Body should be json to camelize: ${JSON.stringify(body)}`);
          }
        }
        else if (body && options.camelize && camelizeIt) {
          if (typeof body !== "string") {
            try {
              body = JSON.stringify(body);
            }
            catch (err) {
              errCallback(`Unable to stringify body: ${err}`);
            }
          }
          body = body.replace(/"\w+"(?=:)/g, str => {
            str = str.replace(/_+/g, " ");
            return str.replace(/[A-Z]|\b\w|\s+/g, (match, index) => {
              if (/\s+/.test(match)) {
                return "";
              }
              return index === 1 ? match.toLowerCase() : match.toUpperCase();
            });
          });
          body = JSON.parse(body);
        }
        // turn body to json
        else if (body && typeof body === "string") {
          try {
            body = JSON.parse(body);
          }
          catch (err) {
          }
        }


        if (options.validationMaps && options.validationMaps.hasOwnProperty(statusCode)) {
          _tean.object(options.validationMaps[statusCode], body, (validationPassed, safeData) => {
            if (!validationPassed) {
              const errMsg = `${serviceName} (-${options.method} ${url}, ${JSON.stringify(options.bodyParams)}) returned a response body that did not pass validation: ${JSON.stringify(body)}`;
              if (this.errorLogFunction) {
                this.errorLogFunction(errMsg, options.logTag);
              }
              errCallback(errMsg, statusCode, {});
            }
            else {
              if (callback) {
                callback(statusCode, safeData);
              }
              else {
                errCallback(null, statusCode, safeData);
              }
            }
          });
        }
        else {
          // try to parse json if body is a string
          let parsedData = null;
          if (options.contentType === "json" && typeof body === "string") {
            try {
              parsedData = JSON.parse(body);
            }
            catch (err) {
              parsedData = body;
            }
          }
          else {
            parsedData = body;
          }

          if (callback) {
            callback(statusCode, parsedData || {});
          }
          else {
            errCallback(null, statusCode, parsedData || {});
          }
        }
      }
    });
  },

  prepareCommand(command, params) {
    params = params.concat([]);
    // pull off first slash if included
    while (command[0] === "/") {
      command = command.substr(1);
    }
    const pieces = command.split("/");
    command = pieces.map((piece, index) => {
      if (index === pieces.length - 1) {
        while (piece.indexOf("??") !== -1) {
          piece = piece.replace("??", encodeURIComponent(params.shift()));
        }
        return piece;
      }
      else {
        if (piece === "??") {
          return piece.replace("??", encodeURIComponent(params.shift()));
        }
        return encodeURIComponent(piece);
      }
    }).join("/");

    return command;
  },
};
