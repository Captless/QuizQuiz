/* ===== Homepage Interactions ===== */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Stepper ---------- */
  var steps = document.querySelectorAll('.step');
  var overlays = document.querySelectorAll('.step-overlay');

  steps.forEach(function (step) {
    step.addEventListener('click', function () {
      var stepNum = this.dataset.step;

      steps.forEach(function (s) { s.classList.remove('active'); });
      this.classList.add('active');

      overlays.forEach(function (o) {
        if (o.dataset.step === stepNum) {
          o.classList.add('show');
        } else {
          o.classList.remove('show');
        }
      });
    });
  });

});
