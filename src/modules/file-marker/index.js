'use strict';

var constants = require('./constants');
var store = require('./store');
var modals = require('./modals');
var view = require('./view');

module.exports = Object.assign({}, constants, store, modals, view);
