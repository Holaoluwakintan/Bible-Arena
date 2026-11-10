/* Shared reading, step 1: screen stub. Not loaded by any page: index.html has no script tag for it,
   and nothing sets window.BA_FLAGS, so the live site is unchanged. The screens (invite, pick a portion,
   schedule, progress, finish, duel) are named here and filled in when the flag is switched on. */
(function () {
  var flags = window.BA_FLAGS || {};
  if (flags.sharedReading !== true) return;
  var screens = ["invite", "pick", "schedule", "progress", "finish", "duel"];
  window.BAReading = {
    screens: screens,
    render: function (name, el) {
      if (!el || screens.indexOf(name) < 0) return;
      el.textContent = "Shared reading (" + name + ") is coming soon.";
    },
  };
})();
