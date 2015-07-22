"use strict";

let _request = require("request");
let _tean = require("tean");

module.exports = {
  infoLogFunction: null,
  errorLogFunction: null,
  services: {},

  register(name, url) {
    if (!this.services.hasOwnProperty(name)) {
      this.services[name] = {};
    }
    this.services[name] = url;

    return this;
  },

  call(serviceName, command, options, callback) {
    let _this = this;
    options = options || {};
    options.commandParams = options.commandParams || [];
    options.method = options.method || "GET";
    options.bodyParams = options.bodyParams || {};
    options.validResponseCodes = options.validResponseCodes ? options.validResponseCodes.concat([200]) : [200];
    options.validationMaps = options.validationMaps || null;
    options.contentType = options.contentType || "json";
    options.logTag = options.logTag || undefined;

    // pull off first slash if included
    if (command[0] === "/") {
      command = command.substr(1);
    }

    command = command.split("/").map(function(piece) {
      if (piece === "??") {
        return piece.replace("??", encodeURIComponent(options.commandParams.shift()));
      }
      return piece;
    }).join("/");

    let url = `${this.services[serviceName]}/${command}`;
    let requestData = {uri: url, method: options.method.toUpperCase()};
    if (options.contentType === "json") {
      requestData.json = options.bodyParams;
    }
    else if (options.contentType === "formUrlEncoded") {
      requestData.form = options.bodyParams;
    }

    _request(requestData, function(err, res, body) {
      if (_this.infoLogFunction) {
        _this.infoLogFunction("--------------");
        _this.infoLogFunction("url: " + url);
        _this.infoLogFunction("err: " + err);
        _this.infoLogFunction("res.statusCude: " + res.statusCode);
        _this.infoLogFunction("body: " + body);
        _this.infoLogFunction("--------------");
      }
      let statusCode = -1;
      if (res) {
        statusCode = res.statusCode;
      }

      if (err) {
        let errMsg = `Error contacting ${serviceName} (-${options.method} ${url}) with params (${JSON.stringify(options.bodyParams)}): ${JSON.stringify(err)}`;
        if (_this.errorLogFunction) {
          _this.errorLogFunction(errMsg, options.logTag);
        }
        callback(errMsg, statusCode, body || {});
      }
      else if (options.validResponseCodes.indexOf(statusCode) === -1) {
        let errMsg = `${serviceName} responded to -${options.method} ${url} with params (${JSON.stringify(options.bodyParams)}) with a ${statusCode} error: ${JSON.stringify(body)}`;
        if (_this.errorLogFunction) {
          _this.errorLogFunction(errMsg, options.logTag);
        }
        callback(errMsg, statusCode, body || {});
      }
      else {
        if (options.validationMaps && options.validationMaps.hasOwnProperty(statusCode)) {
          _tean.object(options.validationMaps[statusCode], body, function(validationPassed, safeData) {
            if (!validationPassed) {
              let errMsg = `${serviceName} (-${options.method} ${url}, ${JSON.stringify(options.bodyParams)}) returned a response body that did not pass validation: ${JSON.stringify(body)}`;
              if (_this.errorLogFunction) {
                _this.errorLogFunction(errMsg, options.logTag);
              }
              callback(errMsg, statusCode, {});
            }
            else {
              callback(null, statusCode, safeData);
            }
          });
        }
        else {
          // try to parse json if body is a string
          let parsedData = null;
          if (typeof body === "string") {
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

          callback(null, statusCode, parsedData || {});
        }
      }
    });
  },
};
