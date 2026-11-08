/**
 * Disabled dead code placeholder.
 */
(function () {
  'use strict';

  var disabled = 'disabled dead code';

  window.vibeConfig = {
    disabled: true,
    initSupabase: async function () {
      return false;
    },
    getCurrentUser: async function () {
      return null;
    },
    signUpUser: async function () {
      return { data: null, error: disabled };
    },
    signInUser: async function () {
      return { data: null, error: disabled };
    },
    signOutUser: async function () {
      return false;
    },
    getSupabaseClient: function () {
      return null;
    }
  };
})();
