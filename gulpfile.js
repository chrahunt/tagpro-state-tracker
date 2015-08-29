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
var out_dir = './dist';

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

gulp.task('build', function() {
  var pkg = require('./package.json');
  var header = gulp.src('./src/header.user.js')
    .pipe(template({
      version: pkg.version,
      updateUrl: ""
    }));
  var script = bundle(true);
  return streamqueue({ objectMode: true },
    //header,
    script)
    .pipe(streamify(concat('timers.user.js')))
    .pipe(gulp.dest(out_dir));
});

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


