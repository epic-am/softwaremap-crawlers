var LOGGER = require("../utils/logger");
var request = require("request");
var CronJob = require("cron").CronJob;
var extractHTMLUpstream = require("../utils/extractHTMLUpstream");

var UpstreamService = function (env, coreInformation, crawlerOptions) {
  this.logger = LOGGER.getLogger("UpstreamService");
  this.coreInformation = coreInformation;
  this.crawlerOptions = crawlerOptions;

  this.extractHTML = new extractHTMLUpstream();
  this.services = [];
  this._initiliazeServices(env);
  this._sendServices();
};

UpstreamService.prototype._getUpstreamUrl = function (serviceName) {
  var data = [];
  var service = this._findService(serviceName);
  if (service !== null) {
    var urlUpstream = service.upstreamUrl;
    request(urlUpstream, function (error, response, body) {
      if (error) {
        return console.log('Error:', error);
      }
      if (response.statusCode !== 200) {
        return console.log('Invalid Status Code Returned:', response.statusCode);
      }
      data = this.extractHTML._extractUpstreamFromBody('', body, data);
      this.updateData(serviceName, data);
      return body;
    }.bind(this));
  }
  return null;
};

UpstreamService.prototype._initiliazeServices = function (env) {
  this.services = require("../../config/services/" + env).services;
  this.coreBaseUrl = `http://${this.coreInformation.ip}:${this.coreInformation.port}${this.coreInformation.routeAPI}`;
};

UpstreamService.prototype.getJobs = function () {
  return this.services.map(service => new CronJob(this.crawlerOptions.cron, () => this._getUpstreamUrl(service.name), null, false, this.crawlerOptions.timezone));
};

UpstreamService.prototype._findService = function (serviceName) {
  return this.services.find(function (service) {
    if (service.name === serviceName) {
      return service;
    }
    return null;
  });
};

UpstreamService.prototype._sendServices = function () {
  this.services.forEach(service => {
    request({
      url: `${this.coreBaseUrl}/services/`,
      method: 'POST',
      json: {
        name: service.name,
        type: service.type,
        metadata: { }
      }
    }, (err, response, body) => {
      if (err) {
        console.log(err);
        return;
      }
      if (response.statusCode === 409) {
        service.id = response.body.serviceId;
      } else {
        service.id = response.body.id;
      }
      this.logger.debug(`service : ${service.name} : ${response.statusCode}`);
      this._sendExecutors(service);
    });
  });
};

UpstreamService.prototype._sendExecutors = function (service) {
  service.machines.forEach(executor => {
    request({
      url: `${this.coreBaseUrl}/services/${service.id}/executors`,
      method: 'POST',
      json: {
        name: executor.name,
        metadata: {
          status: "up"
        }
      }
    }, (err, response, body) => {
      if (err) {
        console.log(err);
        return;
      }
      if (response.statusCode === 409) {
        executor.id = response.body.executorId;
      } else {
        executor.id = response.body.id;
      }
      this.logger.debug(`service : ${service.name} - executor ${executor.name} : ${response.statusCode}`);
    });
  });
};

UpstreamService.prototype._setStatusForAMachineAndService = function (service, ip, status) {
  var machines = this._findService(service).machines;
  var res = false;
  machines.forEach(function (machine) {
    if(machine.ip === ip && machine.status !== status) {
      machine.status = status;
      res = true;
    }
  });
  return res;
};

UpstreamService.prototype._getMachineFromIP = function (service, ip) {
  var machines = this._findService(service).machines;
  machines.forEach(function (machine) {
    if(machine.ip === ip) {
      return machine.name;
    }
  });
  return null;
};

UpstreamService.prototype.updateData = function(serviceName, data) {
  var self = this;
  var service = this._findService(serviceName);
  var machines = service.machines;
  var status = 'out';
  var ip = '';

  machines.forEach((machine) => {
    status = 'out';
    for (var elem in data) {
      ip = data[elem].Name.split(':')[0];
      if (machine.ip === ip) {
        status = data[elem].Status;
      }
    }

    if (this._setStatusForAMachineAndService(serviceName, machine.ip, status)) {
      this.sendMachineStatus(service.id, machine.id, status);
    }
  });
};

UpstreamService.prototype.sendMachineStatus = function(serviceId, machineId, status) {
  request({
    url: `${this.coreBaseUrl}/services/${serviceId}/executors/${machineId}`,
    method: 'PUT',
    json: {
      status: status
    }
  }, function (err, response, body) {
    if (err) {
      console.log(err);
    } else {
      console.log(response.statusCode);
    }
  });
};

module.exports = UpstreamService;
