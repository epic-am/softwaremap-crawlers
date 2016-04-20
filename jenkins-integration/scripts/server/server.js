var LOGGER = require("../utils/logger");
var logger = LOGGER.getLogger("Server");
var CONFIG = require("config");

var integrationService = require("../services/IntegrationService");

var Server = function (options) {
  var self = this;

  self.terminator = function (sig) {
    if (typeof sig === "string") {
      logger.info("%s: Received %s - terminating sample app ...", Date(Date.now()), sig);
      process.exit(1);
    }
    logger.info("%s: Node server stopped", Date(Date.now()));
  };

  self.setupTerminationHandlers = function () {
    process.on("exit", function() { self.terminator(); });
    ["SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGTRAP", "SIGABRT",
        "SIGBUS", "SIGFPE", "SIGUSR1", "SIGSEGV", "SIGUSR2", "SIGTERM"
    ].forEach(function(element, index, array) {
      process.on(element, function() { self.terminator(element); });
    });
  };

  self.initialize = function () {
    var env = "preprod";
    self.setupTerminationHandlers();
    self.integrationService = new integrationService(env, CONFIG.core, CONFIG.crawler, CONFIG.jenkins);
    self.jobs = self.integrationService.getJobs();
  };

  self.startJobs = function () {
    self.jobs.start();
  };

  self.start = function (callback) {
    self.startJobs();
  };

  self.close = function () {

  };
};

module.exports = Server;
