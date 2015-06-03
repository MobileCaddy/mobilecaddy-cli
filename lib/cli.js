#!/usr/bin/env node

/*
===========================================================================
  S E T T I N G    S T U F F    U P
===========================================================================
*/

var args = [];

process.argv.slice(2).forEach(function(arg) {
  var flag = arg.split('=')[0];

  switch (flag) {
    case 'debug':
      args.push('--nodeDebug');
      args.push('true');
      break;
    case '-d':
    case '--debug':
    case '--debug-brk':
      args.push('--v8Debug');
      args.push('true');
      break;
    default:
      args.push(arg);
      break;
  }
});

var fs = require('fs'),
    path = require('path'),
    os = require('os'),
    unzip = require('unzip'),
    Q = require('q'),
    request = require('request'),
    Download = require('download'),
    _ = require('underscore');


const knownTemplates = [
  {
    id   : 'ionic-shell',
    repo : 'http://github.com/MobileCaddy/shell-ionic/archive/master.zip',
    name : 'mobilecaddy-shell-ionic',
    desc : 'Empty Ioinc skeleton project'
  },
  {
    id   : 'ionic-seed-expenses',
    repo : 'https://github.com/MobileCaddy/seed-expenses-ionic/archive/master.zip',
    name : 'mobilecaddy-seed-expenses-ionic',
    desc : 'Ionic Time & Expenses App'
  }
];


/*
---------------------------------------------------------------------------
  S E T T I N G    S T U F F    U P
---------------------------------------------------------------------------
*/
var colors = require('colors');

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

/*
---------------------------------------------------------------------------
  H E L P
---------------------------------------------------------------------------
*/

// TODO use minimist instead
var optimist = require('optimist').
    usage('Usage: \n' +
      'mobilecaddy new <seed/shell-app> <your-app-name>\n' +
      'mobilecaddy templates').
    describe('help', 'Print MobileCaddy help menu').
    describe('version', 'Print MobileCaddy version');

var argv = optimist.parse(args);


if (argv.help) {
  optimist.showHelp();
  process.exit(0);
}

if (argv.version) {
  console.log('Version ' + require(path.join(__dirname, '../package.json')).version);
  process.exit(0);
}

if (argv._.length === 0) {
  optimist.showHelp();
  process.exit(0);
}

/*
===========================================================================
  C H O O S I N G    T H E    C O M M A N D
===========================================================================
*/
switch (args[0]) {
  case 'new':
    runNew();
    break;
  case 'templates':
    runTemplates();
    break;
  default :
    runUnknownTask();
}


/*
===========================================================================
  N E W
===========================================================================
*/
function runNew(){


  if (args[1] && args[2]) {
    if(args[2] == '.') {
      console.error('Invalid target path, you may not specify \'.\' as an app name'.error);
      process.exit(0);
    }
    var template = _.find(knownTemplates, function(el){return el.id == args[1];})
    if (template) {
      console.log('Cloning MobileCaddy template "' + args[1] + '" from ' + template.repo);
      fetchArchive(args[2], template).then(function(){
        console.log('Complete'.info);
        process.exit(0);
      }).catch(function(err){
        console.error(err.error);
        process.exit(0);
      });
    } else {
      console.error('Unknown template ' + args[1].error);
      process.exit(0);
    }

  } else {
    console.error('You need more arguments, man!'.error);
    //optimist.showHelp();
    process.exit(0);
  }
}


/*
===========================================================================
  T E M P L A T E S
===========================================================================
*/
function runTemplates(){
  // TODO
  knownTemplates.forEach(function(el){
    console.log(el.name.info + ' : ' +el.desc);
  });
}


/*
===========================================================================
  U N K N O W N    T A S K
===========================================================================
*/
function runUnknownTask(){
  console.error('Unknown task ' + args[0] + '!'.error);
  //optimist.showHelp();
  process.exit(0);
}


function fetchArchive(targetPath, template) {
  var q = Q.defer();
  var replace = require("replace");

  var archiveUrl = template.repo
  // The folder name the project will be downloaded and extracted to
  var message = ['Downloading:'.bold, archiveUrl].join(' ');
  console.log(message);

  var tmpFolder = os.tmpdir();
  var tempZipFilePath = path.join(tmpFolder, 'mobilecaddy-' + new Date().getTime());

  new Download({mode: '755', extract: true})
    .get(archiveUrl)
    .dest(tempZipFilePath)
    .run(function (err, files) {
        if (!err) {
          fs.rename(files[0].path, targetPath,
            function(res){
              if (!res) {
                replace({
                    regex: template.name,
                    replacement: targetPath,
                    paths: [targetPath],
                    recursive: true,
                    silent: true,
                });
                q.resolve();
              } else {
                console.error('Renaming template repo failed '.error);
                q.reject(res);
              }
            })
        } else {
          q.reject(err);
        }
    });

  return q.promise;
}