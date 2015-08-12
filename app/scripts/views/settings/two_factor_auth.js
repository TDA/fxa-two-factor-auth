/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-disable */
define([
  'cocktail',
  'sjcl',
  'lib/promise',
  'views/base',
  'views/form',
  'stache!templates/settings/two_factor_auth',
  'lib/auth-errors',
  'lib/qrcode',
  'lib/twofabundle',
  'views/mixins/password-mixin',
  'views/mixins/service-mixin',
  'views/mixins/checkbox-mixin'
],
function (Cocktail, sjcl, p, BaseView, FormView, Template, AuthErrors, QRCode,
      TwoFA, PasswordMixin, ServiceMixin, CheckboxMixin) {
  'use strict';

  var t = BaseView.t;

  var View = FormView.extend({
    template: Template,
    className: 'two-factor-auth',

    initialize: function (options) {
      options = options || {};

      this._formPrefill = options.formPrefill;
      this._able = options.able;
    },

    beforeRender: function () {
      var url = this.user.getSignedInAccount().get('sessionToken') ?
                  '/settings/two_factor_auth' : '/signup';
      this.navigate(url, { trigger: true, replace: true });

      var account = this.user.getSignedInAccount();
      if (account.isTwoFATurnedOn()) {
        this.secretKey = account.get('secretKey');
        console.log(this.secretKey);
        this.OTP = TwoFA(this.secretKey, true);
        this.twoFA = true;
      }
      else {
        // we seriously need to unify the libraries for crypto
        var randomWord = sjcl.random.randomWords(1,0);
        this.OTP = TwoFA(randomWord, false);
      }
      return FormView.prototype.beforeRender.call(this);
    },

    afterRender: function () {
      var self = this;
      if(self.secretKey === undefined) {
        // first time setup, so generate a
        // QRCode and store the secret key
        var qr = qrcode(10, 'M');
        qr.addData(self.OTP.totpURL);
        qr.make();
        var imgData = qr.createImgTag(4);
        self.$el.find('#qrcode').html(imgData);
        //console.dir(self);
        self.secretKey = self.OTP.secret;
      } else {
        self.$el.find('.qr-row').hide();
        self.$el.find('#fxa-two-factor-setup-header').hide();
        self.$el.find('#fxa-two-factor-verify-header').show();
        // just verification is required, 2fa was already setup
      }
      console.log("OTP generated is", self.OTP.totp());
    },

    afterVisible: function () {
      return FormView.prototype.afterVisible.call(this);
    },

    events: {
      'blur input.email': 'suggestEmail',
      'keyup input.otp': '_validateOTP'
    },

    context: function () {
    },

    _displayError: function(){
      var self = this;
      self.$el.find('.otp-help').removeClass('hidden');
      self.disableForm();
    },

    _validateOTP: function () {
      var self = this;
      var inputOTP = self.$el.find('.otp').val();
      if (inputOTP.length === 6 && ! isNaN(inputOTP)) {
        self.enableForm();
      }
    },

    _isValidOTP: function(inputOTP){
      if(inputOTP === this.OTP.totp()) {
        return true;
      }
      return false;
    },

    _twofaSuccess: function () {
      var self = this;
      var account = self.getSignedInAccount();
      if (! self.twoFA) {
        // store secret key, and turn on 2fa
        account.turnOnTwoFA(self.secretKey);
        self.user.setAccount(account);
        self.navigate('settings/two_factor_auth_success');
      } else {
        // verification was successful, sign the user in.
        // redirect to settings
        self.navigate('settings');
      }
    },

    beforeDestroy: function () {
    },

    isValidEnd: function () {
      return FormView.prototype.isValidEnd.call(this);
    },

    submit: function () {
      var self = this;
      var inputOTP = self.$el.find('.otp').val();
      return p()
        .then(function () {
          if (! self._isValidOTP(inputOTP)) {
            self._displayError();
            return self.disableForm();
          }
          return self._twofaSuccess();
        });
    }
  });

  Cocktail.mixin(
    View,
    CheckboxMixin,
    PasswordMixin,
    ServiceMixin
  );

  return View;
});
