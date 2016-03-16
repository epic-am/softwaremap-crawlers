var LOGGER = require("../utils/logger");
var logger = LOGGER.getLogger("Server");
var CONFIG = require("config");

var upstreamService = require("../services/UpstreamService");

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
    self.upstreamService = new upstreamService(env, CONFIG.core, CONFIG.crawler);
    self.jobs = self.upstreamService.getJobs();
  };

  self.startJobs = function () {
    for (var i = 0; i < this.jobs.length; i++) {
      this.jobs[i].start();
    }
  };

  self.start = function (callback) {
    self.startJobs();
  };

  self.close = function () {

  };
};

module.exports = Server;
