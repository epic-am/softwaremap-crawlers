var LOGGER = require("../utils/logger");
var request = require("request");
var CronJob = require("cron").CronJob;
const assert = require('assert');

var fetchVersionService = function (env, proxy, coreUrl, crawlerOptions, fieldsOptions) {
  this.logger = LOGGER.getLogger("FetchVersionService");
  this.logger.debug(`CoreUrl is ${coreUrl}`);
  this.coreUrl = coreUrl;
  this.crawlerOptions = crawlerOptions;
  this.fieldsOptions = fieldsOptions;
  this.proxy = proxy;

  this.services = [];
  this._initiliazeServices(env);
  this._sendServices();
};

fetchVersionService.prototype._getVersionUrl = function (service) {
  var data = [];
  if (service !== null) {
    service.machines.forEach((machine) => {
      var versionUrl = `http://${machine.host}${service.versionLocation}`;
      request({
        url: versionUrl,
        proxy: this.proxy,
        method: "GET"
      }, function (error, response, body) {
        if (error) {
          this.logger.debug(`error on get`);
          return console.log('Error:', error);
        }
        if (response.statusCode !== 200) {
          this.logger.debug(`[_getVersionUrl] return code is not 200`);
          return console.log('Invalid Status Code Returned:', response.statusCode);
        }
          this.logger.debug(`return of get is ok`);
        this.updateData(service, machine, body);
        return body;
      }.bind(this));
    });
  }
  return null;
};

fetchVersionService.prototype._initiliazeServices = function (env) {
  this.logger.debug(`Env is : ${env}`);
  this.services = require("../../config/services/" + env).services;
  this.coreBaseUrl = `${this.coreUrl}`;
};

fetchVersionService.prototype.getJobs = function () {
  return this.services.map(service => new CronJob(this.crawlerOptions.cron, () => this._getVersionUrl(service), null, false, this.crawlerOptions.timezone));
};

fetchVersionService.prototype._sendServices = function () {
  this.services.forEach(service => {
    request({
      url: `${this.coreBaseUrl}/services/`,
      method: 'POST',
      json: {
        name: service.name,
        type: service.type,
        env: service.env
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

fetchVersionService.prototype._sendExecutors = function (service) {
  service.machines.forEach(executor => {
    request({
      url: `${this.coreBaseUrl}/services/${service.id}/executors`,
      method: 'POST',
      json: {
        name: executor.name,
        metadata: {
          version: {}
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

fetchVersionService.prototype._setVersionForAMachineAndService = function (service, name, version) {
  var machines = service.machines;
  var res = false;
  machines.forEach(function (machine) {
    if(machine.name === name) {
      if(machine.version === undefined || !assert.deepEqual(machine.version, version)) {
        machine.version = version;
        res = true;
      }
    }
  });
  return res;
};

fetchVersionService.prototype.updateData = function(service, machine, data) {
  this.logger.debug(`updateData`);
  var self = this;

  var dataJson;
  try
  {
     dataJson = JSON.parse(data);
  }
  catch(e)
  {
      // Handle json & jsonp responses
      var startPos = data.indexOf('({');
      if (startPos === -1) {
        startPos = data.indexOf('[{');
      }
      var endPos = data.indexOf('})');
      if (endPos === -1) {
        endPos = data.indexOf('}]');
      }
      var jsonString = data.substring(startPos+1, endPos+1);
      dataJson = JSON.parse(jsonString);
  }

  var version = {};

  if (service.fieldsType !== undefined && this.fieldsOptions[service.fieldsType] !== undefined) {
    var fields = this.fieldsOptions[service.fieldsType];
    fLen = fields.length;
    for (i = 0; i < fLen; i++) {
      version[fields[i]] = dataJson[fields[i]];
    }
  }
  
  this.logger.debug(`version : ${version.version}`);

  if (this._setVersionForAMachineAndService(service, machine.name, version)) {
    this.sendMachineVersion(service.id, machine.id, version);
  }
};

fetchVersionService.prototype.sendMachineVersion = function(serviceId, machineId, version) {
  request({
    url: `${this.coreBaseUrl}/services/${serviceId}/executors/${machineId}`,
    method: 'PUT',
    json: {
      version: version
    }
  }, function (err, response, body) {
    if (err) {
      console.log(err);
    } else {
      console.log(response.statusCode);
    }
  });
};

module.exports = fetchVersionService;
