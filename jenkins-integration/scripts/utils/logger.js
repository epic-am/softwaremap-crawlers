var log4js = require("log4js");

log4js.configure(process.env.NODE_CONFIG_DIR + "/log4js.json");

module.exports = log4js;
