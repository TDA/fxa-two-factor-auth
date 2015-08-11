/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-disable */
define([
  'lib/promise',
  'views/base',
  'views/form',
  'stache!templates/settings/two_factor_auth_success',
],
function (p, BaseView, FormView, Template) {
  'use strict';

  var t = BaseView.t;

  var View = FormView.extend({
    template: Template,
    className: 'two-factor-auth-success',

    beforeRender: function () {
      return FormView.prototype.beforeRender.call(this);
    },

    afterVisible: function () {
      return FormView.prototype.afterVisible.call(this);
    }
  });
  return View;
});
