"use strict";

let _assert = require("assert");

let _sammi = require("../src/index.js");

describe("sammi", function() {
  describe("#prepareCommand()", function() {
    it("should place escaped params into the url", function() {
      let command = _sammi.prepareCommand("v1/breakfast/??", ["eggs"]);
      _assert.strictEqual("v1/breakfast/eggs", command);
      command = _sammi.prepareCommand("v1/breakfast/??/price", ["waffles"]);
      _assert.strictEqual("v1/breakfast/waffles/price", command);
      command = _sammi.prepareCommand("v1/breakfast/??/??", ["biscuits", "gravy"]);
      _assert.strictEqual("v1/breakfast/biscuits/gravy", command);
    });
    it("should handle special characters", function() {
      let command = _sammi.prepareCommand("v1/breakfast/??", ["@ggs"]);
      _assert.strictEqual("v1/breakfast/%40ggs", command);
    });
    it("should handle tokens as values", function() {
      let command = _sammi.prepareCommand("v1/breakfast/??", ["??"]);
      _assert.strictEqual("v1/breakfast/%3F%3F", command);
      command = _sammi.prepareCommand("v1/breakfast/eggs??/??", ["??"]);
      _assert.strictEqual("v1/breakfast/eggs%3F%3F/%3F%3F", command);
    });
    it("should place escaped params into url params", function() {
      let command = _sammi.prepareCommand("v1/breakfast/driveThru/menu?priceLimit=??", ["$5"]);
      _assert.strictEqual("v1/breakfast/driveThru/menu?priceLimit=%245", command);
      command = _sammi.prepareCommand("v1/breakfast/??/menu?priceLimit=??&allergy=??", ["Sears", "$50", "shellfish"]);
      _assert.strictEqual("v1/breakfast/Sears/menu?priceLimit=%2450&allergy=shellfish", command);
    });
    it("should strip leading slashes", function() {
      let command = _sammi.prepareCommand("/v1/breakfast", []);
      _assert.strictEqual("v1/breakfast", command);
      command = _sammi.prepareCommand("///v1/breakfast", []);
      _assert.strictEqual("v1/breakfast", command);
    });
  });
});
