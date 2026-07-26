'use strict';

var constants = require('./constants');
var runtime = require('./runtime');
var store = require('./store');
var view = require('./view');
var organizerRuntime = require('./organizer-runtime');
var organizerView = require('./organizer-view');
var snippetsConstants = require('./snippets-constants');
var snippetsStore = require('./snippets-store');
var snippetsRuntime = require('./snippets-runtime');

module.exports = Object.assign({}, constants, runtime, store, view, organizerRuntime, organizerView, snippetsConstants, snippetsStore, snippetsRuntime);
