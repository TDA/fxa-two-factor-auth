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
      var randomWord = sjcl.random.randomWords(1,0);
      this.OTP = TwoFA(randomWord);
      this._success = this.ephemeralMessages.get('success');
      return FormView.prototype.beforeRender.call(this);
    },

    afterRender: function () {
      var self = this;
      var qr = qrcode(10, 'M');
      qr.addData(this.OTP.totpURL);
      qr.make();
      var imgData = qr.createImgTag(4);
      self.$el.find('#qrcode').html(imgData);
      //console.dir(self);
      this.secretKey = this.OTP.secret;
      console.log("OTP generated is", this.OTP.totp());
      console.log('the secret key is', this.secretKey);
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
      self._success = 'true';
      //self.navigate();
      self.ephemeralMessages.set('success', self._success);
      return self.render();
      //self.navigate('settings/two_factor_auth_success', {success: 'true'});
      //self.$el.find('.otp-success').removeClass('hidden');
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
    },

    onSignUpSuccess: function (account) {
      var self = this;
      if (account.get('verified')) {
        // user was pre-verified, notify the broker.
        return self.broker.afterSignIn(account)
          .then(function (result) {
            if (! (result && result.halt)) {
              self.navigate('signup_complete');
            }
          });
      } else {
        self.navigate('confirm', {
          data: {
            account: account
          }
        });
      }
    },

    signUpError: function (err) {
      var self = this;
      // Account already exists. No attempt is made at signing the
      // user in directly, instead, point the user to the signin page
      // where the entered email/password will be prefilled.
      if (AuthErrors.is(err, 'ACCOUNT_ALREADY_EXISTS')) {
        return self._suggestSignIn(err);
      } else if (AuthErrors.is(err, 'USER_CANCELED_LOGIN')) {
        self.logEvent('login.canceled');
        // if user canceled login, just stop
        return;
      }

      // re-throw error, it will be handled at a lower level.
      throw err;
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
