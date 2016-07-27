process.env.NODE_CONFIG_DIR = __dirname + '/config';

var Server = require('./scripts/server/server.js');

var server = new Server();
server.initialize();
server.start();
