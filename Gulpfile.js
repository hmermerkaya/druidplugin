var gulp = require('gulp'),
    shell = require('gulp-shell'),
    runSequence = require('run-sequence'),
    del = require('del'),
    ts = require('gulp-typescript'),
    Builder = require('systemjs-builder');

var tsProject = ts.createProject('tsconfig.json',
                                 { typescript: require('typescript') });
gulp.task('copy', function() {
  gulp.src('plugin.json').pipe(gulp.dest('./dist'));
  gulp.src('src/partials/**/*').pipe(gulp.dest('./dist/partials'));
  gulp.src('src/jsep.js').pipe(gulp.dest('./dist'));
  gulp.src('img/**/*').pipe(gulp.dest('./dist/img'));
  gulp.src('src/module.js').pipe(gulp.dest('./dist'));
  gulp.src('datasource.js').pipe(gulp.dest('./dist'));
  gulp.src('query_ctrl.js').pipe(gulp.dest('./dist'));
  gulp.src('config_ctrl.js').pipe(gulp.dest('./dist'));
   gulp.src('src/test.json').pipe(gulp.dest('./dist'));
  console.log("don't forget to run gulp patch-sh")
});

gulp.task('build-ts', function () {
  var tsResult = tsProject.src()
      .pipe(ts(tsProject))
      .pipe(gulp.dest('src'));
  return tsResult;
});

gulp.task('build-datasource', function () {
  var builder = new Builder('src', 'src/app/system.conf.js');
  builder.config({
    defaultJSExtensions: true,
    paths: {
       "jsep": "jsep.js"
     },
    meta: {
      'app/*': {
        build: false
      },
      'vendor/*': {
        build: false
      },
      'moment': {
        build: false
      },
      'lodash': {
        build: false
      }
    }
  });

  return builder
    .bundle('datasource.js', 'datasource.js')
    .then(function() {
      console.log('Build complete');
    })
    .catch(function(err) {
      console.log('Build error');
      console.log(err);
    });
});

gulp.task('build-query-ctrl', function () {
  var builder = new Builder('src', 'src/app/system.conf.js');
  builder.config({
    defaultJSExtensions: true,
     paths: {
       "jsep": "jsep.js"
     },
    meta: {
      'app/*': {
        build: false
      },
      'vendor/*': {
        build: false
      },
      'moment': {
        build: false
      }
    }
  });

  return builder
    .bundle('query_ctrl.js', 'query_ctrl.js')
    .then(function() {
      console.log('Build complete');
    })
    .catch(function(err) {
      console.log('Build error');
      console.log(err);
    });
});

gulp.task('build-config-ctrl', function () {
  var builder = new Builder('src', 'src/app/system.conf.js');
  builder.config({
    defaultJSExtensions: true,
    meta: {
      'app/*': {
        build: false
      },
      'vendor/*': {
        build: false
      },
      'moment': {
        build: false
      }
    }
  });

  return builder
    .bundle('config_ctrl.js', 'config_ctrl.js')
    .then(function() {
      console.log('Build complete');
    })
    .catch(function(err) {
      console.log('Build error');
      console.log(err);
    });
});

gulp.task('build-clean', function() {
  return del(['dist', 'druid.js']);
});


gulp.task('build', function(callback) {
  runSequence(
    'build-clean',
    'build-ts',
    'build-datasource',
    'build-query-ctrl',
    'build-config-ctrl',
    'copy',
    callback);
});

gulp.task('patch-sh', shell.task([
  './patch.sh'
]));

gulp.task('setup', shell.task([
  'npm install',
  'tsd install node'
]));


gulp.task('default', ['build']);
