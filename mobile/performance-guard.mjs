// React development profiling can report a negative timestamp across runtimes.
// Preserve the browser's normal behavior for all other measurements.
export const performanceGuardScript = `(function(){
  var p = window.performance;
  if (!p || typeof p.measure !== 'function' || p.__pqMeasureGuard) return;
  var measure = p.measure;
  p.measure = function(name, options, endMark) {
    if (options && typeof options === 'object' &&
        ((typeof options.start === 'number' && options.start < 0) ||
         (typeof options.end === 'number' && options.end < 0))) {
      options = Object.assign({}, options);
      if (typeof options.start === 'number' && options.start < 0) options.start = 0;
      if (typeof options.end === 'number' && options.end < 0) options.end = 0;
    }
    return measure.call(this, name, options, endMark);
  };
  p.__pqMeasureGuard = true;
})();`;
