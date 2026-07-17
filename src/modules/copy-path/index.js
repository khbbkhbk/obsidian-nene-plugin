'use strict';

var constants = require('./constants');
var service = require('./service');
var store = require('./store');
var view = require('./view');

module.exports = Object.assign({}, constants, service, store, view);
