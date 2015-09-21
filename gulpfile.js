var assign = require('lodash.assign');
var browserify = require('browserify');
var concat = require('gulp-concat');
var derequire = require('gulp-derequire');
var gulp = require('gulp');
var gutil = require('gulp-util');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var streamqueue = require('streamqueue');
var template = require('gulp-template');
var watchify = require('watchify');

var src = 'src/main.js';
var out_dir = 'dist';
var out_name = 'timers.user.js';

// Bundle source file to dest.
function bundle(debug) {
  if (typeof debug == "undefined") debug = false;
  return browserify({
      entries: src,
      debug: debug
  }).bundle()
    .on('error', gutil.log.bind(gutil, "Browserify Error"))
    .pipe(source(src.replace(/^src\//, '')));
}

// Builds public version.
gulp.task('build', function() {
  var pkg = require('./package.json');
  var header = gulp.src('./src/header.user.js')
    .pipe(template({
      version: pkg.version,
      updateUrl: [pkg.repository.url, 'raw/master', out_dir, out_name].join('/')
    }));
  var script = bundle();
  return streamqueue({ objectMode: true },
    header,
    script)
    .pipe(streamify(concat(out_name)))
    .pipe(gulp.dest(out_dir));
});

// Puts 'main.js' into dist dir directory, no header. For use with some
// auto-loading js extension like chrahunt/script-loader.
// use `http-server --cors` with http-server npm package for easy loading.
gulp.task('watch', function() {
  var opts = assign({}, watchify.args, {
    entries: src,
    debug: true
  });
  var b = watchify(browserify(opts));
  function watchBundle() {
    return b.bundle()
      .on('error', gutil.log.bind(gutil, "Browserify Error"))
      .pipe(source(src.replace(/^src\//, '')))
      .pipe(gulp.dest(out_dir));
  }
  b.on('update', watchBundle);
  b.on('log', gutil.log);
  return watchBundle();
});


