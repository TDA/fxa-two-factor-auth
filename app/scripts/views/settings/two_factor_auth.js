/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-disable */
define([
  'cocktail',
  'underscore',
  'lib/promise',
  'views/base',
  'views/form',
  'stache!templates/two_factor_auth',
  'lib/auth-errors',
  'lib/url',
  'views/mixins/password-mixin',
  'views/mixins/service-mixin',
  'views/mixins/checkbox-mixin',
  'views/mixins/resume-token-mixin'
],
function (Cocktail, _, p, BaseView, FormView, Template, AuthErrors,
      Url, PasswordMixin, ServiceMixin, CheckboxMixin, ResumeTokenMixin) {
  'use strict';

  var t = BaseView.t;
  // have to escape amdcheck, will rm later
  var _ = _;
  var url = Url;

  var View = FormView.extend({
    template: Template,
    className: 'two-factor-auth',

    initialize: function (options) {
      options = options || {};

      this._formPrefill = options.formPrefill;
      this._coppa = options.coppa;
      this._able = options.able;
    },

    beforeRender: function () {
      return FormView.prototype.beforeRender.call(this);
    },

    afterRender: function () {
      var self = this;

      self.logScreenEvent('email-optin.visible.' +
          String(self._isEmailOptInEnabled()));
    },

    afterVisible: function () {
      return FormView.prototype.afterVisible.call(this);
    },

    events: {
      'blur input.email': 'suggestEmail'
    },

    context: function () {
    },

    beforeDestroy: function () {
    },

    isValidEnd: function () {
      if (this._isEmailSameAsBouncedEmail()) {
        return false;
      }

      if (this._isEmailFirefoxDomain()) {
        return false;
      }

      if (! this._coppa.isValid()) {
        return false;
      }

      return FormView.prototype.isValidEnd.call(this);
    },

    showValidationErrorsEnd: function () {
      if (this._isEmailSameAsBouncedEmail()) {
        this.showValidationError('input[type=email]',
                AuthErrors.toError('DIFFERENT_EMAIL_REQUIRED'));
      } else if (this._isEmailFirefoxDomain()) {
        this.showValidationError('input[type=email]',
                AuthErrors.toError('DIFFERENT_EMAIL_REQUIRED_FIREFOX_DOMAIN'));
      } else {
        this._coppa.showValidationErrors();
      }
    },

    submit: function () {
      var self = this;
      return p()
        .then(function () {
          if (! self._isUserOldEnough()) {
            return self._cannotCreateAccount();
          }

          return self._initAccount();
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
    },

    _suggestSignIn: function (err) {
      err.forceMessage = t('Account already exists. <a href="/signin">Sign in</a>');
      return this.displayErrorUnsafe(err);
    },

    _isEmailOptInEnabled: function () {
      return !! this._able.choose('communicationPrefsVisible', {
        lang: this.navigator.language
      });
    }
  });

  Cocktail.mixin(
    View,
    CheckboxMixin,
    PasswordMixin,
    ResumeTokenMixin,
    ServiceMixin
  );

  return View;
});
