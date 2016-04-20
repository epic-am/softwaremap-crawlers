var LOGGER = require("../utils/logger");
var request = require("request");
var CronJob = require("cron").CronJob;
var jenkinsapi = require('jenkins-api');

var IntegrationService = function (env, coreInformation, crawlerOptions, jenkinsOptions) {
  this.logger = LOGGER.getLogger("IntegrationService");
  this.coreInformation = coreInformation;
  this.crawlerOptions = crawlerOptions;

  this.service = {};
  this._initiliazeService(env);
  this._sendService();
  this.jenkins = jenkinsapi.init(`http://${jenkinsOptions.username}:${jenkinsOptions.APIKey}@${jenkinsOptions.host}`);
};

IntegrationService.prototype._initiliazeService = function (env) {
  this.service = require("../../config/services/" + env).service;
  this.coreBaseUrl = `http://${this.coreInformation.ip}:${this.coreInformation.port}${this.coreInformation.routeAPI}`;
};

IntegrationService.prototype.getJobs = function () {
  return new CronJob(this.crawlerOptions.cron, () => this._getJobStatus(), null, false, this.crawlerOptions.timezone);
};

IntegrationService.prototype._getJobStatus = function () {
  var status = '';
  this.service.jobs.forEach((job) => {
    this.jenkins.last_build_info(job.name, (err, data) => {
      if (err) {
        this.logger.error("Job ", job.name, " error");
      }
      if (data.result === 'SUCCESS') {
        status = 'success';
      } else if (data.result === 'FAILURE') {
        status = 'failure';
      } else if (data.result === 'UNSTABLE') {
        status = 'unstable';
      }
      if (status !== '') {
        this.updateData(job.name, status);
      }
    });
  });
};

IntegrationService.prototype._sendService = function () {
  request({
    url: `${this.coreBaseUrl}/services/`,
    method: 'POST',
    json: {
      name: this.service.name,
      type: this.service.type,
      metadata: { }
    }
  }, (err, response, body) => {
    if (err) {
      console.log(err);
      return;
    }
    if (response.statusCode === 409) {
      this.service.id = response.body.serviceId;
    } else {
      this.service.id = response.body.id;
    }
    this.logger.debug(`service : ${this.service.name} : ${response.statusCode}`);
    this._sendExecutors();
  });
};

IntegrationService.prototype._sendExecutors = function () {
  this.service.jobs.forEach(executor => {
    request({
      url: `${this.coreBaseUrl}/services/${this.service.id}/executors`,
      method: 'POST',
      json: {
        name: executor.name,
        metadata: {
          status: "ok"
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
      this.logger.debug(`service : ${this.service.name} - executor ${executor.name} : ${response.statusCode} - ${executor.id}`);
    });
  });
};

IntegrationService.prototype._setStatusForAExecutorAndService = function (jobName, status) {
  var jobs = this.service.jobs;
  var res = false;
  jobs.forEach(function (job) {
    if(job.name === jobName && job.status !== status) {
      job.status = status;
      res = true;
    }
  });
  return res;
};

IntegrationService.prototype.updateData = function(jobName, jobStatus) {
  var self = this;
  var jobs = this.service.jobs;
  var status = 'ko';

  jobs.forEach((job) => {
    if (this._setStatusForAExecutorAndService(jobName, jobStatus)) {
      this.sendExecutorStatus(this._findExecutorIdByJobName(jobName), jobStatus);
    }
  });
};

IntegrationService.prototype.sendExecutorStatus = function(executorId, status) {
  request({
    url: `${this.coreBaseUrl}/services/${this.service.id}/executors/${executorId}`,
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

IntegrationService.prototype._findExecutorIdByJobName = function (jobName) {
  var jobId = null;
  this.service.jobs.forEach((job) => {
    if (job.name === jobName) {
      jobId = job.id;
    }
  });
  return jobId;
};

module.exports = IntegrationService;
